import { NextRequest, NextResponse } from "next/server";
import { ProjectService } from "@/lib/services/project-service";
import { projectCreateSchema } from "@/lib/validators/project-schemas";
import { Role } from "@prisma/client";

export const dynamic = "force-dynamic";

export async function GET(request: NextRequest) {
  try {
    const userId = request.headers.get("x-user-id");
    const userRoleString = request.headers.get("x-user-role");

    if (!userId || !userRoleString) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const userRole = userRoleString as Role;
    const projects = await ProjectService.listProjects(userId, userRole);

    return NextResponse.json({ projects });
  } catch (error: any) {
    console.error("List Projects Error:", error);
    return NextResponse.json({ error: error.message || "Failed to fetch projects." }, { status: 500 });
  }
}

export async function POST(request: NextRequest) {
  try {
    const userId = request.headers.get("x-user-id");
    const userRoleString = request.headers.get("x-user-role");

    if (!userId || !userRoleString) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const userRole = userRoleString as Role;
    const body = await request.json();

    const validation = projectCreateSchema.safeParse(body);
    if (!validation.success) {
      return NextResponse.json({ error: validation.error.issues[0].message }, { status: 400 });
    }

    const project = await ProjectService.createDraft(userId, userRole, validation.data);

    return NextResponse.json({ success: true, project }, { status: 201 });
  } catch (error: any) {
    console.error("Create Draft Error:", error);
    return NextResponse.json({ error: error.message || "Failed to create project draft." }, { status: 500 });
  }
}
