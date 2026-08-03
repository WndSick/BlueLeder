import { NextRequest, NextResponse } from "next/server";
import { ProjectService } from "@/lib/services/project-service";

export const dynamic = "force-dynamic";

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const userId = request.headers.get("x-user-id");
    if (!userId) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { id } = await params;
    const project = await ProjectService.submitProject(id, userId);

    return NextResponse.json({ success: true, project });
  } catch (error: any) {
    console.error("Submit Project Error:", error);
    return NextResponse.json({ error: error.message || "Failed to submit project." }, { status: 500 });
  }
}
