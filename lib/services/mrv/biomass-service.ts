import { getScientificConfig } from "@/lib/config/scientific-config";

export interface BiomassEstimationResult {
  agbTonsPerHa: number;       // Above-Ground Biomass density (t/ha)
  bgbTonsPerHa: number;       // Below-Ground Biomass density (t/ha)
  totalBiomassDensity: number; // Total biomass density (t/ha)
  totalBiomassTons: number;   // Total biomass tonnage across boundary
  growthMultiplier: number;   // Index growth multiplier M
  ecosystemName: string;
  citations: string[];
}

export class BiomassEstimationService {
  /**
   * Estimates Above-Ground and Below-Ground Biomass stocks for a blue carbon project.
   */
  estimateBiomass(params: {
    ecosystem: string;
    areaHectares: number;
    ndviDeltaPercent: number;
    algorithmVersion?: string;
  }): BiomassEstimationResult {
    const config = getScientificConfig(params.algorithmVersion);
    const ecosystemKey = params.ecosystem.toLowerCase();
    const profile = config.ecosystems[ecosystemKey] || config.ecosystems.mangrove;

    // Evaluate Growth Multiplier M based on vegetation delta trend
    let growthMultiplier = 1.0;
    if (params.ndviDeltaPercent > 0) {
      growthMultiplier = 1.0 + Math.min(config.additionalityMaxBonus, params.ndviDeltaPercent / 100);
    } else if (params.ndviDeltaPercent < 0) {
      growthMultiplier = Math.max(0.0, 1.0 + params.ndviDeltaPercent / 100);
    }

    const agbTonsPerHa = Number((profile.agbFactor * growthMultiplier).toFixed(3));
    const bgbTonsPerHa = Number((profile.bgbFactor * growthMultiplier).toFixed(3));
    const totalBiomassDensity = Number((agbTonsPerHa + bgbTonsPerHa).toFixed(3));
    const totalBiomassTons = Number((totalBiomassDensity * params.areaHectares).toFixed(2));

    return {
      agbTonsPerHa,
      bgbTonsPerHa,
      totalBiomassDensity,
      totalBiomassTons,
      growthMultiplier,
      ecosystemName: profile.name,
      citations: profile.citations,
    };
  }
}
