import { NextRequest, NextResponse } from "next/server";
import { ProjectService } from "@/lib/services/project-service";
import { Role } from "@prisma/client";

export const dynamic = "force-dynamic";

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const userId = request.headers.get("x-user-id");
    const userRoleString = request.headers.get("x-user-role");

    if (!userId || !userRoleString) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const userRole = userRoleString as Role;
    const { id } = await params;
    const body = await request.json();

    const { action, note = "" } = body;

    let project;
    if (action === "START") {
      project = await ProjectService.startReview(id, userId, userRole);
    } else if (action === "APPROVE") {
      project = await ProjectService.approveProject(id, userId, userRole, note);
    } else if (action === "REJECT") {
      project = await ProjectService.rejectProject(id, userId, userRole, note);
    } else if (action === "REQUEST_CHANGES") {
      project = await ProjectService.requestChanges(id, userId, userRole, note);
    } else {
      return NextResponse.json({ error: "Invalid review action." }, { status: 400 });
    }

    return NextResponse.json({ success: true, project });
  } catch (error: any) {
    console.error("Review Project Error:", error);
    return NextResponse.json({ error: error.message || "Failed to submit review." }, { status: 500 });
  }
}
