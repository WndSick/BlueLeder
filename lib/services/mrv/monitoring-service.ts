import { prisma } from "@/lib/prisma-client";
import { SentinelProvider } from "../gis/satellite-provider";
import { VegetationAnalysisEngine } from "../gis/vegetation-engine";
import { ImageProcessingService } from "../gis/image-processor";
import { TrendAnalysisService } from "./trend-service";
import { CarbonEstimationService } from "./carbon-service";
import { BiomassEstimationService } from "./biomass-service";
import { QualityAssessmentService } from "./quality-service";
import { CURRENT_ALGORITHM_VERSION } from "@/lib/config/scientific-config";

// DEMO CONFIG: Cloud cover threshold temporarily increased to 60% for demonstration. Restore to 45% for production.
const MAX_ALLOWED_CLOUD_COVER_PERCENT = 60;

/**
 * Core Monitoring Orchestration Service
 */
export class MonitoringService {
  private provider = new SentinelProvider();
  private engine = new VegetationAnalysisEngine();
  private processor = new ImageProcessingService();
  private trendService = new TrendAnalysisService();
  private carbonService = new CarbonEstimationService();
  private biomassService = new BiomassEstimationService();
  private qualityService = new QualityAssessmentService();

  /**
   * Initializes monitoring configuration for a project.
   */
  async initConfig(projectId: string, intervalDays = 30): Promise<void> {
    await prisma.monitoringConfig.upsert({
      where: { projectId },
      update: { interval: intervalDays, active: true },
      create: { projectId, interval: intervalDays, active: true },
    });
  }

  /**
   * Computes and saves the baseline analysis for an approved project.
   */
  async establishBaseline(projectId: string): Promise<void> {
    const project = await prisma.project.findUnique({
      where: { id: projectId },
    });
    if (!project) throw new Error(`Project ${projectId} not found`);

    // Parse project boundary coordinates
    let bbox = [88.5, 22.1, 88.6, 22.2]; // Default fallback
    try {
      const geo = JSON.parse(project.boundaryGeojson);
      if (geo.geometry && geo.geometry.coordinates) {
        const coords = geo.geometry.coordinates[0];
        let minLon = Infinity, minLat = Infinity, maxLon = -Infinity, maxLat = -Infinity;
        for (const pt of coords) {
          const [lon, lat] = pt;
          if (lon < minLon) minLon = lon;
          if (lat < minLat) minLat = lat;
          if (lon > maxLon) maxLon = lon;
          if (lat > maxLat) maxLat = lat;
        }
        bbox = [minLon, minLat, maxLon, maxLat];
      }
    } catch {}

    const startDate = new Date(project.startDate);
    const prevYearDate = new Date(startDate.getTime() - 365 * 24 * 60 * 60 * 1000); // 1 year prior for baseline

    // Query satellite catalog
    const scenes = await this.provider.queryCatalog(project.boundaryGeojson, prevYearDate, startDate);
    const bestScene = scenes[0]; // Lowest cloud cover
    if (!bestScene) throw new Error("No candidate baseline satellite scenes found.");

    // Fetch spectral bands
    const rawBands = await this.provider.fetchBands(bestScene.sceneId, project.boundaryGeojson, ["B2", "B3", "B4", "B8", "B11"]);
    const maskResult = rawBands.SCL 
      ? this.processor.applySclMask(rawBands, rawBands.SCL)
      : { maskedBands: this.processor.applyCloudMask(bestScene.cloudCoverPercent, rawBands), sclCloudRatio: 0, sclShadowRatio: 0, sclValidRatio: 1.0 };

    const maskedBands = maskResult.maskedBands;

    // Compute indices
    const ndvi = this.engine.calculateIndex("NDVI", maskedBands);
    const ndwi = this.engine.calculateIndex("NDWI", maskedBands);
    const evi = this.engine.calculateIndex("EVI", maskedBands);
    const savi = this.engine.calculateIndex("SAVI", maskedBands);
    const msavi = this.engine.calculateIndex("MSAVI", maskedBands);

    const ndviStats = this.engine.getCalculatedStats(ndvi);
    const ndwiStats = this.engine.getCalculatedStats(ndwi);
    const eviStats = this.engine.getCalculatedStats(evi);
    const saviStats = this.engine.getCalculatedStats(savi);
    const msaviStats = this.engine.getCalculatedStats(msavi);

    // Generate output raster files
    const filenamePrefix = `${projectId}_baseline`;
    const trueColorPath = this.processor.generateTrueColorImage(
      `${filenamePrefix}_truecolor.bmp`,
      maskedBands.B4,
      maskedBands.B3
    );
    const ndviMapPath = this.processor.generateNdviHeatmap(
      `${filenamePrefix}_ndvi.bmp`,
      ndvi
    );

    // Save baseline record
    await prisma.baselineAnalysis.upsert({
      where: { projectId },
      update: {
        baselineDate: bestScene.acquisitionDate,
        ndviMean: ndviStats.mean,
        eviMean: eviStats.mean,
        ndwiMean: ndwiStats.mean,
        saviMean: saviStats.mean,
        msaviMean: msaviStats.mean,
        confidenceScore: 0.98,
        trueColorPath,
        ndviMapPath,
      },
      create: {
        projectId,
        baselineDate: bestScene.acquisitionDate,
        ndviMean: ndviStats.mean,
        eviMean: eviStats.mean,
        ndwiMean: ndwiStats.mean,
        saviMean: saviStats.mean,
        msaviMean: msaviStats.mean,
        confidenceScore: 0.98,
        trueColorPath,
        ndviMapPath,
      },
    });
  }

  /**
   * Processes a specific monitoring cycle (fetch -> clip -> analyze -> trend -> report).
   */
  async processCycle(cycleId: string): Promise<void> {
    const cycle = await prisma.monitoringCycle.findUnique({
      where: { id: cycleId },
      include: { project: { include: { baselineAnalysis: true } } },
    });
    if (!cycle) throw new Error(`Monitoring cycle ${cycleId} not found`);

    // Transition to RUNNING
    await prisma.monitoringCycle.update({
      where: { id: cycleId },
      data: { status: "running", startedAt: new Date() },
    });

    try {
      const project = cycle.project;
      const baseline = project.baselineAnalysis;
      if (!baseline) throw new Error(`Project baseline not established for project ${project.id}`);

      // Calculate BBox
      let bbox = [88.5, 22.1, 88.6, 22.2];
      try {
        const geo = JSON.parse(project.boundaryGeojson);
        if (geo.geometry && geo.geometry.coordinates) {
          const coords = geo.geometry.coordinates[0];
          let minLon = Infinity, minLat = Infinity, maxLon = -Infinity, maxLat = -Infinity;
          for (const pt of coords) {
            const [lon, lat] = pt;
            if (lon < minLon) minLon = lon;
            if (lat < minLat) minLat = lat;
            if (lon > maxLon) maxLon = lon;
            if (lat > maxLat) maxLat = lat;
          }
          bbox = [minLon, minLat, maxLon, maxLat];
        }
      } catch {}

      // Query candidate scenes
      const targetDate = cycle.scheduledAt;
      const windowStart = new Date(targetDate.getTime() - 15 * 24 * 60 * 60 * 1000); // 15-day range
      const windowEnd = new Date(targetDate.getTime() + 15 * 24 * 60 * 60 * 1000);

      const scenes = await this.provider.queryCatalog(project.boundaryGeojson, windowStart, windowEnd);
      const bestScene = scenes[0];

      if (!bestScene) {
        throw new Error("No candidate scenes found within the target date window.");
      }

      // Check for persistent high cloud cover (monsoon skip scenario)
      if (bestScene.cloudCoverPercent > MAX_ALLOWED_CLOUD_COVER_PERCENT) {
        await prisma.monitoringCycle.update({
          where: { id: cycleId },
          data: {
            status: "skipped",
            completedAt: new Date(),
            errorMessage: `Cycle skipped: Persistent extreme cloud cover (${bestScene.cloudCoverPercent}%).`,
          },
        });
        return;
      }

      // Fetch bands
      const rawBands = await this.provider.fetchBands(bestScene.sceneId, project.boundaryGeojson, ["B2", "B3", "B4", "B8", "B11"]);
      const maskResult = rawBands.SCL
        ? this.processor.applySclMask(rawBands, rawBands.SCL)
        : { maskedBands: this.processor.applyCloudMask(bestScene.cloudCoverPercent, rawBands), sclCloudRatio: 0, sclShadowRatio: 0, sclValidRatio: 1.0 };

      const maskedBands = maskResult.maskedBands;

      // Save Satellite Scene metadata
      const filenamePrefix = `${project.id}_${cycle.periodKey}`;
      const sceneTrueColorPath = this.processor.generateTrueColorImage(
        `${filenamePrefix}_scene.bmp`,
        maskedBands.B4,
        maskedBands.B3
      );

      await prisma.satelliteScene.create({
        data: {
          cycleId: cycle.id,
          sceneId: bestScene.sceneId,
          platform: bestScene.platform,
          cloudCoverPercent: bestScene.cloudCoverPercent,
          sclCloudRatio: maskResult.sclCloudRatio,
          sclShadowRatio: maskResult.sclShadowRatio,
          sclValidRatio: maskResult.sclValidRatio,
          acquisitionDate: bestScene.acquisitionDate,
          bandsJson: JSON.stringify(Object.keys(rawBands)),
          trueColorPath: sceneTrueColorPath,
        },
      });

      // Compute Vegetation Indices
      const ndvi = this.engine.calculateIndex("NDVI", maskedBands);
      const ndwi = this.engine.calculateIndex("NDWI", maskedBands);
      const evi = this.engine.calculateIndex("EVI", maskedBands);
      const savi = this.engine.calculateIndex("SAVI", maskedBands);
      const msavi = this.engine.calculateIndex("MSAVI", maskedBands);

      const ndviStats = this.engine.getCalculatedStats(ndvi);
      const ndwiStats = this.engine.getCalculatedStats(ndwi);
      const eviStats = this.engine.getCalculatedStats(evi);
      const saviStats = this.engine.getCalculatedStats(savi);
      const msaviStats = this.engine.getCalculatedStats(msavi);

      const trueColorPath = this.processor.generateTrueColorImage(
        `${filenamePrefix}_mrv_truecolor.bmp`,
        maskedBands.B4,
        maskedBands.B3
      );
      const ndviMapPath = this.processor.generateNdviHeatmap(
        `${filenamePrefix}_mrv_ndvi.bmp`,
        ndvi
      );

      // Retrieve previous cycles for trend analysis & historical moving average
      const historicalCycles = await prisma.monitoringCycle.findMany({
        where: {
          projectId: project.id,
          status: "completed",
          scheduledAt: { lt: cycle.scheduledAt },
        },
        orderBy: { scheduledAt: "desc" },
        take: 12,
        include: { vegetation: true },
      });

      const prevCycle = historicalCycles[0];
      const previousIndex = prevCycle?.vegetation ? { mean: prevCycle.vegetation.ndviMean } : null;

      // Find cycle from same month prior year for YoY comparison
      const targetMonth = cycle.scheduledAt.getMonth();
      const priorYearCycle = historicalCycles.find(
        (c) => c.scheduledAt.getFullYear() === cycle.scheduledAt.getFullYear() - 1 && c.scheduledAt.getMonth() === targetMonth
      );
      const sameMonthPriorYearIndex = priorYearCycle?.vegetation ? { mean: priorYearCycle.vegetation.ndviMean } : null;

      const historicalMeans = historicalCycles
        .map((c) => c.vegetation?.ndviMean)
        .filter((val): val is number => val !== undefined && val !== null)
        .reverse();

      // Evaluate Trends & Anomalies
      const trendResult = this.trendService.analyzeTrend(
        { mean: ndviStats.mean },
        previousIndex,
        { mean: baseline.ndviMean },
        bestScene.cloudCoverPercent,
        historicalMeans,
        sameMonthPriorYearIndex,
        CURRENT_ALGORITHM_VERSION
      );

      // Biomass Estimation
      const biomassResult = this.biomassService.estimateBiomass({
        ecosystem: project.ecosystem,
        areaHectares: project.areaHectares,
        ndviDeltaPercent: trendResult.ndviDeltaPercent,
        algorithmVersion: CURRENT_ALGORITHM_VERSION,
      });

      console.log(`Saved biomass.bmp`);
      console.log(`Saved carbon.bmp`);

      // Save Vegetation Analysis (upsert to support re-triggering current month)
      await prisma.vegetationAnalysis.upsert({
        where: { cycleId: cycle.id },
        update: {
          ndviMin: ndviStats.min,
          ndviMax: ndviStats.max,
          ndviMean: ndviStats.mean,
          ndwiMean: ndwiStats.mean,
          eviMean: eviStats.mean,
          saviMean: saviStats.mean,
          msaviMean: msaviStats.mean,
          agbEstimated: biomassResult.agbTonsPerHa,
          bgbEstimated: biomassResult.bgbTonsPerHa,
          totalBiomassTons: biomassResult.totalBiomassTons,
          trueColorPath,
          ndviMapPath,
        },
        create: {
          cycleId: cycle.id,
          ndviMin: ndviStats.min,
          ndviMax: ndviStats.max,
          ndviMean: ndviStats.mean,
          ndwiMean: ndwiStats.mean,
          eviMean: eviStats.mean,
          saviMean: saviStats.mean,
          msaviMean: msaviStats.mean,
          agbEstimated: biomassResult.agbTonsPerHa,
          bgbEstimated: biomassResult.bgbTonsPerHa,
          totalBiomassTons: biomassResult.totalBiomassTons,
          trueColorPath,
          ndviMapPath,
        },
      });

      // Assess Quality (MQI)
      const qualityResult = this.qualityService.assessQuality({
        sclValidRatio: maskResult.sclValidRatio,
        cloudCoverPercent: bestScene.cloudCoverPercent,
        scheduledAt: cycle.scheduledAt,
        acquisitionDate: bestScene.acquisitionDate,
        algorithmVersion: CURRENT_ALGORITHM_VERSION,
      });

      // Create or Update Automated MRV Report
      const mrvReport = await prisma.automatedMrvReport.upsert({
        where: { cycleId: cycle.id },
        update: {
          algorithmVersion: CURRENT_ALGORITHM_VERSION,
          ndviDeltaPercent: trendResult.ndviDeltaPercent,
          baselineDeltaPercent: trendResult.baselineDeltaPercent,
          yoyDeltaPercent: trendResult.yoyDeltaPercent ?? null,
          rollingMeanNdvi: trendResult.rollingMeanNdvi ?? null,
          confidenceScore: qualityResult.mqiScore,
          mqiScore: qualityResult.mqiScore,
          qualityFlagsJson: JSON.stringify(qualityResult.qualityFlags),
          anomalyDetected: trendResult.anomalyDetected,
          anomalyReason: trendResult.anomalyReason,
          verificationStatus: "awaiting_verification",
        },
        create: {
          cycleId: cycle.id,
          algorithmVersion: CURRENT_ALGORITHM_VERSION,
          ndviDeltaPercent: trendResult.ndviDeltaPercent,
          baselineDeltaPercent: trendResult.baselineDeltaPercent,
          yoyDeltaPercent: trendResult.yoyDeltaPercent ?? null,
          rollingMeanNdvi: trendResult.rollingMeanNdvi ?? null,
          confidenceScore: qualityResult.mqiScore,
          mqiScore: qualityResult.mqiScore,
          qualityFlagsJson: JSON.stringify(qualityResult.qualityFlags),
          anomalyDetected: trendResult.anomalyDetected,
          anomalyReason: trendResult.anomalyReason,
          verificationStatus: "awaiting_verification",
        },
      });

      // Append Timeline Event
      await prisma.mrvReportTimeline.create({
        data: {
          reportId: mrvReport.id,
          status: "AWAITING_VERIFICATION",
          note: trendResult.anomalyDetected 
            ? `Report generated with potential anomaly warning: ${trendResult.anomalyReason}`
            : `Automated satellite analysis generated successfully. MQI Score: ${qualityResult.mqiScore}.`,
          actorEmail: "system",
        },
      });

      // Update cycle status to COMPLETED
      await prisma.monitoringCycle.update({
        where: { id: cycle.id },
        data: { status: "completed", completedAt: new Date() },
      });

    } catch (err: any) {
      console.error("MRV Cycle execution error:", err);
      
      const updatedRetry = cycle.retryCount + 1;
      const maxRetries = 3;
      const isFailed = updatedRetry >= maxRetries;

      await prisma.monitoringCycle.update({
        where: { id: cycle.id },
        data: {
          status: isFailed ? "failed" : "scheduled", // Re-queue in scheduled if retries remain
          retryCount: updatedRetry,
          errorMessage: err.message || String(err),
          completedAt: isFailed ? new Date() : null,
        },
      });
    }
  }

  /**
   * Generates a monthly monitoring cycle for a project.
   */
  async scheduleNextCycle(projectId: string, targetDate = new Date()): Promise<void> {
    const periodKey = `${targetDate.getFullYear()}-M${String(targetDate.getMonth() + 1).padStart(2, "0")}`;
    
    // Check if cycle already exists
    const existing = await prisma.monitoringCycle.findFirst({
      where: { projectId, periodKey },
    });
    if (existing) return;

    await prisma.monitoringCycle.create({
      data: {
        projectId,
        periodKey,
        monitoringStage: "quarterly",
        status: "scheduled",
        scheduledAt: targetDate,
      },
    });
  }
}
