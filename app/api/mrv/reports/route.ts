import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma-client";

export const dynamic = "force-dynamic";

export async function GET(request: NextRequest) {
  try {
    const userId = request.headers.get("x-user-id");
    if (!userId) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { searchParams } = new URL(request.url);
    const projectId = searchParams.get("projectId");

    if (!projectId) {
      return NextResponse.json({ error: "projectId is required" }, { status: 400 });
    }

    // Fetch baseline
    const baseline = await prisma.baselineAnalysis.findUnique({
      where: { projectId },
    });

    // Fetch all monitoring cycles along with vegetation analyses and MRV reports
    const cycles = await prisma.monitoringCycle.findMany({
      where: { projectId },
      include: {
        satelliteScenes: true,
        vegetation: true,
        mrvReport: {
          include: {
            timeline: {
              orderBy: { createdAt: "desc" },
            },
          },
        },
      },
      orderBy: { scheduledAt: "desc" },
    });

    return NextResponse.json({
      success: true,
      baseline,
      cycles,
    });
  } catch (error: any) {
    console.error("Fetch MRV Reports Error:", error);
    return NextResponse.json(
      { error: error.message || "Failed to fetch MRV reports." },
      { status: 500 }
    );
  }
}
