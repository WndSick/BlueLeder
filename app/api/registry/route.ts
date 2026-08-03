import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma-client";
import { getEnv } from "@/db";

export const dynamic = "force-dynamic";

const roles = new Set(["NGO", "COMMUNITY", "ADMIN", "VERIFIER", "BUYER"]);
const reviewStatuses = new Set([
  "document_review",
  "approved_for_mrv",
  "changes_requested",
  "rejected",
]);

function identity(request: NextRequest) {
  const userId = request.headers.get("x-user-id");
  const email = request.headers.get("x-user-email");
  const role = request.headers.get("x-user-role");

  if (!userId || !email || !role) return null;
  return { id: userId, email, role };
}

function jsonError(message: string, status = 400) {
  return NextResponse.json({ error: message }, { status });
}

export async function GET(request: NextRequest) {
  const user = identity(request);
  if (!user) return jsonError("Sign in is required.", 401);

  const profile = await prisma.user.findUnique({
    where: { id: user.id },
  });
  if (!profile) return jsonError("Account not found. Please sign in again.", 401);

  const isAdmin = profile.role === "ADMIN";
  const canObserveApproved = profile.role === "VERIFIER" || profile.role === "BUYER";

  const documentId = request.nextUrl.searchParams.get("documentId");
  if (documentId) {
    const document = await prisma.document.findUnique({
      where: { id: documentId },
      include: { project: true },
    });

    if (!document) return jsonError("Document not found.", 404);
    if (!isAdmin && document.project.ownerId !== user.id) {
      return jsonError("You do not have access to this document.", 403);
    }

    const { EVIDENCE } = getEnv();
    const object = await EVIDENCE.get(document.objectKey);
    if (!object) return jsonError("Stored document is unavailable.", 404);

    return new NextResponse(object.body, {
      headers: {
        "content-type": document.contentType,
        "content-disposition": `inline; filename="${document.fileName.replaceAll('"', "")}"`,
        "cache-control": "private, no-store",
      },
    });
  }

  // Fetch projects
  let projects: any[] = [];
  if (isAdmin) {
    projects = await prisma.project.findMany({
      orderBy: { submittedAt: "desc" },
      include: { documents: true },
    });
  } else if (canObserveApproved) {
    projects = await prisma.project.findMany({
      where: { status: "APPROVED" },
      orderBy: { submittedAt: "desc" },
      include: { documents: true },
    });
  } else {
    projects = await prisma.project.findMany({
      where: { ownerId: user.id },
      orderBy: { submittedAt: "desc" },
      include: { documents: true },
    });
  }

  return NextResponse.json({
    identity: { email: user.email, name: profile.fullName },
    profile: {
      email: profile.email,
      full_name: profile.fullName,
      role: profile.role,
      organization: profile.organization || "",
      registration_number: profile.registrationNumber || "",
      organization_type: profile.organizationType || "",
      website: profile.website || "",
      contact_phone: profile.contactPhone || "",
      verification_status: profile.verificationStatus,
    },
    projects: projects.map((p) => ({
      id: p.id,
      owner_email: profile.email,
      name: p.name,
      ecosystem: p.ecosystem,
      state: p.state,
      district: p.district,
      village: p.village,
      start_date: p.startDate,
      duration_years: p.durationYears,
      responsible_organization: p.responsibleOrganization,
      community_partner: p.communityPartner,
      boundary_geojson: p.boundaryGeojson,
      area_hectares: p.areaHectares,
      status: p.status,
      reviewer_note: p.reviewerNote,
      submitted_at: p.submittedAt.toISOString(),
      updated_at: p.updatedAt.toISOString(),
      documents: p.documents.map((d: any) => ({
        id: d.id,
        project_id: d.projectId,
        category: d.category,
        file_name: d.fileName,
        content_type: d.contentType,
        size_bytes: d.sizeBytes,
        uploaded_at: d.uploadedAt.toISOString(),
      })),
    })),
  });
}

export async function POST(request: NextRequest) {
  const user = identity(request);
  if (!user) return jsonError("Sign in is required.", 401);

  const profile = await prisma.user.findUnique({
    where: { id: user.id },
  });
  if (!profile) return jsonError("Account not found. Please sign in again.", 403);

  const form = await request.formData();
  const action = String(form.get("action") ?? "");

  if (action === "switch_demo_role") {
    if (user.email !== "demo@blueregistry.local") {
      return jsonError("Role switching is available only in the isolated SIH demo account.", 403);
    }
    const role = String(form.get("role") ?? "").toUpperCase();
    if (!roles.has(role)) return jsonError("Select a valid demo role.");

    await prisma.user.update({
      where: { id: user.id },
      data: { role: role as any },
    });

    return NextResponse.json({ ok: true, role });
  }

  if (action === "save_profile") {
    const role = String(form.get("role") ?? "").toUpperCase();
    if (!roles.has(role)) return jsonError("Select a valid role.");

    if (role === "VERIFIER" && profile.role !== "VERIFIER" && profile.role !== "ADMIN") {
      return jsonError("Technical verifier roles must be assigned by an administrator.");
    }
    if (role === "ADMIN" && profile.role !== "ADMIN") {
      return jsonError("Administrator roles must be assigned by an existing administrator.");
    }

    await prisma.user.update({
      where: { id: user.id },
      data: {
        fullName: String(form.get("fullName") ?? profile.fullName),
        organization: String(form.get("organization") ?? ""),
        registrationNumber: String(form.get("registrationNumber") ?? ""),
        organizationType: String(form.get("organizationType") ?? ""),
        website: String(form.get("website") ?? ""),
        contactPhone: String(form.get("contactPhone") ?? ""),
      },
    });

    return NextResponse.json({ ok: true });
  }

  return jsonError("Unknown action.");
}
