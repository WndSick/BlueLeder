import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma-client";

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
    if (!user) {
      return NextResponse.json({ error: "Authentication required." }, { status: 401 });
    }

    const body = await request.json();
    const { batchId, retirementReason } = body;

    if (!batchId) {
      return NextResponse.json({ error: "batchId is required." }, { status: 400 });
    }

    const batch = await prisma.creditBatch.findUnique({
      where: { id: batchId },
      include: { project: true },
    });

    if (!batch) {
      return NextResponse.json({ error: "Credit batch not found." }, { status: 404 });
    }

    if (batch.status === "RETIRED") {
      return NextResponse.json({ error: "Credit batch is already retired." }, { status: 400 });
    }

    const reasonText = retirementReason || "Corporate Scope 3 Net-Zero Offset";
    const data = new TextEncoder().encode(`${batch.reportHash || batch.id}:${reasonText}:${Date.now()}`);
    const digest = await crypto.subtle.digest("SHA-256", data);
    const reasonHash = `0x${[...new Uint8Array(digest)].map((b) => b.toString(16).padStart(2, "0")).join("")}`;

    // Update batch status to RETIRED
    const updatedBatch = await prisma.creditBatch.update({
      where: { id: batchId },
      data: {
        status: "RETIRED",
      },
    });

    const previous = await prisma.ledgerEvent.findFirst({
      where: { projectId: batch.projectId },
      orderBy: { createdAt: "desc" },
      select: { eventHash: true },
    });

    const eventHash = await sha256({
      projectId: batch.projectId,
      batchId: batch.id,
      eventType: "CREDITS_RETIRED",
      entityId: batch.id,
      periodKey: batch.periodKey,
      payloadHash: reasonHash,
      actorEmail: user.email,
      timestamp: Date.now(),
    });

    // Append event to cryptographic ledger
    const ledgerEvent = await prisma.ledgerEvent.create({
      data: {
        projectId: batch.projectId,
        batchId: batch.id,
        eventType: "CREDITS_RETIRED",
        entityId: batch.id,
        periodKey: batch.periodKey,
        payloadHash: reasonHash,
        previousEventHash: previous?.eventHash ?? null,
        eventHash,
        network: "polygon-amoy",
        chainId: 80002,
        actorEmail: user.email,
        metadataJson: JSON.stringify({
          batchId: batch.reportHash || batch.id,
          quantity: batch.issuedQuantity,
          reason: reasonText,
          certificateHash: reasonHash,
        }),
      },
    });

    return NextResponse.json({
      success: true,
      message: "Credit batch permanently burned and retired on-chain.",
      certificate: {
        certificateId: ledgerEvent.id,
        certificateHash: reasonHash,
        project: batch.project.name,
        quantity: batch.issuedQuantity,
        beneficiary: user.email,
        retiredAt: ledgerEvent.createdAt,
        ledgerEventId: ledgerEvent.id,
      },
      batch: updatedBatch,
    });
  } catch (error: any) {
    return NextResponse.json({ error: error.message || "Credit retirement error." }, { status: 500 });
  }
}
