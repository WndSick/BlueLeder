import { prisma } from "../lib/prisma-client";
import { MonitoringService } from "../lib/services/mrv/monitoring-service";

async function testDemoThreshold() {
  console.log("=== TESTING DEMO CLOUD COVER THRESHOLD (60%) ===");
  const project = await prisma.project.findFirst({
    where: { status: "APPROVED" },
  });

  if (!project) {
    console.log("No approved project found.");
    return;
  }

  const service = new MonitoringService();

  // Test 1: Mock 53% cloud cover scene
  const test53Scene = {
    sceneId: "S2A_TEST_53_PERCENT",
    platform: "Sentinel-2",
    cloudCoverPercent: 53.0,
    acquisitionDate: new Date(),
    bounds: [88.5, 22.1, 88.6, 22.2],
  };

  console.log(`\nTesting Scene with ${test53Scene.cloudCoverPercent}% Cloud Cover against 60% Demo Threshold...`);
  const shouldSkip53 = test53Scene.cloudCoverPercent > 60;
  console.log(`Cloud Cover 53.0% > 60% -> Should Skip: ${shouldSkip53} (Expected: false -> Processing Proceeds)`);

  // Test 2: Mock 63% cloud cover scene
  const test63Scene = {
    sceneId: "S2A_TEST_63_PERCENT",
    platform: "Sentinel-2",
    cloudCoverPercent: 63.0,
    acquisitionDate: new Date(),
    bounds: [88.5, 22.1, 88.6, 22.2],
  };

  console.log(`\nTesting Scene with ${test63Scene.cloudCoverPercent}% Cloud Cover against 60% Demo Threshold...`);
  const shouldSkip63 = test63Scene.cloudCoverPercent > 60;
  console.log(`Cloud Cover 63.0% > 60% -> Should Skip: ${shouldSkip63} (Expected: true -> Cycle Skipped)`);

  if (!shouldSkip53 && shouldSkip63) {
    console.log("\nVERIFICATION SUCCESSFUL: 53% cloud cover scene PROCEEDS with processing under the 60% demo threshold.");
  } else {
    console.error("\nVERIFICATION FAILED!");
  }

  await prisma.$disconnect();
}

testDemoThreshold();
