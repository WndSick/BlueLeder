import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma-client";

export const dynamic = "force-dynamic";

type Role = "NGO" | "COMMUNITY" | "ADMIN" | "VERIFIER" | "BUYER";

function identity(request: NextRequest) {
  const userId = request.headers.get("x-user-id");
  const email = request.headers.get("x-user-email");
  const role = request.headers.get("x-user-role");

  if (!userId || !email || !role) return null;
  return { id: userId, email, role };
}

function ascii(value: unknown) {
  return String(value ?? "")
    .normalize("NFKD")
    .replace(/[^\x20-\x7E]/g, "")
    .replaceAll("\\", "\\\\")
    .replaceAll("(", "\\(")
    .replaceAll(")", "\\)");
}

function wrap(value: unknown, width = 88) {
  const words = ascii(value).split(/\s+/);
  const lines: string[] = [];
  let line = "";
  for (const word of words) {
    if (word.length > width) {
      if (line) {
        lines.push(line);
        line = "";
      }
      for (let index = 0; index < word.length; index += width) {
        const chunk = word.slice(index, index + width);
        if (chunk.length === width) lines.push(chunk);
        else line = chunk;
      }
      continue;
    }
    if (`${line} ${word}`.trim().length > width && line) {
      lines.push(line);
      line = word;
    } else {
      line = `${line} ${word}`.trim();
    }
  }
  if (line) lines.push(line);
  return lines;
}

function makePdf(title: string, lines: string[]) {
  const expandedLines = lines.flatMap((line) => line ? wrap(line) : [""]);
  const pages: string[][] = [];
  for (let index = 0; index < Math.max(expandedLines.length, 1); index += 39) {
    pages.push([
      title.toUpperCase(),
      "BlueRegistry / BlueLedger",
      "Generated from the traceable SIH prototype registry",
      "",
      ...expandedLines.slice(index, index + 39),
    ]);
  }
  const objects: string[] = [];
  const pageObjectIds = pages.map((_, index) => 4 + index * 2);
  objects[1] = "<< /Type /Catalog /Pages 2 0 R >>";
  objects[2] = `<< /Type /Pages /Kids [${pageObjectIds.map((id) => `${id} 0 R`).join(" ")}] /Count ${pages.length} >>`;
  objects[3] = "<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica >>";
  pages.forEach((pageLines, index) => {
    const pageId = pageObjectIds[index];
    const contentId = pageId + 1;
    const commands = pageLines.map((line, lineIndex) => {
      const size = lineIndex === 0 ? 16 : lineIndex === 1 ? 10 : 9;
      const y =
        lineIndex === 0 ? 744 :
        lineIndex === 1 ? 715 :
        lineIndex === 2 ? 693 :
        656 - (lineIndex - 4) * 14;
      const color =
        lineIndex === 0 ? "1 1 1 rg" :
        lineIndex === 1 ? "0.95 0.83 0.42 rg" :
        lineIndex === 2 ? "0.82 0.9 0.87 rg" :
        "0.16 0.28 0.25 rg";
      return `${color} /F1 ${size} Tf 1 0 0 1 54 ${y} Tm (${ascii(line)}) Tj`;
    }).join("\n");
    const stream = [
      "1 1 1 rg 0 0 612 792 re f",
      "0.04 0.27 0.23 rg 0 674 612 118 re f",
      "0.94 0.81 0.36 rg 54 670 504 3 re f",
      "BT",
      commands,
      "ET",
      "0.78 0.84 0.81 RG 54 42 m 558 42 l S",
    ].join("\n");
    objects[pageId] = `<< /Type /Page /Parent 2 0 R /MediaBox [0 0 612 792] /Resources << /Font << /F1 3 0 R >> >> /Contents ${contentId} 0 R >>`;
    objects[contentId] = `<< /Length ${stream.length} >>\nstream\n${stream}\nendstream`;
  });
  let pdf = "%PDF-1.4\n";
  const offsets: number[] = [0];
  for (let id = 1; id < objects.length; id += 1) {
    offsets[id] = new TextEncoder().encode(pdf).length;
    pdf += `${id} 0 obj\n${objects[id]}\nendobj\n`;
  }
  const xref = new TextEncoder().encode(pdf).length;
  pdf += `xref\n0 ${objects.length}\n0000000000 65535 f \n`;
  for (let id = 1; id < objects.length; id += 1) {
    pdf += `${String(offsets[id]).padStart(10, "0")} 00000 n \n`;
  }
  pdf += `trailer\n<< /Size ${objects.length} /Root 1 0 R >>\nstartxref\n${xref}\n%%EOF`;
  return new TextEncoder().encode(pdf);
}

function csv(value: unknown) {
  return `"${String(value ?? "").replaceAll('"', '""')}"`;
}

export async function GET(request: NextRequest) {
  const user = identity(request);
  if (!user) return NextResponse.json({ error: "Sign in is required." }, { status: 401 });

  const profile = await prisma.user.findUnique({
    where: { id: user.id },
  });
  if (!profile) return NextResponse.json({ error: "Account not found. Please sign in again." }, { status: 403 });

  const type = request.nextUrl.searchParams.get("type") ?? "mrv";
  const requestedProjectId = request.nextUrl.searchParams.get("projectId");
  
  // Find project
  let project: any = null;
  if (profile.role === "ADMIN") {
    project = await prisma.project.findFirst({
      where: requestedProjectId ? { id: requestedProjectId } : undefined,
      orderBy: { submittedAt: "desc" },
    });
  } else if (profile.role === "VERIFIER" || profile.role === "BUYER") {
    project = await prisma.project.findFirst({
      where: {
        status: "APPROVED",
        ...(requestedProjectId ? { id: requestedProjectId } : {}),
      },
      orderBy: { submittedAt: "desc" },
    });
  } else {
    project = await prisma.project.findFirst({
      where: {
        ownerId: profile.id,
        ...(requestedProjectId ? { id: requestedProjectId } : {}),
      },
      orderBy: { submittedAt: "desc" },
    });
  }

  if (!project) return NextResponse.json({ error: "Project not found or access denied." }, { status: 404 });

  const [evidence, reviews, batches, events, benefits] = await Promise.all([
    prisma.evidenceItem.findMany({ where: { projectId: project.id }, orderBy: { observedAt: "asc" } }),
    prisma.evidenceReview.findMany({ where: { projectId: project.id }, orderBy: { createdAt: "asc" } }),
    prisma.creditBatch.findMany({ where: { projectId: project.id }, orderBy: { createdAt: "asc" } }),
    prisma.ledgerEvent.findMany({ where: { projectId: project.id }, orderBy: { createdAt: "asc" } }),
    prisma.benefitRecord.findMany({ where: { projectId: project.id }, orderBy: { recordedAt: "asc" } }),
  ]);

  if (type === "audit") {
    const rows = [
      ["timestamp", "project_id", "event_type", "event_hash", "previous_event_hash", "payload_hash", "transaction_id", "actor"],
      ...events.map((event) => [
        event.createdAt.toISOString(),
        event.projectId,
        event.eventType,
        event.eventHash,
        event.previousEventHash || "",
        event.payloadHash,
        event.transactionId || "",
        event.actorEmail,
      ]),
    ];
    return new Response(rows.map((row) => row.map(csv).join(",")).join("\n"), {
      headers: {
        "content-type": "text/csv; charset=utf-8",
        "content-disposition": `attachment; filename="${ascii(project.id)}-audit-trail.csv"`,
        "cache-control": "private, no-store",
      },
    });
  }

  if (type === "certificate") {
    const requestedBatchId = request.nextUrl.searchParams.get("batchId");
    const batch =
      batches.find((item) => String(item.id) === requestedBatchId) ||
      batches.find((item) => item.status === "retired") ||
      batches[0];

    if (!batch) {
      return NextResponse.json({ error: "No credit batch is available." }, { status: 404 });
    }

    const batchEvents = events.filter((event) => event.batchId === batch.id);
    const retirement = batchEvents.find((event) => event.eventType === "credit_retirement");
    const transaction = batchEvents.find((event) => event.transactionId);
    
    const lines = [
      `Certificate ID: BL-${batch.id}`,
      `Project: ${project.name}`,
      `Project ID: ${project.id}`,
      `Monitoring period: ${batch.periodKey}`,
      `Vintage: ${batch.vintageYear}`,
      `Quantity: ${batch.issuedQuantity} tCO2e`,
      `Status: ${String(batch.status).toUpperCase()}`,
      `Current holder / retiring entity: ${batch.currentHolder}`,
      `MRV report hash: ${batch.reportHash ?? "Not recorded"}`,
      `Registry event hash: ${batchEvents[0]?.eventHash ?? "Not recorded"}`,
      `Polygon Amoy transaction: ${transaction?.transactionId ?? "Not anchored"}`,
      `Retired at: ${retirement?.createdAt.toISOString() ?? "Not retired"}`,
      "",
      "Verification note:",
      ...wrap(
        retirement
          ? "The registry marks this complete batch as retired and blocks further transfer. Verify the transaction and proof hashes independently."
          : "This batch is not retired. This certificate records its current registry status and must not be represented as a retirement certificate.",
      ),
      "",
      "Prototype limitation: This document is generated by the SIH testnet prototype and is not an independently accredited carbon-market instrument.",
    ];
    
    const body = makePdf(
      batch.status === "retired" ? "Carbon credit retirement certificate" : "Carbon credit certificate",
      lines,
    );
    
    return new Response(body, {
      headers: {
        "content-type": "application/pdf",
        "content-disposition": `attachment; filename="BlueLedger-${ascii(batch.id)}-certificate.pdf"`,
        "cache-control": "private, no-store",
      },
    });
  }

  const field = evidence.find((item) => item.sourceType === "field_photo");
  const satellite = evidence.find((item) => item.sourceType === "satellite");
  const approvedReviews = reviews.filter((item) => item.decision === "approved").length;
  
  const issued = batches
    .filter((item) => ["issued", "transferred", "retired"].includes(String(item.status)))
    .reduce((sum, item) => sum + Number(item.issuedQuantity), 0);
    
  const lines = [
    `Project: ${project.name}`,
    `Project ID: ${project.id}`,
    `Ecosystem: ${project.ecosystem}`,
    `Location: ${project.village}, ${project.district}, ${project.state}`,
    `Approved boundary area: ${project.areaHectares} hectares`,
    `Registry status: ${project.status}`,
    "",
    "MONITORING EVIDENCE",
    `Evidence items: ${evidence.length}`,
    `Verifier-approved items: ${approvedReviews}`,
    `Latest field period: ${field?.periodLabel ?? "Not available"}`,
    `Latest satellite period: ${satellite?.periodLabel ?? "Not available"}`,
    "",
    "CARBON ESTIMATION",
    "Formula: area x ecosystem biomass factor x carbon fraction x 44/12",
    "Mangrove prototype assumptions: 12.4 t biomass/ha/year and 0.47 carbon fraction.",
    "Uncertainty: +/-18% prototype range; replace with validated regional factors before production use.",
    `Credits issued in registry: ${issued} tCO2e`,
    "",
    "TRACEABILITY",
    `Ledger events: ${events.length}`,
    `Latest report hash: ${batches.find((item) => item.reportHash)?.reportHash ?? "Not recorded"}`,
    `Latest transaction: ${events.find((item) => item.transactionId)?.transactionId ?? "Not anchored"}`,
    "",
    "COMMUNITY BENEFIT RECORD",
    `Recorded entries: ${benefits.length}`,
    ...benefits.flatMap((item) =>
      wrap(`${item.recordedAt.toISOString()}: ${item.currency} ${item.amount} to ${item.beneficiary} - ${item.description}`),
    ),
    "",
    "UNRESOLVED LIMITATIONS",
    "BlueRegistry records authorization evidence but does not automatically verify land ownership.",
    "AI-assisted flags support, but never replace, qualified human verification.",
    "The prototype factors and testnet events are not accredited credit issuance.",
  ];
  
  return new Response(makePdf("Technical MRV report", lines), {
    headers: {
      "content-type": "application/pdf",
      "content-disposition": `attachment; filename="${ascii(project.id)}-MRV-report.pdf"`,
      "cache-control": "private, no-store",
    },
  });
}
