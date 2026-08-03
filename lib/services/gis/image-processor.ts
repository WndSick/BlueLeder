import fs from "fs";
import path from "path";

/**
 * Image Processing Service
 * Decoupled from mathematical calculations. Handles raster clipping,
 * cloud masking simulation, normalization, and image asset generation.
 */
export class ImageProcessingService {
  private outputDir: string;

  constructor() {
    // Write static images to public/mrv so Next.js can serve them directly
    this.outputDir = path.join(process.cwd(), "public", "mrv");
    if (!fs.existsSync(this.outputDir)) {
      try {
        fs.mkdirSync(this.outputDir, { recursive: true });
      } catch (err) {
        console.warn("Could not create public/mrv directory:", err);
      }
    }
  }

  /**
   * Generates a 3-channel (RGB) BMP image from raw data arrays in pure JS.
   * Works in all JS runtimes (Node, workerd) with no native C++ bindings needed.
   */
  encodeBmp(width: number, height: number, pixelMapper: (x: number, y: number) => { r: number; g: number; b: number }): Buffer {
    const rowSize = Math.floor((width * 3 + 3) / 4) * 4; // Padding to multiple of 4 bytes
    const pixelDataSize = rowSize * height;
    const fileSize = 54 + pixelDataSize;

    const buffer = Buffer.alloc(fileSize);

    // 1. BMP Header (14 bytes)
    buffer.write("BM", 0); // Signature
    buffer.writeUInt32LE(fileSize, 2); // File size
    buffer.writeUInt16LE(0, 6); // Reserved
    buffer.writeUInt16LE(0, 8); // Reserved
    buffer.writeUInt32LE(54, 10); // Offset to pixel data

    // 2. DIB Header (40 bytes)
    buffer.writeUInt32LE(40, 14); // Header size
    buffer.writeInt32LE(width, 18); // Width
    buffer.writeInt32LE(height, 22); // Height
    buffer.writeUInt16LE(1, 26); // Planes
    buffer.writeUInt16LE(24, 28); // Bits per pixel (RGB)
    buffer.writeUInt32LE(0, 30); // Compression (none)
    buffer.writeUInt32LE(pixelDataSize, 34); // Image size
    buffer.writeInt32LE(2835, 38); // H resolution (72 DPI)
    buffer.writeInt32LE(2835, 42); // V resolution (72 DPI)
    buffer.writeUInt32LE(0, 46); // Colors in palette
    buffer.writeUInt32LE(0, 50); // Important colors

    // 3. Pixel Data (written bottom-to-top, left-to-right)
    let offset = 54;
    for (let y = height - 1; y >= 0; y--) {
      for (let x = 0; x < width; x++) {
        const color = pixelMapper(x, y);
        // BMP stores pixels in BGR order
        buffer.writeUInt8(color.b, offset);
        buffer.writeUInt8(color.g, offset + 1);
        buffer.writeUInt8(color.r, offset + 2);
        offset += 3;
      }
      // Padding row to multiple of 4 bytes
      const paddingBytes = rowSize - width * 3;
      for (let p = 0; p < paddingBytes; p++) {
        buffer.writeUInt8(0, offset);
        offset++;
      }
    }

    return buffer;
  }

  /**
   * Generates a mockup True-Color BMP scene representation.
   */
  generateTrueColorImage(filename: string, red: Float32Array, green: Float32Array): string {
    const size = 100; // 100x100 resolution grid
    
    const buffer = this.encodeBmp(size, size, (x, y) => {
      const idx = (y * 10 + Math.floor(x / 10)) % red.length;
      const rVal = red[idx] || 0.1;
      const gVal = green[idx] || 0.18;
      
      // Map to 0-255 RGB cleanly handling 0-1 and 0-10000 reflectance ranges
      const normR = rVal > 1 ? rVal / 10000 : rVal;
      const normG = gVal > 1 ? gVal / 10000 : gVal;
      const r = Math.min(255, Math.max(0, Math.floor(normR * 255)));
      const g = Math.min(255, Math.max(0, Math.floor(normG * 255)));
      const b = Math.min(255, Math.max(0, Math.floor(normR * 0.8 * 255)));

      return { r, g, b };
    });

    try {
      if (!fs.existsSync(this.outputDir)) {
        fs.mkdirSync(this.outputDir, { recursive: true });
        console.log(`Created directory: public/mrv/`);
      }
      const filepath = path.join(this.outputDir, filename);
      fs.writeFileSync(filepath, buffer);
      console.log(`Saved true-color.bmp`);
    } catch (err: any) {
      console.warn("Could not write BMP image file:", err.message);
    }
    return `/mrv/${filename}`;
  }

  /**
   * Generates a mockup NDVI Heatmap BMP (Red-Yellow-Green gradient).
   */
  generateNdviHeatmap(filename: string, ndvi: Float32Array): string {
    const size = 100;
    
    const buffer = this.encodeBmp(size, size, (x, y) => {
      const idx = (y * 10 + Math.floor(x / 10)) % ndvi.length;
      const nVal = ndvi[idx] || 0;

      let r = 220, g = 50, b = 50;
      if (nVal > 0 && nVal <= 0.45) {
        const factor = nVal / 0.45;
        r = 220;
        g = Math.floor(50 + 170 * factor);
        b = 50;
      } else if (nVal > 0.45) {
        const factor = Math.min(1.0, (nVal - 0.45) / 0.55);
        r = Math.floor(220 - 170 * factor);
        g = Math.floor(220 - 60 * factor);
        b = 50;
      }

      return { r, g, b };
    });

    try {
      if (!fs.existsSync(this.outputDir)) {
        fs.mkdirSync(this.outputDir, { recursive: true });
        console.log(`Created directory: public/mrv/`);
      }
      const filepath = path.join(this.outputDir, filename);
      fs.writeFileSync(filepath, buffer);
      console.log(`Saved ndvi.bmp`);
      console.log(`Saved heatmap.bmp`);
    } catch (err: any) {
      console.warn("Could not write Heatmap BMP file:", err.message);
    }
    return `/mrv/${filename}`;
  }

  /**
   * Applies Scene Classification Layer (SCL) bitmask filtering with a 1-pixel dilation radius.
   */
  applySclMask(
    rawBands: Record<string, Float32Array>,
    scl: Float32Array,
    dilationRadius = 1
  ): { maskedBands: Record<string, Float32Array>; sclCloudRatio: number; sclShadowRatio: number; sclValidRatio: number } {
    const size = scl.length;
    const gridDim = Math.round(Math.sqrt(size)); // e.g. 10 for 10x10 grid

    const isCloudy = new Uint8Array(size);
    let cloudCount = 0;
    let shadowCount = 0;

    for (let i = 0; i < size; i++) {
      const val = Math.round(scl[i]);
      // SCL 3: Cloud Shadow, 8: Cloud Medium, 9: Cloud High, 10: Cirrus, 11: Snow
      if (val === 3) shadowCount++;
      if ([8, 9, 10].includes(val)) cloudCount++;

      if ([0, 1, 3, 8, 9, 10, 11].includes(val)) {
        isCloudy[i] = 1;
      }
    }

    // Apply 1-pixel dilation buffer around cloud & shadow edge pixels
    const dilatedMask = new Uint8Array(isCloudy);
    if (dilationRadius > 0 && gridDim * gridDim === size) {
      for (let y = 0; y < gridDim; y++) {
        for (let x = 0; x < gridDim; x++) {
          const idx = y * gridDim + x;
          if (isCloudy[idx] === 1) {
            for (let dy = -dilationRadius; dy <= dilationRadius; dy++) {
              for (let dx = -dilationRadius; dx <= dilationRadius; dx++) {
                const ny = y + dy;
                const nx = x + dx;
                if (ny >= 0 && ny < gridDim && nx >= 0 && nx < gridDim) {
                  dilatedMask[ny * gridDim + nx] = 1;
                }
              }
            }
          }
        }
      }
    }

    let validCount = 0;
    const maskedBands: Record<string, Float32Array> = {};
    for (const bandName of Object.keys(rawBands)) {
      if (bandName === "SCL") continue;
      const src = rawBands[bandName];
      const dst = new Float32Array(src.length);
      for (let i = 0; i < src.length; i++) {
        if (dilatedMask[i] === 1) {
          // Masked pixel: substitute default clear reflectance to prevent stats distortion
          dst[i] = bandName === "B8" ? 0.55 : bandName === "B4" ? 0.08 : 0.12;
        } else {
          dst[i] = src[i];
          if (bandName === "B4") validCount++;
        }
      }
      maskedBands[bandName] = dst;
    }

    const sclCloudRatio = Number((cloudCount / size).toFixed(4));
    const sclShadowRatio = Number((shadowCount / size).toFixed(4));
    const sclValidRatio = Number((validCount / size).toFixed(4));

    return { maskedBands, sclCloudRatio, sclShadowRatio, sclValidRatio };
  }

  /**
   * Simulates cloud cover filtering/masking.
   */
  applyCloudMask(sceneCloudPercent: number, rawBands: Record<string, Float32Array>): Record<string, Float32Array> {
    if (rawBands.SCL) {
      return this.applySclMask(rawBands, rawBands.SCL).maskedBands;
    }
    if (sceneCloudPercent < 2) return rawBands;

    // Simulate replacing cloudy pixels with baseline averages
    const masked = { ...rawBands };
    const key = Object.keys(masked)[0];
    const size = masked[key].length;

    // Mask out random pixels based on cloud percentage
    for (const bandName in masked) {
      const data = new Float32Array(masked[bandName]);
      for (let i = 0; i < size; i++) {
        if ((i % 13) * 7 < sceneCloudPercent) {
          // Cloud pixel! Mask it by substituting a default foliage reflectance
          data[i] = bandName === "B8" ? 0.55 : 0.08; 
        }
      }
      masked[bandName] = data;
    }

    return masked;
  }
}
