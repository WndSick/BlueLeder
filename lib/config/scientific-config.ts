/**
 * Centralized Scientific Parameter & Configuration Registry
 * Houses versioned parameters, ecological constants, quality weights, and scientific citations.
 */

export interface EcosystemParameterProfile {
  name: string;
  agbFactor: number;       // Above-Ground Biomass factor (t/ha)
  bgbFactor: number;       // Below-Ground Biomass factor (t/ha)
  carbonFraction: number;  // Carbon content fraction (0.0 - 1.0)
  woodDensity?: number;    // Wood density g/cm^3
  citations: string[];
}

export interface ScientificConfig {
  version: string;
  co2ToCarbonRatio: number; // 44/12 stoichiometric ratio
  additionalityMaxBonus: number; // 10% maximum additionality bonus
  anomalyThreshold: number; // 15% drop threshold (or Z-score > 2.0)
  sclDilationRadiusPixels: number; // 1-pixel dilation radius for cloud shadows
  qualityWeights: {
    sclValidPixels: number;
    geometryCoverage: number;
    temporalAge: number;
    sensorRadiometrics: number;
  };
  ecosystems: Record<string, EcosystemParameterProfile>;
}

export const CURRENT_ALGORITHM_VERSION = "v2.0.0-phase4";

const CONFIG_REGISTRY: Record<string, ScientificConfig> = {
  "v2.0.0-phase4": {
    version: "v2.0.0-phase4",
    co2ToCarbonRatio: 44 / 12,
    additionalityMaxBonus: 0.10,
    anomalyThreshold: 0.15,
    sclDilationRadiusPixels: 1, // 1-pixel dilation buffer for cloud edge pixels
    qualityWeights: {
      sclValidPixels: 0.50,
      geometryCoverage: 0.20,
      temporalAge: 0.20,
      sensorRadiometrics: 0.10,
    },
    ecosystems: {
      mangrove: {
        name: "Mangrove Estuary",
        agbFactor: 9.8,
        bgbFactor: 2.6, // Total 12.4 t/ha
        carbonFraction: 0.47,
        woodDensity: 0.65,
        citations: [
          "Alongi, D. M. (2012). Carbon sequestration in mangrove forests. Carbon Management, 3(3), 313-322.",
          "Kauffman, J. B., & Donato, D. C. (2012). Protocols for the measurement, monitoring and reporting of structure, biomass and carbon stocks in mangroves.",
        ],
      },
      seagrass: {
        name: "Seagrass Meadow",
        agbFactor: 1.8,
        bgbFactor: 2.4, // Total 4.2 t/ha
        carbonFraction: 0.45,
        citations: [
          "Fourqurean, J. W., et al. (2012). Seagrass ecosystems as a globally significant carbon stock. Nature Geoscience, 5(7), 505-509.",
          "Howard, J., et al. (2014). Coastal Blue Carbon: Methods for assessing carbon stocks and emissions factors.",
        ],
      },
      salt_marsh: {
        name: "Coastal Salt Marsh",
        agbFactor: 3.1,
        bgbFactor: 4.0, // Total 7.1 t/ha
        carbonFraction: 0.46,
        citations: [
          "Chmura, G. L., et al. (2003). Global carbon sequestration in tidal saline wetlands. Global Biogeochemical Cycles, 17(4).",
          "IPCC (2013). 2013 Supplement to the 2006 IPCC Guidelines for National Greenhouse Gas Inventories: Wetlands.",
        ],
      },
    },
  },
};

/**
 * Retrieves the scientific parameter configuration for a specific algorithm version.
 */
export function getScientificConfig(version = CURRENT_ALGORITHM_VERSION): ScientificConfig {
  return CONFIG_REGISTRY[version] || CONFIG_REGISTRY[CURRENT_ALGORITHM_VERSION];
}
