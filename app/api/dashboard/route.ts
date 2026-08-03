import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma-client";

export const dynamic = "force-dynamic";

type Role = "NGO" | "COMMUNITY" | "ADMIN" | "VERIFIER" | "BUYER";
type Coordinate = [number, number];

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

function parsePolygon(value: unknown): Coordinate[] {
  try {
    const geojson = typeof value === "string" ? JSON.parse(value) : value;
    const points = geojson?.geometry?.coordinates?.[0];
    if (!Array.isArray(points)) return [];
    return points
      .filter((point: unknown) => Array.isArray(point) && point.length >= 2)
      .map((point: number[]) => [Number(point[0]), Number(point[1])] as Coordinate);
  } catch {
    return [];
  }
}

function bbox(points: Coordinate[]) {
  if (!points.length) return { minX: 0, maxX: 0, minY: 0, maxY: 0 };
  return {
    minX: Math.min(...points.map(([x]) => x)),
    maxX: Math.max(...points.map(([x]) => x)),
    minY: Math.min(...points.map(([, y]) => y)),
    maxY: Math.max(...points.map(([, y]) => y)),
  };
}

function polygonsPossiblyOverlap(a: Coordinate[], b: Coordinate[]) {
  if (a.length < 3 || b.length < 3) return false;
  const first = bbox(a);
  const second = bbox(b);
  return !(
    first.maxX < second.minX ||
    second.maxX < first.minX ||
    first.maxY < second.minY ||
    second.maxY < first.minY
  );
}

function annualEstimate(project: Record<string, any>) {
  const factor = factors[String(project.ecosystem)] ?? factors.mangrove;
  return Number(project.areaHectares) * factor.biomass * factor.carbon * (44 / 12);
}

export async function GET(request: NextRequest) {
  const user = identity(request);
  if (!user) return jsonError("Sign in is required.", 401);

  const profile = await prisma.user.findUnique({
    where: { id: user.id },
  });
  if (!profile) return jsonError("Account not found. Please sign in again.", 403);

  const role = profile.role as Role;

  const [
    allProjects,
    allUsers,
    evidenceItems,
    reviews,
    batches,
    events,
    benefits,
  ] = await Promise.all([
    prisma.project.findMany({ orderBy: { submittedAt: "desc" } }),
    prisma.user.findMany({ orderBy: { createdAt: "desc" } }),
    prisma.evidenceItem.findMany({ orderBy: { observedAt: "desc" } }),
    prisma.evidenceReview.findMany({ orderBy: { createdAt: "desc" } }),
    prisma.creditBatch.findMany({ orderBy: { createdAt: "desc" } }),
    prisma.ledgerEvent.findMany({ orderBy: { createdAt: "desc" } }),
    prisma.benefitRecord.findMany({ orderBy: { recordedAt: "desc" } }),
  ]);

  const visibleProjects = allProjects.filter((project) => {
    if (role === "ADMIN") return true;
    if (role === "VERIFIER" || role === "BUYER") return project.status === "APPROVED";
    return project.ownerId === user.id;
  });

  const visibleIds = new Set(visibleProjects.map((project) => project.id));
  const evidence = evidenceItems.filter((item) => visibleIds.has(item.projectId));
  const projectReviews = reviews.filter((item) => visibleIds.has(item.projectId));
  const projectBatches = batches.filter((item) => visibleIds.has(item.projectId));
  const projectEvents = events.filter((item) => visibleIds.has(item.projectId));
  const projectBenefits = benefits.filter((item) => visibleIds.has(item.projectId));

  const latestReview = new Map<string, any>();
  for (const review of reviews) {
    if (!latestReview.has(review.evidenceId)) {
      latestReview.set(review.evidenceId, review);
    }
  }

  const duplicateAlerts: Array<{
    projectId: string;
    projectName: string;
    conflictsWith: string;
  }> = [];

  for (let outer = 0; outer < allProjects.length; outer += 1) {
    for (let inner = outer + 1; inner < allProjects.length; inner += 1) {
      const first = allProjects[outer];
      const second = allProjects[inner];
      if (
        polygonsPossiblyOverlap(
          parsePolygon(first.boundaryGeojson),
          parsePolygon(second.boundaryGeojson),
        )
      ) {
        const flagged =
          first.status === "APPROVED" ? second :
          second.status === "APPROVED" ? first :
          second;
        const approved =
          first.status === "APPROVED" ? first :
          second.status === "APPROVED" ? second :
          first;
        duplicateAlerts.push({
          projectId: flagged.id,
          projectName: flagged.name,
          conflictsWith: approved.name,
        });
      }
    }
  }

  const projectCards = visibleProjects.map((project) => {
    const pEvidence = evidenceItems.filter((item) => item.projectId === project.id);
    const missingSources = ["field", "sensor", "satellite"].filter(
      (source) => !pEvidence.some((item) => item.sourceType === source),
    );
    const lastObserved = pEvidence
      .map((item) => item.observedAt.getTime())
      .filter(Number.isFinite)
      .sort((a, b) => b - a)[0];
    const nextDeadline = new Date(
      (lastObserved || new Date(project.startDate).getTime()) +
        90 * 24 * 60 * 60 * 1000,
    ).toISOString();

    const pReviews = reviews.filter((review) => review.projectId === project.id);

    return {
      id: project.id,
      name: project.name,
      ecosystem: project.ecosystem,
      status: project.status,
      areaHectares: project.areaHectares,
      location: `${project.village}, ${project.state}`,
      missingSources,
      nextDeadline,
      estimatedAnnualCo2e: Number(annualEstimate(project).toFixed(1)),
      feedback:
        pReviews[0]?.comment ??
        project.reviewerNote ??
        "No verifier feedback recorded.",
      evidenceCount: pEvidence.length,
    };
  });

  const publicProjects = allProjects
    .filter((project) => project.status === "APPROVED")
    .map((project) => {
      const pBatches = batches.filter((batch) => batch.projectId === project.id);
      const pEvents = events.filter((event) => event.projectId === project.id);
      return {
        id: project.id,
        name: project.name,
        ecosystem: project.ecosystem,
        location: `${project.village}, ${project.district}, ${project.state}`,
        areaHectares: project.areaHectares,
        annualEstimate: Number(annualEstimate(project).toFixed(1)),
        batches: pBatches.map((batch) => {
          const matchingEvents = pEvents.filter((event) => event.batchId === batch.id);
          return {
            id: batch.id,
            periodKey: batch.periodKey,
            vintageYear: batch.vintageYear,
            reportHash: batch.reportHash,
            quantity: batch.issuedQuantity,
            holder: batch.currentHolder,
            status: batch.status,
            transactionId:
              matchingEvents.find((event) => event.transactionId)?.transactionId ?? null,
            eventHash: matchingEvents[0]?.eventHash ?? null,
            retiredAt:
              matchingEvents.find((event) => event.eventType === "credit_retirement")
                ?.createdAt.toISOString() ?? null,
          };
        }),
      };
    });

  const approvedProjects = allProjects.filter(
    (project) => project.status === "APPROVED",
  );
  const issued = batches
    .filter((batch) => ["issued", "transferred", "retired"].includes(String(batch.status)))
    .reduce((sum, batch) => sum + Number(batch.issuedQuantity), 0);
  const retired = batches
    .filter((batch) => batch.status === "retired")
    .reduce((sum, batch) => sum + Number(batch.issuedQuantity), 0);

  return NextResponse.json({
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
    demo: user.email === "demo@blueregistry.local",
    projectCards,
    evidenceTimeline: evidence.slice(0, 12).map((item) => {
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
        review: latestReview.get(item.id)
          ? {
              id: latestReview.get(item.id).id,
              evidence_id: latestReview.get(item.id).evidenceId,
              reviewer_email: latestReview.get(item.id).reviewerEmail,
              decision: latestReview.get(item.id).decision,
              comment: latestReview.get(item.id).comment,
              created_at: latestReview.get(item.id).createdAt.toISOString(),
            }
          : null,
      };
    }),
    admin: {
      pendingOrganizations: allUsers
        .filter((item) => item.verificationStatus !== "verified" && item.email !== "demo@blueregistry.local")
        .map((item) => ({
          email: item.email,
          full_name: item.fullName,
          role: item.role,
          organization: item.organization,
          verification_status: item.verificationStatus,
          created_at: item.createdAt.toISOString(),
        })),
      pendingProjects: allProjects
        .filter((item) => ["SUBMITTED", "UNDER_REVIEW", "CHANGES_REQUESTED"].includes(String(item.status)))
        .map((item) => ({
          id: item.id,
          name: item.name,
          ecosystem: item.ecosystem,
          status: item.status,
          submitted_at: item.submittedAt.toISOString(),
        })),
      duplicateAlerts,
      evidenceReviewQueue: evidenceItems
        .filter((item) => !latestReview.has(item.id))
        .map((item) => ({
          id: item.id,
          project_id: item.projectId,
          period_label: item.periodLabel,
          source_type: item.sourceType,
          observed_at: item.observedAt.toISOString(),
        })),
      risks: [
        ...duplicateAlerts.map((alert) => ({
          severity: "high",
          title: "Possible boundary overlap",
          detail: `${alert.projectName} intersects ${alert.conflictsWith}.`,
        })),
        ...evidenceItems
          .filter((item) => !latestReview.has(item.id))
          .map((item) => ({
            severity: "medium",
            title: "Unreviewed evidence",
            detail: `${item.periodLabel} is awaiting a verifier decision.`,
          })),
      ],
    },
    verifier: {
      pendingEvidence: evidence
        .filter((item) => !latestReview.has(item.id))
        .map((item) => ({
          id: item.id,
          project_id: item.projectId,
          period_label: item.periodLabel,
          source_type: item.sourceType,
          observed_at: item.observedAt.toISOString(),
        })),
      anchoring: events.slice(0, 8).map((event) => ({
        eventType: event.eventType,
        eventHash: event.eventHash,
        transactionId: event.transactionId,
        createdAt: event.createdAt.toISOString(),
      })),
      assumptions: {
        mangrove: "12.4 t biomass/ha/yr × 0.47 carbon fraction × 44/12",
        uncertainty: "Prototype range ±18%; must be replaced by validated regional factors.",
        ndvi: "Sentinel-2 baseline 0.31 → current 0.58; scene cloud cover 7.8%.",
      },
    },
    community: {
      saplings: evidence
        .filter((item) => item.sourceType === "field_photo")
        .reduce((sum, item) => {
          try { return sum + Number(JSON.parse(item.dataJson).saplings ?? 0); }
          catch { return sum; }
        }, 0),
      survivalPercent: 86,
      approvedCredits: batches
        .filter((batch) => ["issued", "transferred", "retired"].includes(String(batch.status)))
        .reduce((sum, batch) => sum + Number(batch.issuedQuantity), 0),
      benefits: benefits.map((item) => ({
        id: item.id,
        project_id: item.projectId,
        record_type: item.recordType,
        amount: item.amount,
        currency: item.currency,
        beneficiary: item.beneficiary,
        description: item.description,
        recorded_at: item.recordedAt.toISOString(),
        proof_hash: item.proofHash,
      })),
    },
    publicProjects,
    analytics: {
      totalAreaHectares: approvedProjects.reduce(
        (sum, project) => sum + Number(project.areaHectares), 0,
      ),
      approvedProjects: approvedProjects.length,
      estimatedAnnualCo2e: approvedProjects.reduce(
        (sum, project) => sum + annualEstimate(project), 0,
      ),
      issuedCredits: issued,
      retiredCredits: retired,
    },
  });
}
