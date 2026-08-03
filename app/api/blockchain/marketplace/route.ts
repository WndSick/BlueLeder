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

export async function GET(request: NextRequest) {
  try {
    const batches = await prisma.creditBatch.findMany({
      include: {
        project: true,
      },
      orderBy: { createdAt: "desc" },
    });

    return NextResponse.json({
      success: true,
      listings: batches,
    });
  } catch (error: any) {
    return NextResponse.json({ error: error.message || "Failed to fetch marketplace listings." }, { status: 500 });
  }
}

export async function POST(request: NextRequest) {
  try {
    const user = identity(request);
    if (!user) {
      return NextResponse.json({ error: "Authentication required." }, { status: 401 });
    }

    const body = await request.json();
    const { batchId, action } = body;

    if (!batchId || !action) {
      return NextResponse.json({ error: "batchId and action required." }, { status: 400 });
    }

    const batch = await prisma.creditBatch.findUnique({
      where: { id: batchId },
      include: { project: true },
    });

    if (!batch) {
      return NextResponse.json({ error: "Credit batch not found." }, { status: 404 });
    }

    if (action === "BUY") {
      const updated = await prisma.creditBatch.update({
        where: { id: batchId },
        data: {
          currentHolder: user.email,
          status: "TRANSFERRED",
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
        eventType: "CREDITS_TRANSFERRED",
        entityId: batch.id,
        periodKey: batch.periodKey,
        payloadHash: batch.reportHash || batch.id,
        actorEmail: user.email,
        timestamp: Date.now(),
      });

      await prisma.ledgerEvent.create({
        data: {
          projectId: batch.projectId,
          batchId: batch.id,
          eventType: "CREDITS_TRANSFERRED",
          entityId: batch.id,
          periodKey: batch.periodKey,
          payloadHash: batch.reportHash || batch.id,
          previousEventHash: previous?.eventHash ?? null,
          eventHash,
          network: "polygon-amoy",
          chainId: 80002,
          actorEmail: user.email,
          metadataJson: JSON.stringify({
            fromOwner: batch.currentHolder,
            toOwner: user.email,
            quantity: batch.issuedQuantity,
          }),
        },
      });

      return NextResponse.json({ success: true, message: "Credit batch acquired successfully.", batch: updated });
    }

    return NextResponse.json({ error: "Invalid action." }, { status: 400 });
  } catch (error: any) {
    return NextResponse.json({ error: error.message || "Marketplace transaction error." }, { status: 500 });
  }
}
