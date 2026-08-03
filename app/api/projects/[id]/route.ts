import { NextRequest, NextResponse } from "next/server";
import { ProjectService } from "@/lib/services/project-service";
import { projectUpdateSchema } from "@/lib/validators/project-schemas";
import { Role } from "@prisma/client";

export const dynamic = "force-dynamic";

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const userId = request.headers.get("x-user-id");
    if (!userId) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { id } = await params;
    const project = await ProjectService.getProject(id);

    if (!project) {
      return NextResponse.json({ error: "Project not found" }, { status: 404 });
    }

    const userRole = request.headers.get("x-user-role") as Role;
    if (userRole !== Role.ADMIN && project.ownerId !== userId) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 403 });
    }

    return NextResponse.json({ project });
  } catch (error: any) {
    console.error("Get Project Error:", error);
    return NextResponse.json({ error: error.message || "Failed to fetch project details." }, { status: 500 });
  }
}

export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const userId = request.headers.get("x-user-id");
    if (!userId) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { id } = await params;
    const body = await request.json();

    const validation = projectUpdateSchema.safeParse(body);
    if (!validation.success) {
      return NextResponse.json({ error: validation.error.issues[0].message }, { status: 400 });
    }

    const project = await ProjectService.updateDraft(id, userId, validation.data);

    return NextResponse.json({ success: true, project });
  } catch (error: any) {
    console.error("Update Project Error:", error);
    return NextResponse.json({ error: error.message || "Failed to update project." }, { status: 500 });
  }
}
