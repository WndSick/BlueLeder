import { NextRequest, NextResponse } from "next/server";
import { getScientificConfig, CURRENT_ALGORITHM_VERSION } from "@/lib/config/scientific-config";

export const dynamic = "force-dynamic";

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const version = searchParams.get("version") || CURRENT_ALGORITHM_VERSION;

    const config = getScientificConfig(version);

    return NextResponse.json({
      success: true,
      config,
    });
  } catch (error: any) {
    return NextResponse.json(
      { error: error.message || "Failed to fetch scientific configuration." },
      { status: 500 }
    );
  }
}
