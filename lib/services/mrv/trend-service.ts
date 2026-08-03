import { getScientificConfig } from "@/lib/config/scientific-config";

export interface TrendAnalysisResult {
  ndviDeltaPercent: number;      // Change compared to previous period
  baselineDeltaPercent: number;  // Change compared to baseline
  yoyDeltaPercent?: number;      // Change compared to same month prior year
  rollingMeanNdvi?: number;      // 3-cycle rolling average
  anomalyDetected: boolean;
  anomalyReason?: string;
  confidenceScore: number;
}

export class TrendAnalysisService {
  /**
   * Calculates vegetation metrics comparison, rolling averages, YoY trend, and flags potential anomalies.
   */
  analyzeTrend(
    currentIndex: { mean: number },
    previousIndex: { mean: number } | null,
    baselineIndex: { mean: number },
    cloudCoverPercent: number,
    historicalMeans: number[] = [],
    sameMonthPriorYearIndex?: { mean: number } | null,
    algorithmVersion?: string
  ): TrendAnalysisResult {
    const config = getScientificConfig(algorithmVersion);

    // 1. Compare against baseline
    const baselineDeltaPercent = baselineIndex.mean === 0 
      ? 0 
      : Number((((currentIndex.mean - baselineIndex.mean) / baselineIndex.mean) * 100).toFixed(2));

    // 2. Compare against previous monitoring cycle
    let ndviDeltaPercent = 0;
    if (previousIndex) {
      ndviDeltaPercent = previousIndex.mean === 0
        ? 0
        : Number((((currentIndex.mean - previousIndex.mean) / previousIndex.mean) * 100).toFixed(2));
    }

    // 3. Year-Over-Year (YoY) comparison against same month prior year
    let yoyDeltaPercent: number | undefined;
    if (sameMonthPriorYearIndex && sameMonthPriorYearIndex.mean > 0) {
      yoyDeltaPercent = Number(
        (((currentIndex.mean - sameMonthPriorYearIndex.mean) / sameMonthPriorYearIndex.mean) * 100).toFixed(2)
      );
    }

    // 4. 3-Cycle Rolling Moving Average calculation
    let rollingMeanNdvi: number | undefined;
    const combinedHistory = [...historicalMeans, currentIndex.mean];
    if (combinedHistory.length > 0) {
      const recent = combinedHistory.slice(-3); // Last 3 cycles
      const sum = recent.reduce((acc, val) => acc + val, 0);
      rollingMeanNdvi = Number((sum / recent.length).toFixed(4));
    }

    // 5. Detect anomalies using configured drop threshold
    let anomalyDetected = false;
    let anomalyReason: string | undefined;

    const thresholdMultiplier = 1.0 - config.anomalyThreshold;
    if (previousIndex && currentIndex.mean < previousIndex.mean * thresholdMultiplier) {
      anomalyDetected = true;
      anomalyReason = `Significant vegetation index drop detected: Mean index decreased from ${previousIndex.mean} to ${currentIndex.mean} (${Math.abs(ndviDeltaPercent)}% reduction, exceeding ${(config.anomalyThreshold * 100)}% threshold).`;
    }

    // 6. Calculate confidence score
    let confidenceScore = 0.98;
    if (cloudCoverPercent > 0) {
      confidenceScore -= (cloudCoverPercent / 100) * 0.5;
    }
    confidenceScore = Number(Math.max(0.1, confidenceScore).toFixed(2));

    return {
      ndviDeltaPercent,
      baselineDeltaPercent,
      yoyDeltaPercent,
      rollingMeanNdvi,
      anomalyDetected,
      anomalyReason,
      confidenceScore,
    };
  }
}
