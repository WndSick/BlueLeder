/**
 * Vegetation Analysis Engine
 * Implements Open/Closed Principle (OCP) for pluggable vegetation index calculations.
 */

export interface VegetationCalculator {
  name: string;
  bandsRequired: string[];
  calculate(bands: Record<string, Float32Array>): Float32Array;
}

/**
 * Normalized Difference Vegetation Index (NDVI)
 * Formula: (NIR - Red) / (NIR + Red)
 * Bands: B8 (NIR), B4 (Red)
 */
export class NdviCalculator implements VegetationCalculator {
  name = "NDVI";
  bandsRequired = ["B4", "B8"];

  calculate(bands: Record<string, Float32Array>): Float32Array {
    const red = bands.B4;
    const nir = bands.B8;
    const size = red.length;
    const result = new Float32Array(size);

    for (let i = 0; i < size; i++) {
      const denominator = nir[i] + red[i];
      result[i] = denominator === 0 ? 0 : (nir[i] - red[i]) / denominator;
    }
    return result;
  }
}

/**
 * Normalized Difference Water Index (NDWI)
 * Formula: (NIR - SWIR) / (NIR + SWIR)
 * Bands: B8 (NIR), B11 (SWIR)
 */
export class NdwiCalculator implements VegetationCalculator {
  name = "NDWI";
  bandsRequired = ["B8", "B11"];

  calculate(bands: Record<string, Float32Array>): Float32Array {
    const nir = bands.B8;
    const swir = bands.B11;
    const size = nir.length;
    const result = new Float32Array(size);

    for (let i = 0; i < size; i++) {
      const denominator = nir[i] + swir[i];
      result[i] = denominator === 0 ? 0 : (nir[i] - swir[i]) / denominator;
    }
    return result;
  }
}

/**
 * Enhanced Vegetation Index (EVI)
 * Formula: 2.5 * ((NIR - Red) / (NIR + 6 * Red - 7.5 * Blue + 1))
 * Bands: B8 (NIR), B4 (Red), B2 (Blue)
 */
export class EviCalculator implements VegetationCalculator {
  name = "EVI";
  bandsRequired = ["B2", "B4", "B8"];

  calculate(bands: Record<string, Float32Array>): Float32Array {
    const blue = bands.B2;
    const red = bands.B4;
    const nir = bands.B8;
    const size = red.length;
    const result = new Float32Array(size);

    for (let i = 0; i < size; i++) {
      const denominator = nir[i] + 6 * red[i] - 7.5 * blue[i] + 1;
      result[i] = denominator === 0 ? 0 : 2.5 * ((nir[i] - red[i]) / denominator);
      // Clamp between -1.0 and 1.0
      result[i] = Math.max(-1.0, Math.min(1.0, result[i]));
    }
    return result;
  }
}

/**
 * Soil Adjusted Vegetation Index (SAVI)
 * Formula: ((NIR - Red) / (NIR + Red + L)) * (1 + L) where L = 0.5
 * Bands: B8 (NIR), B4 (Red)
 */
export class SaviCalculator implements VegetationCalculator {
  name = "SAVI";
  bandsRequired = ["B4", "B8"];
  private L = 0.5;

  calculate(bands: Record<string, Float32Array>): Float32Array {
    const red = bands.B4;
    const nir = bands.B8;
    const size = red.length;
    const result = new Float32Array(size);

    for (let i = 0; i < size; i++) {
      const denominator = nir[i] + red[i] + this.L;
      result[i] = denominator === 0 ? 0 : ((nir[i] - red[i]) / denominator) * (1 + this.L);
      result[i] = Math.max(-1.0, Math.min(1.0, result[i]));
    }
    return result;
  }
}

/**
 * Modified Soil Adjusted Vegetation Index (MSAVI)
 * Formula: (2 * NIR + 1 - sqrt((2 * NIR + 1)^2 - 8 * (NIR - Red))) / 2
 * Bands: B8 (NIR), B4 (Red)
 */
export class MsaviCalculator implements VegetationCalculator {
  name = "MSAVI";
  bandsRequired = ["B4", "B8"];

  calculate(bands: Record<string, Float32Array>): Float32Array {
    const red = bands.B4;
    const nir = bands.B8;
    const size = red.length;
    const result = new Float32Array(size);

    for (let i = 0; i < size; i++) {
      const val = 2 * nir[i] + 1;
      const radical = val * val - 8 * (nir[i] - red[i]);
      result[i] = radical < 0 ? 0 : (val - Math.sqrt(radical)) / 2;
      result[i] = Math.max(-1.0, Math.min(1.0, result[i]));
    }
    return result;
  }
}

/**
 * Vegetation Analysis Engine Orchestrator
 */
export class VegetationAnalysisEngine {
  private calculators = new Map<string, VegetationCalculator>();

  constructor() {
    // Register default calculators
    this.register(new NdviCalculator());
    this.register(new NdwiCalculator());
    this.register(new EviCalculator());
    this.register(new SaviCalculator());
    this.register(new MsaviCalculator());
  }

  register(calc: VegetationCalculator) {
    this.calculators.set(calc.name, calc);
  }

  calculateIndex(name: string, bands: Record<string, Float32Array>): Float32Array {
    const calculator = this.calculators.get(name);
    if (!calculator) {
      throw new Error(`Vegetation calculator for index '${name}' not registered.`);
    }

    // Verify required bands are present
    for (const reqBand of calculator.bandsRequired) {
      if (!bands[reqBand]) {
        throw new Error(`Required band '${reqBand}' missing for index calculation: ${name}`);
      }
    }

    return calculator.calculate(bands);
  }

  getCalculatedStats(data: Float32Array): { min: number; max: number; mean: number } {
    if (data.length === 0) return { min: 0, max: 0, mean: 0 };
    let sum = 0;
    let min = Infinity;
    let max = -Infinity;

    for (let i = 0; i < data.length; i++) {
      const val = data[i];
      sum += val;
      if (val < min) min = val;
      if (val > max) max = val;
    }

    return {
      min: Number(min.toFixed(4)),
      max: Number(max.toFixed(4)),
      mean: Number((sum / data.length).toFixed(4)),
    };
  }
}
