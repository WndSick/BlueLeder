import { NextRequest, NextResponse } from "next/server";
import { broadcastWorker } from "@/lib/services/blockchain/broadcast-worker";

export const dynamic = "force-dynamic";

export async function POST(request: NextRequest) {
  try {
    const result = await broadcastWorker.processPendingEvents(20);
    return NextResponse.json({
      success: true,
      result,
    });
  } catch (error: any) {
    return NextResponse.json({ error: error.message || "Worker processing error." }, { status: 500 });
  }
}
