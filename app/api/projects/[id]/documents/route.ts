import { NextRequest, NextResponse } from "next/server";
import { ProjectService } from "@/lib/services/project-service";
import { getEnv } from "@/db";
import { DocumentType } from "@prisma/client";

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

    const formData = await request.formData();
    const file = formData.get("file") as File | null;
    const categoryString = formData.get("category") as string | null;

    if (!file || !categoryString) {
      return NextResponse.json({ error: "File and category are required." }, { status: 400 });
    }

    const categories = Object.values(DocumentType) as string[];
    if (!categories.includes(categoryString)) {
      return NextResponse.json({ error: `Invalid document category. Must be one of: ${categories.join(", ")}` }, { status: 400 });
    }
    const category = categoryString as DocumentType;

    const MAX_SIZE = 15 * 1024 * 1024;
    if (file.size > MAX_SIZE) {
      return NextResponse.json({ error: "File size exceeds 15MB limit." }, { status: 400 });
    }

    const ALLOWED_TYPES = ["application/pdf", "image/jpeg", "image/png"];
    if (!ALLOWED_TYPES.includes(file.type)) {
      return NextResponse.json({ error: "Invalid file type. Only PDF, JPG, and PNG are allowed." }, { status: 400 });
    }

    const uuid = crypto.randomUUID();
    const objectKey = `projects/${id}/${category.toLowerCase()}/${uuid}-${file.name}`;

    const arrayBuffer = await file.arrayBuffer();

    const { EVIDENCE } = getEnv();
    if (!EVIDENCE) {
      return NextResponse.json({ error: "Cloudflare R2 service is unavailable." }, { status: 500 });
    }
    await EVIDENCE.put(objectKey, arrayBuffer, {
      httpMetadata: { contentType: file.type },
    });

    const documentRecord = await ProjectService.addDocument(id, userId, {
      category,
      fileName: file.name,
      objectKey,
      contentType: file.type,
      sizeBytes: file.size,
    });

    return NextResponse.json({ success: true, document: documentRecord });
  } catch (error: any) {
    console.error("Document Upload Error:", error);
    return NextResponse.json({ error: error.message || "Failed to upload document." }, { status: 500 });
  }
}
