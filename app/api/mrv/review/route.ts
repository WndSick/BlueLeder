import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma-client";

export const dynamic = "force-dynamic";

export async function POST(request: NextRequest) {
  try {
    const userId = request.headers.get("x-user-id");
    const userEmail = request.headers.get("x-user-email") || "verifier";
    const role = request.headers.get("x-user-role");

    if (!userId || !role) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    // Only VERIFIER and ADMIN roles can verify MRV reports
    if (!["ADMIN", "VERIFIER"].includes(role)) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    const body = await request.json();
    const { reportId, status, comment } = body;

    if (!reportId || !status) {
      return NextResponse.json(
        { error: "reportId and status are required" },
        { status: 400 }
      );
    }

    if (!["verified", "flagged"].includes(status)) {
      return NextResponse.json(
        { error: "Invalid status. Must be 'verified' or 'flagged'." },
        { status: 400 }
      );
    }

    // Update Automated MRV Report
    const updatedReport = await prisma.automatedMrvReport.update({
      where: { id: reportId },
      data: {
        verificationStatus: status,
        verifierComment: comment || null,
        verifiedAt: new Date(),
        verifiedById: userId,
      },
    });

    // Create Timeline entry
    await prisma.mrvReportTimeline.create({
      data: {
        reportId: updatedReport.id,
        status: status.toUpperCase(),
        note: comment || `Report marked as ${status} by verifier.`,
        actorEmail: userEmail,
      },
    });

    return NextResponse.json({
      success: true,
      report: updatedReport,
    });
  } catch (error: any) {
    console.error("Review MRV Report Error:", error);
    return NextResponse.json(
      { error: error.message || "Failed to review MRV report." },
      { status: 500 }
    );
  }
}
