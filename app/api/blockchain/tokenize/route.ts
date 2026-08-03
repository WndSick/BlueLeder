import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma-client";
import { computeKeccak256TokenId } from "@/lib/services/blockchain/viem-client";

export const dynamic = "force-dynamic";

function identity(request: NextRequest) {
  const userId = request.headers.get("x-user-id");
  const email = request.headers.get("x-user-email");
  const role = request.headers.get("x-user-role");

  if (!userId || !email || !role) return null;
  return { id: userId, email, role };
}

async function sha256(value: unknown) {
  const bytes = new TextEncoder().encode(typeof value === "string" ? value : JSON.stringify(value));
  const digest = await crypto.subtle.digest("SHA-256", bytes);
  return `0x${[...new Uint8Array(digest)].map((b) => b.toString(16).padStart(2, "0")).join("")}`;
}

export async function POST(request: NextRequest) {
  try {
    const user = identity(request);
    if (!user || !["ADMIN", "VERIFIER"].includes(user.role)) {
      return NextResponse.json({ error: "Unauthorized verifier access required." }, { status: 403 });
    }

    const body = await request.json();
    const { reportId } = body;

    if (!reportId) {
      return NextResponse.json({ error: "reportId is required." }, { status: 400 });
    }

    const report = await prisma.automatedMrvReport.findUnique({
      where: { id: reportId },
      include: { cycle: { include: { project: true } } },
    });

    if (!report) {
      return NextResponse.json({ error: "MRV report not found." }, { status: 404 });
    }

    if (report.verificationStatus !== "verified") {
      return NextResponse.json({ error: "Report must be verified before tokenization." }, { status: 400 });
    }

    const projectId = report.cycle.projectId;
    const periodKey = report.cycle.periodKey;
    const tokenId = await computeKeccak256TokenId(projectId, periodKey);

    const areaHectares = report.cycle.project.areaHectares;
    const estimatedGain = Math.max(1, Math.floor(areaHectares * 12.4 * 0.47 * (44 / 12) * (1 / 12)));

    // Upsert Credit Batch
    const batch = await prisma.creditBatch.upsert({
      where: {
        projectId_periodKey: {
          projectId,
          periodKey,
        },
      },
      update: {
        reportHash: tokenId,
        status: "ISSUED",
      },
      create: {
        projectId,
        periodKey,
        vintageYear: new Date().getFullYear(),
        reportHash: tokenId,
        issuedQuantity: estimatedGain,
        currentHolder: user.email,
        status: "ISSUED",
        createdBy: user.id,
      },
    });

    // Find previous ledger event hash
    const previous = await prisma.ledgerEvent.findFirst({
      where: { projectId },
      orderBy: { createdAt: "desc" },
      select: { eventHash: true },
    });

    const eventHash = await sha256({
      projectId,
      batchId: batch.id,
      eventType: "CREDITS_ISSUED",
      entityId: batch.id,
      periodKey,
      payloadHash: tokenId,
      actorEmail: user.email,
      timestamp: Date.now(),
    });

    // Record ledger event
    await prisma.ledgerEvent.create({
      data: {
        projectId,
        batchId: batch.id,
        eventType: "CREDITS_ISSUED",
        entityId: batch.id,
        periodKey,
        payloadHash: tokenId,
        previousEventHash: previous?.eventHash ?? null,
        eventHash,
        network: "polygon-amoy",
        chainId: 80002,
        actorEmail: user.email,
        metadataJson: JSON.stringify({
          tokenId,
          quantity: estimatedGain,
          reportId: report.id,
          userId: user.id,
        }),
      },
    });

    return NextResponse.json({
      success: true,
      tokenId,
      quantity: estimatedGain,
      batch,
    });
  } catch (error: any) {
    return NextResponse.json({ error: error.message || "Tokenization error." }, { status: 500 });
  }
}
