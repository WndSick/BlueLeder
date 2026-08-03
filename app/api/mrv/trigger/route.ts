import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma-client";
import { MonitoringService } from "@/lib/services/mrv/monitoring-service";

export const dynamic = "force-dynamic";

export async function POST(request: NextRequest) {
  try {
    const userId = request.headers.get("x-user-id");
    const role = request.headers.get("x-user-role");

    if (!userId || !role) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    // Only NGO, Community, and Admin can trigger telemetry updates/fetches
    if (!["ADMIN", "NGO", "COMMUNITY"].includes(role)) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    const body = await request.json();
    const { projectId, date } = body;

    if (!projectId) {
      return NextResponse.json({ error: "projectId is required" }, { status: 400 });
    }

    const targetDate = date ? new Date(date) : new Date();
    const monitoringService = new MonitoringService();

    // 1. Establish baseline first if it doesn't exist!
    const baseline = await prisma.baselineAnalysis.findUnique({
      where: { projectId },
    });
    if (!baseline) {
      console.log(`Establishing baseline for project ${projectId} first...`);
      await monitoringService.establishBaseline(projectId);
    }

    // 2. Schedule the next cycle
    await monitoringService.scheduleNextCycle(projectId, targetDate);

    // 3. Find the newly created/scheduled cycle and run it immediately!
    const periodKey = `${targetDate.getFullYear()}-M${String(targetDate.getMonth() + 1).padStart(2, "0")}`;
    const cycle = await prisma.monitoringCycle.findFirst({
      where: { projectId, periodKey },
    });

    if (cycle) {
      console.log(`Processing cycle: ${cycle.id} (${periodKey}) for project ${projectId}...`);
      await monitoringService.processCycle(cycle.id);
    }

    return NextResponse.json({
      success: true,
      message: `Monitoring cycle successfully triggered and processed for ${periodKey}.`,
    });
  } catch (error: any) {
    console.error("Trigger MRV Cycle Error:", error);
    return NextResponse.json(
      { error: error.message || "Failed to trigger MRV cycle." },
      { status: 500 }
    );
  }
}
