import fs from "fs";
import path from "path";

export interface StorageStats {
  totalImages: number;
  totalBytes: number;
  projectUsage: Record<string, { images: number; bytes: number }>;
}

export class StorageManager {
  private baseDir: string;

  constructor(baseDir?: string) {
    this.baseDir = baseDir || path.join(process.cwd(), "public", "mrv");
  }

  /**
   * Helper to ensure the base storage directory exists.
   */
  public ensureStorageDirectory(subPath = ""): string {
    const targetDir = path.join(this.baseDir, subPath);
    if (!fs.existsSync(targetDir)) {
      fs.mkdirSync(targetDir, { recursive: true });
    }
    return targetDir;
  }

  /**
   * Deletes all cached satellite images for a specific project.
   */
  public deleteProjectImages(projectId: string): number {
    if (!fs.existsSync(this.baseDir)) return 0;
    let deletedCount = 0;
    const files = fs.readdirSync(this.baseDir);
    for (const file of files) {
      if (file.includes(projectId)) {
        try {
          fs.unlinkSync(path.join(this.baseDir, file));
          deletedCount++;
        } catch (_) {}
      }
    }
    return deletedCount;
  }

  /**
   * Deletes images associated with a specific monitoring cycle label.
   */
  public deleteCycleImages(projectId: string, cycleLabel: string): number {
    if (!fs.existsSync(this.baseDir)) return 0;
    let deletedCount = 0;
    const files = fs.readdirSync(this.baseDir);
    for (const file of files) {
      if (file.includes(projectId) && file.includes(cycleLabel)) {
        try {
          fs.unlinkSync(path.join(this.baseDir, file));
          deletedCount++;
        } catch (_) {}
      }
    }
    return deletedCount;
  }

  /**
   * Deletes image files older than a given retention threshold in days.
   */
  public deleteOldImages(retentionDays = 90): number {
    if (!fs.existsSync(this.baseDir)) return 0;
    let deletedCount = 0;
    const now = Date.now();
    const cutoffTime = now - retentionDays * 24 * 60 * 60 * 1000;
    const files = fs.readdirSync(this.baseDir);
    for (const file of files) {
      const filePath = path.join(this.baseDir, file);
      try {
        const stats = fs.statSync(filePath);
        if (stats.isFile() && stats.mtimeMs < cutoffTime) {
          fs.unlinkSync(filePath);
          deletedCount++;
        }
      } catch (_) {}
    }
    return deletedCount;
  }

  /**
   * Returns current storage metrics including total images, disk usage, and per-project usage.
   */
  public getStorageStats(): StorageStats {
    if (!fs.existsSync(this.baseDir)) {
      return { totalImages: 0, totalBytes: 0, projectUsage: {} };
    }

    let totalImages = 0;
    let totalBytes = 0;
    const projectUsage: Record<string, { images: number; bytes: number }> = {};

    const files = fs.readdirSync(this.baseDir);
    for (const file of files) {
      const filePath = path.join(this.baseDir, file);
      try {
        const stats = fs.statSync(filePath);
        if (stats.isFile()) {
          totalImages++;
          totalBytes += stats.size;

          const projectIdMatch = file.match(/^([0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12})/i);
          const projectId = projectIdMatch ? projectIdMatch[1] : "other";

          if (!projectUsage[projectId]) {
            projectUsage[projectId] = { images: 0, bytes: 0 };
          }
          projectUsage[projectId].images += 1;
          projectUsage[projectId].bytes += stats.size;
        }
      } catch (_) {}
    }

    return { totalImages, totalBytes, projectUsage };
  }
}

export const storageManager = new StorageManager();
