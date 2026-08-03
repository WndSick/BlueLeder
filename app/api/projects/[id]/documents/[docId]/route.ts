import { NextRequest, NextResponse } from "next/server";
import { getEnv } from "@/db";
import { prisma } from "@/lib/prisma-client";
import { Role } from "@prisma/client";

export const dynamic = "force-dynamic";

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string; docId: string }> }
) {
  try {
    const userId = request.headers.get("x-user-id");
    if (!userId) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { id, docId } = await params;

    const document = await prisma.document.findUnique({
      where: { id: docId },
      include: { project: true },
    });

    if (!document || document.projectId !== id) {
      return NextResponse.json({ error: "Document not found" }, { status: 404 });
    }

    const userRole = request.headers.get("x-user-role") as Role;
    if (userRole !== Role.ADMIN && document.project.ownerId !== userId) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 403 });
    }

    const { EVIDENCE } = getEnv();
    if (!EVIDENCE) {
      return NextResponse.json({ error: "R2 service is unavailable" }, { status: 500 });
    }

    const file = await EVIDENCE.get(document.objectKey);
    if (!file) {
      return NextResponse.json({ error: "File not found in storage" }, { status: 404 });
    }

    return new Response(file.body, {
      headers: {
        "Content-Type": document.contentType,
        "Content-Disposition": `inline; filename="${encodeURIComponent(document.fileName)}"`,
      },
    });
  } catch (error: any) {
    console.error("Download Document Error:", error);
    return NextResponse.json({ error: error.message || "Failed to download document." }, { status: 500 });
  }
}
