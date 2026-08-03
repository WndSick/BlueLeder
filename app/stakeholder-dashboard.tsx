"use client";

import { useCallback, useEffect, useState } from "react";

type Role = "ngo" | "community" | "admin" | "verifier" | "buyer";
type DashboardData = {
  demo: boolean;
  projectCards: Array<{
    id: string;
    name: string;
    ecosystem: string;
    status: string;
    areaHectares: number;
    location: string;
    missingSources: string[];
    nextDeadline: string;
    estimatedAnnualCo2e: number;
    feedback: string;
    evidenceCount: number;
  }>;
  evidenceTimeline: Array<{
    id: string;
    source_type: string;
    period_label: string;
    observed_at: string;
    review?: { decision: string; comment?: string } | null;
  }>;
  admin: {
    pendingOrganizations: Array<{ email: string; organization: string; created_at: string }>;
    pendingProjects: Array<{ id: string; name: string; status: string }>;
    duplicateAlerts: Array<{ projectId: string; projectName: string; conflictsWith: string }>;
    evidenceReviewQueue: Array<{ id: string; period_label: string; source_type: string }>;
    risks: Array<{ severity: string; title: string; detail: string }>;
  };
  verifier: {
    pendingEvidence: Array<{ id: string; period_label: string }>;
    anchoring: Array<{ eventType: string; eventHash: string; transactionId?: string }>;
    assumptions: { mangrove: string; uncertainty: string; ndvi: string };
  };
  community: {
    saplings: number;
    survivalPercent: number;
    approvedCredits: number;
    benefits: Array<{
      id: string;
      record_type: string;
      amount: number;
      currency: string;
      beneficiary: string;
      description: string;
      recorded_at: string;
      proof_hash: string;
    }>;
  };
  analytics: {
    totalAreaHectares: number;
    approvedProjects: number;
    estimatedAnnualCo2e: number;
    issuedCredits: number;
    retiredCredits: number;
  };
};

const roles: Array<{ id: Role; label: string }> = [
  { id: "ngo", label: "NGO" },
  { id: "community", label: "Community" },
  { id: "admin", label: "Admin" },
  { id: "verifier", label: "Verifier" },
  { id: "buyer", label: "Buyer" },
];

const roleCopy: Record<Role, { eyebrow: string; title: string; body: string }> = {
  ngo: {
    eyebrow: "Project developer command centre",
    title: "Keep restoration evidence-ready.",
    body: "Track approvals, close evidence gaps and prepare each monitoring period for verification.",
  },
  community: {
    eyebrow: "Community restoration view",
    title: "See the work, credits and benefits clearly.",
    body: "A simple progress view for field activity, approved credits and transparent community funding.",
  },
  admin: {
    eyebrow: "Registry operations",
    title: "Protect the integrity of the pipeline.",
    body: "Resolve approval queues, boundary conflicts and system-level evidence risks.",
  },
  verifier: {
    eyebrow: "Technical verification desk",
    title: "Follow every estimate back to evidence.",
    body: "Review monitoring history, satellite change, carbon assumptions and blockchain anchors.",
  },
  buyer: {
    eyebrow: "Buyer and observer view",
    title: "Inspect before you trust.",
    body: "Search approved projects, inspect credit status and independently follow proof hashes.",
  },
};

function formatDate(value: string) {
  return new Intl.DateTimeFormat("en-IN", {
    day: "2-digit",
    month: "short",
    year: "numeric",
  }).format(new Date(value));
}

function shortHash(value?: string) {
  return value ? `${value.slice(0, 10)}…${value.slice(-7)}` : "Awaiting anchor";
}

export default function StakeholderDashboard({
  role,
  onRoleChanged,
  onNavigate,
}: {
  role: Role;
  onRoleChanged: () => Promise<void>;
  onNavigate: (view: "evidence" | "analytics" | "ledger" | "review" | "public") => void;
}) {
  const [data, setData] = useState<DashboardData | null>(null);
  const [error, setError] = useState("");
  const [switching, setSwitching] = useState("");

  const load = useCallback(async () => {
    const response = await fetch("/api/dashboard", { cache: "no-store" });
    const payload = await response.json();
    if (!response.ok) throw new Error(payload.error ?? "Could not load dashboard.");
    setData(payload);
  }, []);

  useEffect(() => {
    load().catch((reason) => setError(reason.message));
  }, [load, role]);

  async function switchRole(nextRole: Role) {
    setSwitching(nextRole);
    const form = new FormData();
    form.set("action", "switch_demo_role");
    form.set("role", nextRole);
    const response = await fetch("/api/registry", { method: "POST", body: form });
    const payload = await response.json();
    if (!response.ok) {
      setError(payload.error ?? "Could not switch the demo role.");
      setSwitching("");
      return;
    }
    await onRoleChanged();
    setSwitching("");
  }

  if (!data) {
    return <div className="dashboard-loading">{error || "Preparing your stakeholder dashboard…"}</div>;
  }

  const copy = roleCopy[role];
  const project = data.projectCards[0];
  return (
    <div className={`stakeholder-dashboard role-${role}`}>
      <section className="stakeholder-hero">
        <div>
          <span className="overline">{copy.eyebrow}</span>
          <h1>{copy.title}</h1>
          <p>{copy.body}</p>
        </div>
        {data.demo && (
          <div className="demo-switcher">
            <span><i /> SIH guided demo</span>
            <div>
              {roles.map((item) => (
                <button
                  key={item.id}
                  className={role === item.id ? "active" : ""}
                  disabled={Boolean(switching)}
                  onClick={() => switchRole(item.id)}
                >
                  {switching === item.id ? "…" : item.label}
                </button>
              ))}
            </div>
          </div>
        )}
      </section>

      <section className="stakeholder-metrics">
        <div><span>Approved area</span><strong>{data.analytics.totalAreaHectares.toLocaleString()} <small>ha</small></strong><em>GIS-approved boundaries</em></div>
        <div><span>Estimated carbon</span><strong>{Math.round(data.analytics.estimatedAnnualCo2e).toLocaleString()} <small>tCO₂e</small></strong><em>Annual prototype estimate</em></div>
        <div><span>Issued credits</span><strong>{data.analytics.issuedCredits.toLocaleString()}</strong><em>Across active vintages</em></div>
        <div><span>Retired credits</span><strong>{data.analytics.retiredCredits.toLocaleString()}</strong><em>Locked from further transfer</em></div>
      </section>

      {role === "ngo" && project && (
        <NgoDashboard project={project} onNavigate={onNavigate} />
      )}
      {role === "admin" && (
        <AdminDashboard data={data.admin} onNavigate={onNavigate} />
      )}
      {role === "verifier" && (
        <VerifierDashboard data={data} onNavigate={onNavigate} />
      )}
      {role === "community" && (
        <CommunityDashboard data={data.community} project={project} />
      )}
      {role === "buyer" && (
        <BuyerDashboard onNavigate={onNavigate} />
      )}

      <ReportDownloads projectId={project?.id ?? "demo-sundarbans-001"} />
    </div>
  );
}

function NgoDashboard({
  project,
  onNavigate,
}: {
  project: DashboardData["projectCards"][number];
  onNavigate: (view: "evidence" | "analytics" | "ledger" | "review" | "public") => void;
}) {
  return <div className="stakeholder-grid ngo-grid">
    <section className="stake-card project-health">
      <header><span>PRIMARY PROJECT</span><b className="live-dot">Approved for MRV</b></header>
      <h2>{project.name}</h2>
      <p>{project.location} · {project.areaHectares} ha · {project.ecosystem}</p>
      <div className="project-progress"><span style={{ width: "72%" }} /></div>
      <dl>
        <div><dt>Restoration programme</dt><dd>72%</dd></div>
        <div><dt>Evidence items</dt><dd>{project.evidenceCount}</dd></div>
        <div><dt>Annual estimate</dt><dd>{project.estimatedAnnualCo2e.toLocaleString()} tCO₂e</dd></div>
      </dl>
    </section>
    <section className="stake-card action-card">
      <header><span>NEXT ACTION</span><b>{formatDate(project.nextDeadline)}</b></header>
      <h2>Quarterly monitoring due</h2>
      <p>{project.missingSources.length ? `Missing: ${project.missingSources.join(", ")}.` : "All required source types are present. Add the next field observation before the deadline."}</p>
      <button onClick={() => onNavigate("evidence")}>Open evidence ledger →</button>
    </section>
    <section className="stake-card feedback-card">
      <header><span>LATEST VERIFIER FEEDBACK</span><b>Reviewed</b></header>
      <blockquote>“{project.feedback}”</blockquote>
      <button onClick={() => onNavigate("analytics")}>Review MRV analytics →</button>
    </section>
  </div>;
}

function AdminDashboard({
  data,
  onNavigate,
}: {
  data: DashboardData["admin"];
  onNavigate: (view: "evidence" | "analytics" | "ledger" | "review" | "public") => void;
}) {
  return <div className="admin-command">
    <div className="admin-queues">
      {[
        ["Organization approvals", data.pendingOrganizations.length, "Identity and registration review"],
        ["Project approvals", data.pendingProjects.length, "Authorization and plan review"],
        ["Boundary alerts", data.duplicateAlerts.length, "Potential duplicate restoration area"],
        ["Evidence queue", data.evidenceReviewQueue.length, "Awaiting technical decision"],
      ].map(([label, count, detail]) => <div key={String(label)}><span>{label}</span><strong>{count}</strong><small>{detail}</small></div>)}
    </div>
    <div className="stakeholder-grid admin-grid">
      <section className="stake-card risk-card">
        <header><span>SYSTEM RISK ALERTS</span><b>{data.risks.length} open</b></header>
        <div className="risk-list">
          {data.risks.map((risk, index) => <article key={`${risk.title}-${index}`}><i className={risk.severity} /><div><b>{risk.title}</b><p>{risk.detail}</p></div><span>{risk.severity}</span></article>)}
        </div>
      </section>
      <section className="stake-card admin-review-card">
        <header><span>PROJECT REVIEW QUEUE</span><b>Qualified review</b></header>
        {data.pendingProjects.map((project) => <article key={project.id}><div><b>{project.name}</b><span>{project.status.replaceAll("_", " ")}</span></div><button onClick={() => onNavigate("review")}>Review</button></article>)}
        <button className="text-button" onClick={() => onNavigate("review")}>Open complete review queue →</button>
      </section>
    </div>
  </div>;
}

function VerifierDashboard({
  data,
  onNavigate,
}: {
  data: DashboardData;
  onNavigate: (view: "evidence" | "analytics" | "ledger" | "review" | "public") => void;
}) {
  return <div className="stakeholder-grid verifier-grid">
    <section className="stake-card verifier-timeline">
      <header><span>EVIDENCE TIMELINE</span><button onClick={() => onNavigate("evidence")}>Review evidence</button></header>
      {data.evidenceTimeline.slice(0, 4).map((item) => <article key={item.id}><i /><div><b>{item.period_label}</b><span>{formatDate(item.observed_at)} · {item.source_type}</span></div><em className={item.review?.decision ?? "pending"}>{item.review?.decision ?? "pending"}</em></article>)}
    </section>
    <section className="stake-card satellite-compare">
      <header><span>SATELLITE COMPARISON</span><b>Sentinel-2 · 7.8% cloud</b></header>
      <div>
        <figure className="baseline-scene"><span>Baseline · 2025</span><b>NDVI 0.31</b></figure>
        <figure className="current-scene"><span>Current · 2026</span><b>NDVI 0.58</b></figure>
      </div>
      <p><b>+87%</b> vegetation-index improvement across the approved monitoring boundary.</p>
    </section>
    <section className="stake-card assumption-card">
      <header><span>CARBON ASSUMPTIONS</span><button onClick={() => onNavigate("analytics")}>Inspect model</button></header>
      <dl>
        <div><dt>Biomass model</dt><dd>{data.verifier.assumptions.mangrove}</dd></div>
        <div><dt>Uncertainty</dt><dd>{data.verifier.assumptions.uncertainty}</dd></div>
        <div><dt>Remote sensing</dt><dd>{data.verifier.assumptions.ndvi}</dd></div>
      </dl>
    </section>
    <section className="stake-card anchor-card">
      <header><span>BLOCKCHAIN ANCHORING</span><button onClick={() => onNavigate("ledger")}>Open BlueLedger</button></header>
      {data.verifier.anchoring.slice(0, 4).map((item, index) => <article key={`${item.eventHash}-${index}`}><span className={item.transactionId ? "anchored" : ""}>{item.transactionId ? "✓" : "…"}</span><div><b>{item.eventType.replaceAll("_", " ")}</b><code>{shortHash(item.eventHash)}</code></div><em>{item.transactionId ? "Amoy anchored" : "Prepared"}</em></article>)}
    </section>
  </div>;
}

function CommunityDashboard({
  data,
  project,
}: {
  data: DashboardData["community"];
  project?: DashboardData["projectCards"][number];
}) {
  return <div className="community-mobile">
    <section className="community-progress-card">
      <span>RESTORATION ACTIVITY</span>
      <h2>{project?.name ?? "Community project"}</h2>
      <div className="community-numbers">
        <div><strong>{data.saplings.toLocaleString()}</strong><small>Saplings recorded</small></div>
        <div><strong>{data.survivalPercent}%</strong><small>Observed survival</small></div>
        <div><strong>{data.approvedCredits.toLocaleString()}</strong><small>Approved credits</small></div>
      </div>
      <div className="survival-bar"><span style={{ width: `${data.survivalPercent}%` }} /></div>
      <p>Field activity and credit totals are drawn from verifier-reviewed records.</p>
    </section>
    <section className="community-benefits">
      <header><div><span>TRANSPARENT BENEFIT RECORD</span><h2>Funding reaching the community</h2></div><b>Hash-backed</b></header>
      {data.benefits.map((item) => <article key={item.id}><div className="benefit-icon">₹</div><div><b>{item.beneficiary}</b><p>{item.description}</p><code>{shortHash(item.proof_hash)}</code></div><strong>₹{Number(item.amount).toLocaleString("en-IN")}</strong></article>)}
    </section>
  </div>;
}

function BuyerDashboard({ onNavigate }: { onNavigate: (view: "evidence" | "analytics" | "ledger" | "review" | "public") => void }) {
  return <section className="buyer-callout">
    <div><span className="overline">Verified project discovery</span><h2>Explore the public credit registry.</h2><p>Search approved blue-carbon projects, inspect MRV hashes, follow Amoy transactions and validate whether a credit batch is active or permanently retired.</p></div>
    <button onClick={() => onNavigate("public")}>Open public registry <span>→</span></button>
  </section>;
}

function ReportDownloads({ projectId }: { projectId: string }) {
  const reports = [
    ["Technical MRV report", "Evidence, carbon assumptions and unresolved flags", `/api/reports?type=mrv&projectId=${projectId}`, "PDF"],
    ["Credit certificate", "Current issuance or retirement status with proof hashes", `/api/reports?type=certificate&projectId=${projectId}`, "PDF"],
    ["Project audit trail", "Chronological event hashes and transaction identifiers", `/api/reports?type=audit&projectId=${projectId}`, "CSV"],
  ];
  return <section className="report-downloads">
    <header><div><span>REPORTING CENTRE</span><h2>Evidence that travels with the project.</h2></div><p>Downloads are generated from current registry records.</p></header>
    <div>{reports.map(([title, detail, href, type]) => <a key={title} href={href}><span className="report-file-icon">{type}</span><div><b>{title}</b><small>{detail}</small></div><em>Download ↓</em></a>)}</div>
  </section>;
}
