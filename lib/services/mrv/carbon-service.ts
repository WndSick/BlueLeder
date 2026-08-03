import { getScientificConfig } from "@/lib/config/scientific-config";
import { BiomassEstimationResult } from "./biomass-service";

export interface CarbonEstimationResult {
  biomassIndex: number;
  carbonTonsEstimated: number; // tCO2e
  issuanceCeiling: number;      // Maximum limit for this period
  allocatedCredits: number;     // Estimated credits matching estimation
}

export class CarbonEstimationService {
  /**
   * Estimates carbon additions for a given area, ecosystem, and monitoring delta growth.
   */
  estimateCarbonGain(
    ecosystem: string,
    areaHectares: number,
    ndviDeltaPercent: number, // Comparison vs previous or baseline
    periodFractionOfYear: number, // e.g. 0.083 for Monthly (1/12), 0.25 for Quarterly (1/4)
    biomassResult?: BiomassEstimationResult,
    algorithmVersion?: string
  ): CarbonEstimationResult {
    const config = getScientificConfig(algorithmVersion);
    const profile = config.ecosystems[ecosystem.toLowerCase()] || config.ecosystems.mangrove;

    const totalBiomassDensity = biomassResult 
      ? biomassResult.totalBiomassDensity
      : profile.agbFactor + profile.bgbFactor;

    const growthMultiplier = biomassResult
      ? biomassResult.growthMultiplier
      : (ndviDeltaPercent > 0 
          ? 1.0 + Math.min(config.additionalityMaxBonus, ndviDeltaPercent / 100)
          : Math.max(0.0, 1.0 + ndviDeltaPercent / 100));

    // 1. Calculate standard baseline annual CO2e growth:
    // Formula: Area * Total Biomass Density * Carbon Fraction * (44/12 stoichiometric ratio)
    const annualCeiling = areaHectares * (profile.agbFactor + profile.bgbFactor) * profile.carbonFraction * config.co2ToCarbonRatio;
    const periodCeiling = annualCeiling * periodFractionOfYear;

    // 2. Scale estimation based on biomass growth multiplier:
    const estimatedGain = periodCeiling * growthMultiplier;
    const carbonTonsEstimated = Number(Math.min(periodCeiling * (1.0 + config.additionalityMaxBonus), estimatedGain).toFixed(2));
    const allocatedCredits = Math.floor(carbonTonsEstimated);

    return {
      biomassIndex: Number((totalBiomassDensity).toFixed(3)),
      carbonTonsEstimated,
      issuanceCeiling: Number(periodCeiling.toFixed(2)),
      allocatedCredits,
    };
  }
}
