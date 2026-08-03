import fs from "fs";
import { prisma } from "../lib/prisma-client";
import { MonitoringService } from "../lib/services/mrv/monitoring-service";
import { storageManager } from "../lib/services/gis/storage-manager";

async function testMrvDirect() {
  console.log("=== EXECUTING DIRECT NODE.JS MRV CYCLE TEST ===");
  try {
    const project = await prisma.project.findFirst({
      where: { status: "APPROVED" },
    });

    if (!project) {
      console.log("No approved project found.");
      return;
    }

    console.log("Active Project:", project.name, `(${project.id})`);
    const service = new MonitoringService();

    await service.initConfig(project.id);
    await service.establishBaseline(project.id);

    const cycle = await prisma.monitoringCycle.upsert({
      where: {
        projectId_periodKey: {
          projectId: project.id,
          periodKey: "2026-M08",
        },
      },
      update: { status: "pending" },
      create: {
        projectId: project.id,
        periodKey: "2026-M08",
        monitoringStage: "monitoring",
        scheduledAt: new Date(2026, 7, 1),
        status: "pending",
      },
    });

    console.log("Processing cycle:", cycle.id, "...");
    await service.processCycle(cycle.id);
    console.log("Monitoring cycle completed successfully.");

    const stats = storageManager.getStorageStats();
    console.log("Storage Manager Stats:", JSON.stringify(stats, null, 2));

    const mrvFiles = fs.readdirSync("public/mrv");
    console.log("Files physically present in public/mrv:", mrvFiles.length);
  } catch (err) {
    console.error("Direct MRV test error:", err);
  } finally {
    await prisma.$disconnect();
  }
}

testMrvDirect();
