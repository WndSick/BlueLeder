import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma-client";

export const dynamic = "force-dynamic";

type Role = "NGO" | "COMMUNITY" | "ADMIN" | "VERIFIER" | "BUYER";
type Coordinate = [number, number];

const NETWORK = "polygon-amoy";
const CHAIN_ID = 80002;
const EXPLORER_URL = "https://amoy.polygonscan.com";

const factors: Record<string, { biomass: number; carbon: number }> = {
  mangrove: { biomass: 12.4, carbon: 0.47 },
  seagrass: { biomass: 4.2, carbon: 0.45 },
  salt_marsh: { biomass: 7.1, carbon: 0.46 },
};

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

function stableValue(value: unknown): unknown {
  if (Array.isArray(value)) return value.map(stableValue);
  if (value && typeof value === "object") {
    return Object.fromEntries(
      Object.entries(value as Record<string, unknown>)
        .sort(([a], [b]) => a.localeCompare(b))
        .map(([key, nested]) => [key, stableValue(nested)]),
    );
  }
  return value;
}

function canonicalJson(value: unknown) {
  return JSON.stringify(stableValue(value));
}

async function sha256(value: unknown) {
  const bytes = new TextEncoder().encode(
    typeof value === "string" ? value : canonicalJson(value),
  );
  const digest = await crypto.subtle.digest("SHA-256", bytes);
  return `0x${[...new Uint8Array(digest)]
    .map((byte) => byte.toString(16).padStart(2, "0"))
    .join("")}`;
}

function parsePolygon(value: unknown): Coordinate[] {
  try {
    const geojson = typeof value === "string" ? JSON.parse(value) : value;
    const coordinates = geojson?.geometry?.coordinates?.[0];
    if (!Array.isArray(coordinates)) return [];
    const points = coordinates
      .filter((point: unknown) => Array.isArray(point) && point.length >= 2)
      .map((point: number[]) => [Number(point[0]), Number(point[1])] as Coordinate)
      .filter(([lng, lat]) => Number.isFinite(lng) && Number.isFinite(lat));
    if (
      points.length > 1 &&
      points[0][0] === points[points.length - 1][0] &&
      points[0][1] === points[points.length - 1][1]
    ) {
      return points.slice(0, -1);
    }
    return points;
  } catch {
    return [];
  }
}

function polygonAreaHectares(points: Coordinate[]) {
  if (points.length < 3) return 0;
  const radians = Math.PI / 180;
  const earthRadius = 6_378_137;
  const centerLat = points.reduce((sum, [, lat]) => sum + lat, 0) / points.length;
  const projected = points.map(([lng, lat]) => [
    earthRadius * lng * radians * Math.cos(centerLat * radians),
    earthRadius * lat * radians,
  ]);
  let area = 0;
  for (let index = 0; index < projected.length; index += 1) {
    const [x1, y1] = projected[index];
    const [x2, y2] = projected[(index + 1) % projected.length];
    area += x1 * y2 - x2 * y1;
  }
  return Math.abs(area / 2) / 10_000;
}

function pointInPolygon(point: Coordinate, polygon: Coordinate[]) {
  if (polygon.length < 3) return false;
  const [x, y] = point;
  let inside = false;
  for (let i = 0, j = polygon.length - 1; i < polygon.length; j = i, i += 1) {
    const [xi, yi] = polygon[i];
    const [xj, yj] = polygon[j];
    if (
      yi > y !== yj > y &&
      x < ((xj - xi) * (y - yi)) / (yj - yi || Number.EPSILON) + xi
    ) {
      inside = !inside;
    }
  }
  return inside;
}

function orientation(a: Coordinate, b: Coordinate, c: Coordinate) {
  const value = (b[1] - a[1]) * (c[0] - b[0]) - (b[0] - a[0]) * (c[1] - b[1]);
  if (Math.abs(value) < 1e-12) return 0;
  return value > 0 ? 1 : 2;
}

function onSegment(a: Coordinate, b: Coordinate, c: Coordinate) {
  return (
    b[0] <= Math.max(a[0], c[0]) &&
    b[0] >= Math.min(a[0], c[0]) &&
    b[1] <= Math.max(a[1], c[1]) &&
    b[1] >= Math.min(a[1], c[1])
  );
}

function segmentsIntersect(a1: Coordinate, a2: Coordinate, b1: Coordinate, b2: Coordinate) {
  const o1 = orientation(a1, a2, b1);
  const o2 = orientation(a1, a2, b2);
  const o3 = orientation(b1, b2, a1);
  const o4 = orientation(b1, b2, a2);
  if (o1 !== o2 && o3 !== o4) return true;
  if (o1 === 0 && onSegment(a1, b1, a2)) return true;
  if (o2 === 0 && onSegment(a1, b2, a2)) return true;
  if (o3 === 0 && onSegment(b1, a1, b2)) return true;
  return o4 === 0 && onSegment(b1, a2, b2);
}

function polygonsOverlap(a: Coordinate[], b: Coordinate[]) {
  if (a.length < 3 || b.length < 3) return false;
  for (let i = 0; i < a.length; i += 1) {
    for (let j = 0; j < b.length; j += 1) {
      if (segmentsIntersect(a[i], a[(i + 1) % a.length], b[j], b[(j + 1) % b.length])) {
        return true;
      }
    }
  }
  return pointInPolygon(a[0], b) || pointInPolygon(b[0], a);
}

async function accessibleProjects(email: string, role: Role) {
  if (["ADMIN", "VERIFIER", "BUYER"].includes(role)) {
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

async function projectState(projectId: string) {
  const project = await prisma.project.findUnique({
    where: { id: projectId },
  });
  if (!project) return null;

  const [otherProjects, mrvReports] = await Promise.all([
    prisma.project.findMany({
      where: { id: { not: projectId }, status: "APPROVED" },
    }),
    prisma.automatedMrvReport.findMany({
      where: {
        cycle: {
          projectId: projectId,
        },
      },
      include: {
        cycle: {
          include: {
            satelliteScenes: true,
            vegetation: true,
          },
        },
      },
      orderBy: { createdAt: "asc" },
    }),
  ]);

  // Find the review event that moved status to approved_for_mrv
  // We can query this from D1 or simulate since we don't have review_events in Prisma,
  // Or we just mock the approval metadata
  const approval = {
    actor_email: "admin@blueregistry.local",
    to_status: "approved_for_mrv",
    note: "Project approved for MRV",
    created_at: project.submittedAt.toISOString(),
  };

  const polygon = parsePolygon(project.boundaryGeojson);
  const overlaps = otherProjects
    .map((other) => ({
      projectId: other.id,
      projectName: other.name,
      overlap: polygonsOverlap(polygon, parsePolygon(other.boundaryGeojson)),
    }))
    .filter((check) => check.overlap);

  // Map to the shape expected by registry builder
  const evidence = mrvReports.map(report => ({
    id: report.id,
    projectId: projectId,
    sourceType: "satellite",
    monitoringStage: report.cycle.monitoringStage,
    periodLabel: report.cycle.periodKey,
    observedAt: report.cycle.scheduledAt,
    uploaderEmail: "system",
    dataJson: JSON.stringify({
      ndviMin: report.cycle.vegetation?.ndviMin,
      ndviMax: report.cycle.vegetation?.ndviMax,
      ndviMean: report.cycle.vegetation?.ndviMean,
      ndviDeltaPercent: report.ndviDeltaPercent,
      baselineDeltaPercent: report.baselineDeltaPercent,
      confidenceScore: report.confidenceScore,
      anomalyDetected: report.anomalyDetected,
    }),
    createdAt: report.createdAt,
  }));

  const files = mrvReports.flatMap(report => report.cycle.satelliteScenes.map(scene => ({
    id: scene.id,
    evidenceId: report.id,
    projectId: projectId,
    fileRole: "satellite_scene",
    fileName: scene.sceneId,
    objectKey: scene.trueColorPath,
    contentType: "image/bmp",
    sizeBytes: 12000,
    sha256: scene.sceneId,
    uploadedAt: scene.createdAt,
  })));

  const reviews: any[] = [];
  const latestReviews = new Map<string, any>();
  for (const report of mrvReports) {
    if (report.verificationStatus !== "awaiting_verification") {
      const reviewObj = {
        id: report.id,
        evidenceId: report.id,
        projectId: projectId,
        decision: report.verificationStatus === "verified" ? "approved" : "rejected",
        comment: report.verifierComment,
        reviewerEmail: report.verifiedById || "verifier",
        createdAt: report.verifiedAt || new Date(),
      };
      reviews.push(reviewObj);
      latestReviews.set(report.id, reviewObj);
    }
  }

  const allEvidenceApproved =
    mrvReports.length > 0 &&
    mrvReports.every(
      (r) => r.verificationStatus === "verified"
    );

  const areaHectares = polygonAreaHectares(polygon);
  const factor = factors[String(project.ecosystem)] ?? factors.mangrove;
  const annualCo2e = areaHectares * factor.biomass * factor.carbon * (44 / 12);

  return {
    project,
    polygon,
    areaHectares,
    annualCo2e,
    evidence,
    files,
    reviews,
    latestReviews,
    approval,
    overlaps,
    allEvidenceApproved,
  };
}

async function buildBundleHashes(state: NonNullable<Awaited<ReturnType<typeof projectState>>>) {
  const projectPayload = {
    projectId: state.project.id,
    name: state.project.name,
    ecosystem: state.project.ecosystem,
    boundary: JSON.parse(state.project.boundaryGeojson),
    areaHectares: Number(state.areaHectares.toFixed(4)),
    approval: state.approval ?? null,
  };
  const evidencePayload = {
    projectId: state.project.id,
    items: state.evidence,
    files: state.files,
  };
  
  const formattedReviews = [...state.latestReviews.values()].map((r) => ({
    evidence_id: r.evidenceId,
    decision: r.decision,
    comment: r.comment,
    reviewer_email: r.reviewerEmail,
    created_at: r.createdAt.toISOString(),
  }));

  const decisionPayload = {
    projectId: state.project.id,
    decisions: formattedReviews,
  };

  const projectApprovalHash = await sha256(projectPayload);
  const boundaryHash = await sha256(projectPayload.boundary);
  const evidenceBundleHash = await sha256(evidencePayload);
  const verificationDecisionHash = await sha256(decisionPayload);
  
  const reportPayload = {
    projectId: state.project.id,
    approvedAreaHectares: Number(state.areaHectares.toFixed(4)),
    ecosystem: state.project.ecosystem,
    annualCo2eEstimate: Number(state.annualCo2e.toFixed(4)),
    evidenceBundleHash,
    verificationDecisionHash,
    overlapCount: state.overlaps.length,
    allEvidenceApproved: state.allEvidenceApproved,
  };
  const mrvReportHash = await sha256(reportPayload);

  return {
    projectApprovalHash,
    boundaryHash,
    evidenceBundleHash,
    verificationDecisionHash,
    mrvReportHash,
    reportPayload,
  };
}

type EventInput = {
  projectId: string;
  batchId?: string | null;
  eventType: string;
  entityId: string;
  periodKey?: string | null;
  payloadHash: string;
  transactionId?: string | null;
  actorEmail: string;
  metadata: Record<string, any>;
};

async function makeEvent(input: EventInput) {
  // Find previous event hash
  const previous = await prisma.ledgerEvent.findFirst({
    where: { projectId: input.projectId },
    orderBy: { createdAt: "desc" },
    select: { eventHash: true },
  });

  const createdAt = new Date();
  const id = crypto.randomUUID();
  const previousEventHash = previous?.eventHash ?? null;

  const eventHash = await sha256({
    id,
    projectId: input.projectId,
    batchId: input.batchId ?? null,
    eventType: input.eventType,
    entityId: input.entityId,
    periodKey: input.periodKey ?? null,
    payloadHash: input.payloadHash,
    previousEventHash,
    network: NETWORK,
    chainId: CHAIN_ID,
    transactionId: input.transactionId ?? null,
    actorEmail: input.actorEmail,
    metadata: input.metadata,
    createdAt: createdAt.toISOString(),
  });

  return {
    id,
    createdAt,
    previousEventHash,
    eventHash,
    ...input,
  };
}

async function appendUniqueEvent(input: EventInput) {
  const existing = await prisma.ledgerEvent.findFirst({
    where: {
      projectId: input.projectId,
      eventType: input.eventType,
      payloadHash: input.payloadHash,
    },
  });

  if (existing) return existing;

  const event = await makeEvent(input);
  return prisma.ledgerEvent.create({
    data: {
      id: event.id,
      projectId: event.projectId,
      batchId: event.batchId || null,
      eventType: event.eventType,
      entityId: event.entityId,
      periodKey: event.periodKey || null,
      payloadHash: event.payloadHash,
      previousEventHash: event.previousEventHash,
      eventHash: event.eventHash,
      network: NETWORK,
      chainId: CHAIN_ID,
      transactionId: event.transactionId || null,
      actorEmail: event.actorEmail,
      metadataJson: canonicalJson(event.metadata),
    },
  });
}

function validTransactionId(value: string) {
  return /^0x[a-fA-F0-9]{64}$/.test(value);
}

function validPeriodKey(value: string) {
  return /^[A-Za-z0-9][A-Za-z0-9._-]{2,39}$/.test(value);
}

async function ledgerResponse(
  email: string,
  role: Role,
  requestedProjectId?: string | null,
) {
  const projects = await accessibleProjects(email, role);
  const project =
    projects.find((candidate) => String(candidate.id) === requestedProjectId) ??
    projects[0] ??
    null;

  if (!project) {
    return {
      projects: [],
      selectedProjectId: null,
      ledger: null,
      chain: {
        network: NETWORK,
        chainId: CHAIN_ID,
        explorerUrl: EXPLORER_URL,
        contractAddress: process.env.BLUELEDGER_CONTRACT_ADDRESS ?? null,
      },
    };
  }

  const state = await projectState(project.id);
  if (!state) throw new Error("Project state unavailable");
  const hashes = await buildBundleHashes(state);

  const [events, batches] = await Promise.all([
    prisma.ledgerEvent.findMany({
      where: { projectId: project.id },
      orderBy: { createdAt: "desc" },
    }),
    prisma.creditBatch.findMany({
      where: { projectId: project.id },
      orderBy: { createdAt: "desc" },
    }),
  ]);

  return {
    projects: projects.map((candidate) => ({
      id: candidate.id,
      name: candidate.name,
      ecosystem: candidate.ecosystem,
      village: candidate.village,
      state: candidate.state,
    })),
    selectedProjectId: project.id,
    chain: {
      network: NETWORK,
      chainId: CHAIN_ID,
      explorerUrl: EXPLORER_URL,
      contractAddress: process.env.BLUELEDGER_CONTRACT_ADDRESS ?? null,
      contractFunctions: [
        "registerProject",
        "anchorMRVReport",
        "issueCredits",
        "transferCredits",
        "retireCredits",
      ],
    },
    ledger: {
      project: {
        id: project.id,
        name: project.name,
        ecosystem: project.ecosystem,
        ownerEmail: project.ownerId, // Maps owner id/email
        location: `${project.village}, ${project.district}, ${project.state}`,
        approvedAreaHectares: Number(state.areaHectares.toFixed(2)),
      },
      hashes,
      antiFraud: {
        projectApproved: project.status === "APPROVED",
        overlapClear: state.overlaps.length === 0,
        overlaps: state.overlaps,
        evidenceAvailable: state.evidence.length > 0,
        evidenceCount: state.evidence.length,
        verifierApprovalComplete: state.allEvidenceApproved,
        annualIssuanceLimit: Number(state.annualCo2e.toFixed(2)),
      },
      events: events.map((event) => {
        let metadata = {};
        try {
          metadata = JSON.parse(event.metadataJson);
        } catch {}
        return {
          id: event.id,
          project_id: event.projectId,
          batch_id: event.batchId,
          event_type: event.eventType,
          entity_id: event.entityId,
          period_key: event.periodKey,
          payload_hash: event.payloadHash,
          previous_event_hash: event.previousEventHash,
          event_hash: event.eventHash,
          network: event.network,
          chain_id: event.chainId,
          transaction_id: event.transactionId,
          actor_email: event.actorEmail,
          created_at: event.createdAt.toISOString(),
          metadata,
        };
      }),
      batches: batches.map((batch) => ({
        id: batch.id,
        project_id: batch.projectId,
        period_key: batch.periodKey,
        vintage_year: batch.vintageYear,
        report_hash: batch.reportHash,
        issued_quantity: batch.issuedQuantity,
        current_holder: batch.currentHolder,
        status: batch.status,
        created_by: batch.createdBy,
        created_at: batch.createdAt.toISOString(),
        updated_at: batch.updatedAt.toISOString(),
      })),
      totals: {
        issued: batches
          .filter((batch) => ["issued", "transferred", "retired"].includes(String(batch.status)))
          .reduce((sum, batch) => sum + Number(batch.issuedQuantity), 0),
        retired: batches
          .filter((batch) => batch.status === "retired")
          .reduce((sum, batch) => sum + Number(batch.issuedQuantity), 0),
      },
    },
  };
}

export async function GET(request: NextRequest) {
  const user = identity(request);
  if (!user) return jsonError("Sign in is required.", 401);

  const profile = await prisma.user.findUnique({
    where: { id: user.id },
  });
  if (!profile) return jsonError("Account not found. Please sign in again.", 403);
  const projectId = request.nextUrl.searchParams.get("projectId");
  return NextResponse.json(await ledgerResponse(user.email, profile.role, projectId));
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
  const projectId = String(form.get("projectId") ?? "");
  const accessible = await accessibleProjects(user.email, profile.role);
  const project = accessible.find((candidate) => String(candidate.id) === projectId);

  if (!project) return jsonError("Approved project not found or access denied.", 403);

  const state = await projectState(projectId);
  if (!state) return jsonError("Project state unavailable.", 404);

  const hashes = await buildBundleHashes(state);
  const isVerifier = ["ADMIN", "VERIFIER"].includes(profile.role);
  const isOwner = project.ownerId === profile.id || project.ownerId === user.email;

  const transactionIdValue = String(form.get("transactionId") ?? "").trim();
  const transactionId = transactionIdValue || null;
  if (transactionId && !validTransactionId(transactionId)) {
    return jsonError("Transaction ID must be a 0x-prefixed 32-byte hash.");
  }

  if (action === "prepare_chain") {
    if (!isVerifier) return jsonError("Verifier access is required.", 403);
    if (project.status !== "APPROVED") return jsonError("Project is not approved for MRV.");
    if (state.overlaps.length) {
      return jsonError("Project boundary overlaps another approved BlueLedger project.");
    }
    const prepared = [];
    prepared.push(await appendUniqueEvent({
      projectId,
      eventType: "project_approval_hash",
      entityId: projectId,
      payloadHash: hashes.projectApprovalHash,
      actorEmail: user.email,
      metadata: {
        boundaryHash: hashes.boundaryHash,
        approvedAreaHectares: Number(state.areaHectares.toFixed(2)),
        smartContractFunction: "registerProject",
      },
    }));
    prepared.push(await appendUniqueEvent({
      projectId,
      eventType: "evidence_bundle_hash",
      entityId: projectId,
      payloadHash: hashes.evidenceBundleHash,
      actorEmail: user.email,
      metadata: {
        evidenceItems: state.evidence.length,
        evidenceFiles: state.files.length,
        smartContractFunction: "anchorMRVReport",
      },
    }));
    prepared.push(await appendUniqueEvent({
      projectId,
      eventType: "mrv_report_hash",
      entityId: projectId,
      payloadHash: hashes.mrvReportHash,
      actorEmail: user.email,
      metadata: {
        annualCo2eEstimate: Number(state.annualCo2e.toFixed(2)),
        smartContractFunction: "anchorMRVReport",
      },
    }));
    prepared.push(await appendUniqueEvent({
      projectId,
      eventType: "verification_decision_hash",
      entityId: projectId,
      payloadHash: hashes.verificationDecisionHash,
      actorEmail: user.email,
      metadata: {
        allEvidenceApproved: state.allEvidenceApproved,
        decisionCount: state.reviews.length,
        smartContractFunction: "anchorMRVReport",
      },
    }));
    return NextResponse.json({ ok: true, prepared: prepared.length });
  }

  if (action === "create_draft") {
    if (!isOwner && !isVerifier) return jsonError("Project-owner access is required.", 403);
    const periodKey = String(form.get("periodKey") ?? "").trim();
    const vintageYear = Number(form.get("vintageYear"));
    const quantity = Number(form.get("quantity"));
    if (!validPeriodKey(periodKey)) return jsonError("Use a 3–40 character monitoring-period key.");
    if (!Number.isInteger(vintageYear) || vintageYear < 2000 || vintageYear > 2100) {
      return jsonError("Enter a valid vintage year.");
    }
    if (!Number.isFinite(quantity) || quantity <= 0) return jsonError("Credit quantity must be positive.");
    
    const existing = await prisma.creditBatch.findUnique({
      where: {
        projectId_periodKey: { projectId, periodKey },
      },
    });
    if (existing) return jsonError("A credit batch already exists for this monitoring period.", 409);
    
    const now = new Date();
    const batchId = crypto.randomUUID();
    const payloadHash = await sha256({
      batchId,
      projectId,
      periodKey,
      vintageYear,
      quantity,
      status: "draft",
    });
    
    const event = await makeEvent({
      projectId,
      batchId,
      eventType: "credit_draft_created",
      entityId: batchId,
      periodKey,
      payloadHash,
      actorEmail: user.email,
      metadata: { quantity, vintageYear, status: "draft" },
    });

    await prisma.$transaction([
      prisma.creditBatch.create({
        data: {
          id: batchId,
          projectId,
          periodKey,
          vintageYear,
          issuedQuantity: quantity,
          currentHolder: user.email,
          status: "draft",
          createdBy: profile.id,
        },
      }),
      prisma.ledgerEvent.create({
        data: {
          id: event.id,
          projectId: event.projectId,
          batchId: event.batchId || null,
          eventType: event.eventType,
          entityId: event.entityId,
          periodKey: event.periodKey || null,
          payloadHash: event.payloadHash,
          previousEventHash: event.previousEventHash,
          eventHash: event.eventHash,
          network: NETWORK,
          chainId: CHAIN_ID,
          transactionId: event.transactionId || null,
          actorEmail: event.actorEmail,
          metadataJson: canonicalJson(event.metadata),
        },
      }),
    ]);
    return NextResponse.json({ ok: true, batchId }, { status: 201 });
  }

  const batchId = String(form.get("batchId") ?? "");
  const batch = batchId
    ? await prisma.creditBatch.findUnique({
        where: { id: batchId },
      })
    : null;

  if (!batch || batch.projectId !== projectId) {
    return jsonError("Credit batch not found.", 404);
  }

  if (action === "submit_for_verification") {
    if (!isOwner && !isVerifier) return jsonError("Project-owner access is required.", 403);
    if (batch.status !== "draft") return jsonError("Only draft credits can be submitted.");
    
    const reportEvent = await prisma.ledgerEvent.findFirst({
      where: { projectId, eventType: "mrv_report_hash" },
      orderBy: { createdAt: "desc" },
    });
    if (!reportEvent) return jsonError("Prepare the project and MRV hash chain first.");
    
    const payloadHash = await sha256({
      batchId,
      from: "draft",
      to: "pending_verification",
      reportHash: reportEvent.payloadHash,
    });
    const event = await makeEvent({
      projectId,
      batchId,
      eventType: "credit_pending_verification",
      entityId: batchId,
      periodKey: batch.periodKey,
      payloadHash,
      actorEmail: user.email,
      metadata: { status: "pending_verification" },
    });

    await prisma.$transaction([
      prisma.creditBatch.update({
        where: { id: batchId },
        data: {
          status: "pending_verification",
          reportHash: reportEvent.payloadHash,
        },
      }),
      prisma.ledgerEvent.create({
        data: {
          id: event.id,
          projectId: event.projectId,
          batchId: event.batchId || null,
          eventType: event.eventType,
          entityId: event.entityId,
          periodKey: event.periodKey || null,
          payloadHash: event.payloadHash,
          previousEventHash: event.previousEventHash,
          eventHash: event.eventHash,
          network: NETWORK,
          chainId: CHAIN_ID,
          transactionId: event.transactionId || null,
          actorEmail: event.actorEmail,
          metadataJson: canonicalJson(event.metadata),
        },
      }),
    ]);
    return NextResponse.json({ ok: true });
  }

  if (action === "issue_credits") {
    if (!isVerifier) return jsonError("Verifier access is required.", 403);
    if (batch.status !== "pending_verification") {
      return jsonError("Credits must be pending verification before issuance.");
    }
    if (state.overlaps.length) {
      return jsonError("Issuance blocked: project overlaps another approved BlueLedger project.");
    }
    if (!state.allEvidenceApproved) {
      return jsonError("Issuance blocked: every evidence item requires verifier approval.");
    }
    const quantity = Number(batch.issuedQuantity);
    if (quantity > state.annualCo2e + 0.01) {
      return jsonError(
        `Issuance quantity exceeds the ${state.annualCo2e.toFixed(2)} tCO₂e annual prototype estimate.`,
      );
    }
    const reportEvent = await prisma.ledgerEvent.findFirst({
      where: { projectId, eventType: "mrv_report_hash" },
      orderBy: { createdAt: "desc" },
    });
    const decisionEvent = await prisma.ledgerEvent.findFirst({
      where: { projectId, eventType: "verification_decision_hash" },
      orderBy: { createdAt: "desc" },
    });
    if (!reportEvent || !decisionEvent) return jsonError("MRV and verification hashes must be prepared.");
    
    const payloadHash = await sha256({
      batchId,
      projectId,
      periodKey: batch.periodKey,
      quantity,
      reportHash: reportEvent.payloadHash,
      decisionHash: decisionEvent.payloadHash,
      holder: batch.currentHolder,
    });
    const event = await makeEvent({
      projectId,
      batchId,
      eventType: "credit_issuance",
      entityId: batchId,
      periodKey: batch.periodKey,
      payloadHash,
      transactionId,
      actorEmail: user.email,
      metadata: {
        quantity,
        holder: batch.currentHolder,
        reportHash: reportEvent.payloadHash,
        verificationDecisionHash: decisionEvent.payloadHash,
        smartContractFunction: "issueCredits",
        status: "issued",
      },
    });

    await prisma.$transaction([
      prisma.creditBatch.update({
        where: { id: batchId },
        data: {
          status: "issued",
          reportHash: reportEvent.payloadHash,
        },
      }),
      prisma.ledgerEvent.create({
        data: {
          id: event.id,
          projectId: event.projectId,
          batchId: event.batchId || null,
          eventType: event.eventType,
          entityId: event.entityId,
          periodKey: event.periodKey || null,
          payloadHash: event.payloadHash,
          previousEventHash: event.previousEventHash,
          eventHash: event.eventHash,
          network: NETWORK,
          chainId: CHAIN_ID,
          transactionId: event.transactionId || null,
          actorEmail: event.actorEmail,
          metadataJson: canonicalJson(event.metadata),
        },
      }),
    ]);
    return NextResponse.json({ ok: true });
  }

  if (action === "transfer_credits") {
    if (!["issued", "transferred"].includes(String(batch.status))) {
      return jsonError("Only issued or previously transferred credits can be transferred.");
    }
    if (batch.currentHolder !== user.email && !isVerifier) {
      return jsonError("Only the current holder can transfer this batch.", 403);
    }
    const recipient = String(form.get("recipient") ?? "").trim();
    if (recipient.length < 3 || recipient.length > 160) return jsonError("Enter a valid recipient account.");
    
    const payloadHash = await sha256({
      batchId,
      from: batch.currentHolder,
      to: recipient,
      quantity: batch.issuedQuantity,
    });
    const event = await makeEvent({
      projectId,
      batchId,
      eventType: "credit_transfer",
      entityId: batchId,
      periodKey: batch.periodKey,
      payloadHash,
      transactionId,
      actorEmail: user.email,
      metadata: {
        from: batch.currentHolder,
        to: recipient,
        quantity: batch.issuedQuantity,
        smartContractFunction: "transferCredits",
        status: "transferred",
      },
    });

    await prisma.$transaction([
      prisma.creditBatch.update({
        where: { id: batchId },
        data: {
          status: "transferred",
          currentHolder: recipient,
        },
      }),
      prisma.ledgerEvent.create({
        data: {
          id: event.id,
          projectId: event.projectId,
          batchId: event.batchId || null,
          eventType: event.eventType,
          entityId: event.entityId,
          periodKey: event.periodKey || null,
          payloadHash: event.payloadHash,
          previousEventHash: event.previousEventHash,
          eventHash: event.eventHash,
          network: NETWORK,
          chainId: CHAIN_ID,
          transactionId: event.transactionId || null,
          actorEmail: event.actorEmail,
          metadataJson: canonicalJson(event.metadata),
        },
      }),
    ]);
    return NextResponse.json({ ok: true });
  }

  if (action === "retire_credits") {
    if (!["issued", "transferred"].includes(String(batch.status))) {
      return jsonError("Only active issued credits can be retired.");
    }
    if (batch.currentHolder !== user.email && !isVerifier) {
      return jsonError("Only the current holder can retire this batch.", 403);
    }
    const reason = String(form.get("reason") ?? "").trim();
    if (reason.length < 5) return jsonError("Add a retirement purpose.");
    
    const reasonHash = await sha256(reason);
    const payloadHash = await sha256({
      batchId,
      holder: batch.currentHolder,
      quantity: batch.issuedQuantity,
      reasonHash,
    });
    const event = await makeEvent({
      projectId,
      batchId,
      eventType: "credit_retirement",
      entityId: batchId,
      periodKey: batch.periodKey,
      payloadHash,
      transactionId,
      actorEmail: user.email,
      metadata: {
        holder: batch.currentHolder,
        quantity: batch.issuedQuantity,
        retirementPurpose: reason,
        smartContractFunction: "retireCredits",
        status: "retired",
      },
    });

    await prisma.$transaction([
      prisma.creditBatch.update({
        where: { id: batchId },
        data: {
          status: "retired",
        },
      }),
      prisma.ledgerEvent.create({
        data: {
          id: event.id,
          projectId: event.projectId,
          batchId: event.batchId || null,
          eventType: event.eventType,
          entityId: event.entityId,
          periodKey: event.periodKey || null,
          payloadHash: event.payloadHash,
          previousEventHash: event.previousEventHash,
          eventHash: event.eventHash,
          network: NETWORK,
          chainId: CHAIN_ID,
          transactionId: event.transactionId || null,
          actorEmail: event.actorEmail,
          metadataJson: canonicalJson(event.metadata),
        },
      }),
    ]);
    return NextResponse.json({ ok: true });
  }

  return jsonError("Unknown action.");
}
