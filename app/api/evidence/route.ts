import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma-client";
import { getEnv } from "@/db";

export const dynamic = "force-dynamic";

type Role = "NGO" | "COMMUNITY" | "ADMIN" | "VERIFIER" | "BUYER";

const sourceTypes = new Set(["field_photo", "sensor", "drone", "satellite"]);
const monitoringStages = new Set(["baseline", "quarterly", "annual"]);
const reviewDecisions = new Set(["approved", "rejected", "clarification_requested"]);
const imageTypes = new Set(["image/jpeg", "image/png", "image/webp"]);

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

async function getProfile(email: string) {
  return prisma.user.findUnique({
    where: { email },
  });
}

async function accessibleProjects(email: string, role: Role) {
  if (role === "ADMIN" || role === "VERIFIER" || role === "BUYER") {
    return prisma.project.findMany({
      where: { status: "APPROVED" },
      orderBy: { name: "asc" },
    });
  }
  return prisma.project.findMany({
    where: {
      owner: { email },
      status: "APPROVED",
    },
    orderBy: { name: "asc" },
  });
}

async function canAccessProject(projectId: string, email: string, role: Role) {
  const project = await prisma.project.findUnique({
    where: { id: projectId },
  });
  if (!project || project.status !== "APPROVED") return null;
  if (["ADMIN", "VERIFIER", "BUYER"].includes(role) || project.ownerId === email) {
    return project;
  }
  
  // also check by querying user profile ID
  const user = await getProfile(email);
  if (user && project.ownerId === user.id) {
    return project;
  }
  return null;
}

export async function GET(request: NextRequest) {
  const user = identity(request);
  if (!user) return jsonError("Sign in is required.", 401);

  const profile = await getProfile(user.email);
  if (!profile) return jsonError("Account not found. Please sign in again.", 403);

  const fileId = request.nextUrl.searchParams.get("fileId");
  if (fileId) {
    const storedFile = await prisma.evidenceFile.findUnique({
      where: { id: fileId },
    });
    if (!storedFile) return jsonError("Evidence file not found.", 404);

    const project = await prisma.project.findUnique({
      where: { id: storedFile.projectId },
    });
    if (!project) return jsonError("Project not found.", 404);

    const privileged = ["ADMIN", "VERIFIER", "BUYER"].includes(profile.role);
    if (
      project.status !== "APPROVED" ||
      (!privileged && project.ownerId !== profile.id)
    ) {
      return jsonError("You do not have access to this evidence.", 403);
    }

    const { EVIDENCE } = getEnv();
    const object = await EVIDENCE.get(storedFile.objectKey);
    if (!object) return jsonError("Stored evidence is unavailable.", 404);

    return new NextResponse(object.body, {
      headers: {
        "content-type": storedFile.contentType,
        "content-disposition": `inline; filename="${storedFile.fileName.replaceAll('"', "")}"`,
        "x-content-sha256": storedFile.sha256,
        "cache-control": "private, no-store",
      },
    });
  }

  const projects = await accessibleProjects(user.email, profile.role);
  const requestedProjectId = request.nextUrl.searchParams.get("projectId");
  const selectedProject =
    projects.find((project) => String(project.id) === requestedProjectId) ??
    projects[0] ??
    null;

  if (!selectedProject) {
    return NextResponse.json({ projects: [], selectedProjectId: null, evidence: [] });
  }

  const items = await prisma.evidenceItem.findMany({
    where: { projectId: selectedProject.id },
    orderBy: [{ observedAt: "desc" }, { createdAt: "desc" }],
  });

  const files = await prisma.evidenceFile.findMany({
    where: { projectId: selectedProject.id },
    orderBy: { uploadedAt: "asc" },
  });

  const reviews = await prisma.evidenceReview.findMany({
    where: { projectId: selectedProject.id },
    orderBy: { createdAt: "asc" },
  });

  return NextResponse.json({
    projects,
    selectedProjectId: selectedProject.id,
    evidence: items.map((item) => {
      let data = {};
      try {
        data = JSON.parse(item.dataJson);
      } catch {}
      return {
        id: item.id,
        project_id: item.projectId,
        source_type: item.sourceType,
        monitoring_stage: item.monitoringStage,
        period_label: item.periodLabel,
        observed_at: item.observedAt.toISOString(),
        uploader_email: item.uploaderEmail,
        created_at: item.createdAt.toISOString(),
        data,
        files: files
          .filter((file) => file.evidenceId === item.id)
          .map((f) => ({
            id: f.id,
            evidence_id: f.evidenceId,
            project_id: f.projectId,
            file_role: f.fileRole,
            file_name: f.fileName,
            content_type: f.contentType,
            size_bytes: f.sizeBytes,
            sha256: f.sha256,
            uploaded_at: f.uploadedAt.toISOString(),
          })),
        reviews: reviews
          .filter((review) => review.evidenceId === item.id)
          .map((r) => ({
            id: r.id,
            evidence_id: r.evidenceId,
            project_id: r.projectId,
            reviewer_email: r.reviewerEmail,
            decision: r.decision,
            comment: r.comment,
            created_at: r.createdAt.toISOString(),
          })),
      };
    }),
  });
}

function numberInRange(value: FormDataEntryValue | null, min: number, max: number) {
  if (value === null || String(value).trim() === "") return null;
  const number = Number(value);
  return Number.isFinite(number) && number >= min && number <= max ? number : null;
}

function safeDate(value: string) {
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? null : date;
}

async function sha256Hex(buffer: ArrayBuffer) {
  const digest = await crypto.subtle.digest("SHA-256", buffer);
  return [...new Uint8Array(digest)]
    .map((byte) => byte.toString(16).padStart(2, "0"))
    .join("");
}

export async function POST(request: NextRequest) {
  const user = identity(request);
  if (!user) return jsonError("Sign in is required.", 401);

  const profile = await getProfile(user.email);
  if (!profile) return jsonError("Account not found. Please sign in again.", 403);

  const form = await request.formData();
  const action = String(form.get("action") ?? "");
  const now = new Date();

  if (action === "submit_evidence") {
    if (!["NGO", "COMMUNITY"].includes(profile.role)) {
      return jsonError("Your role cannot submit monitoring evidence.", 403);
    }
    const projectId = String(form.get("projectId") ?? "");
    const project = await canAccessProject(projectId, user.email, profile.role);
    if (!project || project.ownerId !== profile.id) {
      return jsonError("Only the responsible project account can submit evidence.", 403);
    }
    const sourceType = String(form.get("sourceType") ?? "");
    const monitoringStage = String(form.get("monitoringStage") ?? "");
    const periodLabel = String(form.get("periodLabel") ?? "").trim();
    const observedAt = safeDate(String(form.get("observedAt") ?? ""));
    if (!sourceTypes.has(sourceType)) return jsonError("Select a valid evidence source.");
    if (!monitoringStages.has(monitoringStage)) return jsonError("Select a monitoring period.");
    if (!periodLabel) return jsonError("Add a monitoring period label.");
    if (!observedAt) return jsonError("Add a valid observation date and time.");
    if (observedAt.getTime() > Date.now() + 5 * 60 * 1000) {
      return jsonError("Observation time cannot be in the future.");
    }

    let data: Record<string, string | number | null> = {};
    const fileInputs: Array<{ role: string; file: File }> = [];

    if (sourceType === "field_photo") {
      const latitude = numberInRange(form.get("latitude"), -90, 90);
      const longitude = numberInRange(form.get("longitude"), -180, 180);
      const saplings = numberInRange(form.get("saplings"), 0, 10_000_000);
      const survival = numberInRange(form.get("survivalPercent"), 0, 100);
      const species = String(form.get("species") ?? "").trim();
      const notes = String(form.get("notes") ?? "").trim();
      if (latitude === null || longitude === null) return jsonError("Valid GPS coordinates are required.");
      if (saplings === null) return jsonError("Enter the number of saplings.");
      if (survival === null) return jsonError("Enter a survival observation from 0 to 100%.");
      if (!species) return jsonError("Add the planted species.");
      if (!notes) return jsonError("Add field observations.");
      const photo = form.get("photo");
      if (!(photo instanceof File) || photo.size === 0) return jsonError("A GPS-linked field photo is required.");
      fileInputs.push({ role: "field_photo", file: photo });
      data = { latitude, longitude, species, saplings, survivalPercent: survival, notes };
    }

    if (sourceType === "sensor") {
      const sensorId = String(form.get("sensorId") ?? "").trim();
      const salinity = numberInRange(form.get("salinity"), 0, 100);
      const waterLevel = numberInRange(form.get("waterLevel"), -100, 100);
      const soilMoisture = numberInRange(form.get("soilMoisture"), 0, 100);
      const temperature = numberInRange(form.get("temperature"), -20, 80);
      if (!sensorId) return jsonError("Sensor ID is required.");
      if ([salinity, waterLevel, soilMoisture, temperature].every((value) => value === null)) {
        return jsonError("Add at least one sensor reading.");
      }
      data = { sensorId, salinity, waterLevel, soilMoisture, temperature };
    }

    if (sourceType === "drone") {
      const surveyImage = form.get("surveyImage");
      if (!(surveyImage instanceof File) || surveyImage.size === 0) {
        return jsonError("A drone survey image is required.");
      }
      fileInputs.push({ role: "survey_image", file: surveyImage });
      const beforeImage = form.get("beforeImage");
      if (beforeImage instanceof File && beforeImage.size > 0) {
        fileInputs.push({ role: "before_image", file: beforeImage });
      }
      data = {
        flightId: String(form.get("flightId") ?? "").trim(),
        altitudeMetres: numberInRange(form.get("altitudeMetres"), 0, 5000),
        groundResolutionCm: numberInRange(form.get("groundResolutionCm"), 0, 1000),
        notes: String(form.get("notes") ?? "").trim(),
      };
    }

    if (sourceType === "satellite") {
      const sceneId = String(form.get("sceneId") ?? "").trim();
      const platform = String(form.get("platform") ?? "").trim();
      const cloudCover = numberInRange(form.get("cloudCover"), 0, 100);
      const ndviValue = numberInRange(form.get("ndviValue"), -1, 1);
      if (!sceneId || !platform) return jsonError("Satellite platform and scene ID are required.");
      if (cloudCover === null) return jsonError("Cloud cover must be between 0 and 100%.");
      const beforeImage = form.get("beforeImage");
      const afterImage = form.get("afterImage");
      if (beforeImage instanceof File && beforeImage.size > 0) {
        fileInputs.push({ role: "before_image", file: beforeImage });
      }
      if (afterImage instanceof File && afterImage.size > 0) {
        fileInputs.push({ role: "after_image", file: afterImage });
      }
      data = {
        sceneId,
        platform,
        cloudCover,
        ndviValue,
        imageDate: observedAt.toISOString(),
        notes: String(form.get("notes") ?? "").trim(),
      };
    }

    for (const { file } of fileInputs) {
      if (file.size > 25 * 1024 * 1024) return jsonError(`${file.name} exceeds 25 MB.`);
      if (!imageTypes.has(file.type)) return jsonError(`${file.name} must be a JPG, PNG or WebP image.`);
    }

    const evidenceId = crypto.randomUUID();
    const storedFiles: Array<{
      role: string;
      fileName: string;
      objectKey: string;
      contentType: string;
      size: number;
      hash: string;
    }> = [];

    const { EVIDENCE } = getEnv();

    for (const { role, file } of fileInputs) {
      const bytes = await file.arrayBuffer();
      const hash = await sha256Hex(bytes);
      const safeName = file.name.replace(/[^a-zA-Z0-9._-]/g, "-");
      const objectKey = `mrv/${projectId}/${evidenceId}/${crypto.randomUUID()}-${safeName}`;
      await EVIDENCE.put(objectKey, bytes, {
        httpMetadata: { contentType: file.type },
        customMetadata: {
          sha256: hash,
          projectId,
          evidenceId,
          sourceType,
          uploader: user.email,
          uploadedAt: now.toISOString(),
        },
      });
      storedFiles.push({
        role,
        fileName: file.name,
        objectKey,
        contentType: file.type,
        size: file.size,
        hash,
      });
    }

    await prisma.$transaction([
      prisma.evidenceItem.create({
        data: {
          id: evidenceId,
          projectId,
          sourceType,
          monitoringStage,
          periodLabel,
          observedAt,
          uploaderEmail: user.email,
          dataJson: JSON.stringify(data),
        },
      }),
      ...storedFiles.map((file) =>
        prisma.evidenceFile.create({
          data: {
            evidenceId,
            projectId,
            fileRole: file.role,
            fileName: file.fileName,
            objectKey: file.objectKey,
            contentType: file.contentType,
            sizeBytes: file.size,
            sha256: file.hash,
          },
        })
      ),
    ]);

    return NextResponse.json({ ok: true, evidenceId }, { status: 201 });
  }

  if (action === "review_evidence") {
    if (!["ADMIN", "VERIFIER"].includes(profile.role)) {
      return jsonError("Technical verifier access is required.", 403);
    }
    const evidenceId = String(form.get("evidenceId") ?? "");
    const decision = String(form.get("decision") ?? "");
    const comment = String(form.get("comment") ?? "").trim();
    if (!reviewDecisions.has(decision)) return jsonError("Select a valid review decision.");
    if (decision !== "approved" && !comment) {
      return jsonError("A review comment is required for rejection or clarification.");
    }
    const evidence = await prisma.evidenceItem.findUnique({
      where: { id: evidenceId },
    });
    if (!evidence) return jsonError("Evidence item not found.", 404);

    const project = await prisma.project.findUnique({
      where: { id: evidence.projectId },
    });
    if (!project || project.status !== "APPROVED") {
      return jsonError("Project is not approved for MRV.", 400);
    }

    await prisma.evidenceReview.create({
      data: {
        evidenceId,
        projectId: evidence.projectId,
        reviewerEmail: user.email,
        decision,
        comment: comment || null,
      },
    });

    return NextResponse.json({ ok: true }, { status: 201 });
  }

  return jsonError("Unknown action.");
}
