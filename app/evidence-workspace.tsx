"use client";

import { useCallback, useEffect, useState } from "react";

type Role = "ngo" | "community" | "admin" | "verifier" | "buyer";

type Project = {
  id: string;
  name: string;
  ecosystem: string;
  state: string;
  district: string;
  village: string;
  areaHectares: number;
  responsibleOrganization: string;
  communityPartner: string;
};

type Baseline = {
  id: string;
  projectId: string;
  baselineDate: string;
  ndviMean: number;
  eviMean: number;
  ndwiMean: number;
  saviMean: number;
  msaviMean: number;
  confidenceScore: number;
  trueColorPath: string;
  ndviMapPath: string;
  createdAt: string;
};

type SatelliteScene = {
  id: string;
  sceneId: string;
  platform: string;
  cloudCoverPercent: number;
  sclCloudRatio?: number;
  sclShadowRatio?: number;
  sclValidRatio?: number;
  acquisitionDate: string;
  trueColorPath: string;
};

type VegetationAnalysis = {
  id: string;
  ndviMin: number;
  ndviMax: number;
  ndviMean: number;
  ndwiMean: number;
  eviMean: number;
  saviMean: number;
  msaviMean: number;
  agbEstimated?: number;
  bgbEstimated?: number;
  totalBiomassTons?: number;
  trueColorPath: string;
  ndviMapPath: string;
};

type MrvReportTimeline = {
  id: string;
  status: string;
  note: string;
  actorEmail: string;
  createdAt: string;
};

type MrvReport = {
  id: string;
  algorithmVersion: string;
  ndviDeltaPercent: number;
  baselineDeltaPercent: number;
  yoyDeltaPercent?: number;
  rollingMeanNdvi?: number;
  confidenceScore: number;
  mqiScore?: number;
  qualityFlagsJson?: string;
  anomalyDetected: boolean;
  anomalyReason?: string;
  verificationStatus: "awaiting_verification" | "verified" | "flagged";
  verifierComment?: string;
  verifiedAt?: string;
  verifiedById?: string;
  timeline: MrvReportTimeline[];
};

type MonitoringCycle = {
  id: string;
  periodKey: string;
  monitoringStage: string;
  status: "scheduled" | "running" | "completed" | "failed" | "skipped";
  retryCount: number;
  errorMessage?: string;
  scheduledAt: string;
  startedAt?: string;
  completedAt?: string;
  satelliteScenes: SatelliteScene[];
  vegetation?: VegetationAnalysis;
  mrvReport?: MrvReport;
};

// Factors for local carbon estimation projection display
const factors: Record<string, { biomass: number; carbon: number }> = {
  mangrove: { biomass: 12.4, carbon: 0.47 },
  seagrass: { biomass: 4.2, carbon: 0.45 },
  salt_marsh: { biomass: 7.1, carbon: 0.46 },
};

function formatDateTime(value: string) {
  return new Intl.DateTimeFormat("en-IN", {
    day: "2-digit",
    month: "short",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  }).format(new Date(value));
}

function formatDate(value: string) {
  return new Intl.DateTimeFormat("en-IN", {
    day: "2-digit",
    month: "short",
    year: "numeric",
  }).format(new Date(value));
}

export default function EvidenceWorkspace({ role }: { role: Role }) {
  const [projects, setProjects] = useState<Project[]>([]);
  const [selectedProjectId, setSelectedProjectId] = useState("");
  const [baseline, setBaseline] = useState<Baseline | null>(null);
  const [cycles, setCycles] = useState<MonitoringCycle[]>([]);
  const [loading, setLoading] = useState(true);
  const [triggering, setTriggering] = useState(false);
  const [notice, setNotice] = useState("");
  const [error, setError] = useState("");

  const canTrigger = ["ngo", "community", "admin"].includes(role);
  const canReview = ["admin", "verifier"].includes(role);

  // Load baseline & monitoring cycles
  const loadReports = useCallback(async (projectId: string) => {
    setLoading(true);
    setError("");
    try {
      const response = await fetch(`/api/mrv/reports?projectId=${encodeURIComponent(projectId)}`, {
        cache: "no-store",
      });
      const data = await response.json();
      if (response.ok) {
        setBaseline(data.baseline ?? null);
        setCycles(data.cycles ?? []);
      } else {
        setError(data.error ?? "Failed to load satellite reports.");
      }
    } catch (err) {
      setError("Network error loading MRV data.");
    } finally {
      setLoading(false);
    }
  }, []);

  // Load all projects initially
  const loadProjects = useCallback(async () => {
    try {
      const response = await fetch("/api/projects", { cache: "no-store" });
      if (response.ok) {
        const data = await response.json();
        const approved = (data.projects ?? []).filter((p: any) => p.status === "APPROVED");
        setProjects(approved);
        if (approved.length > 0) {
          setSelectedProjectId(approved[0].id);
          loadReports(approved[0].id);
        } else {
          setLoading(false);
        }
      }
    } catch {
      setError("Failed to load approved projects.");
      setLoading(false);
    }
  }, [loadReports]);

  useEffect(() => {
    loadProjects();
  }, [loadProjects]);

  const handleProjectChange = (id: string) => {
    setSelectedProjectId(id);
    loadReports(id);
  };

  // Trigger manual satellite monitoring cycle run
  const triggerMonitoring = async () => {
    if (!selectedProjectId) return;
    setTriggering(true);
    setNotice("");
    setError("");
    try {
      const response = await fetch("/api/mrv/trigger", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          projectId: selectedProjectId,
          date: new Date().toISOString(), // current month cycle
        }),
      });
      const data = await response.json();
      if (response.ok) {
        setNotice(data.message ?? "Satellite fetch and index calculation run completed.");
        await loadReports(selectedProjectId);
      } else {
        setError(data.error ?? "Trigger run failed.");
      }
    } catch {
      setError("Network error running monitoring cycle.");
    } finally {
      setTriggering(false);
    }
  };

  const activeProject = projects.find((p) => p.id === selectedProjectId);

  if (loading && !projects.length) {
    return (
      <div className="mrv-loading panel">
        <span className="integrity-lock">#</span>
        <h2>Opening the Automated MRV System…</h2>
        <p>Loading Sentinel-2 catalog feeds and NDVI pipelines.</p>
      </div>
    );
  }

  if (projects.length === 0) {
    return (
      <>
        <section className="page-heading">
          <div>
            <span className="eyebrow">Technical MRV</span>
            <h1>Satellite Monitoring Ledger</h1>
            <p>Automated Sentinel-2 vegetation analysis starts after a project is approved.</p>
          </div>
        </section>
        <section className="panel no-mrv-projects">
          <span>🛰️</span>
          <h2>No approved projects available</h2>
          <p>
            Once an administrator approves a restoration project boundary, its baseline
            and scheduled satellite monitoring reports will appear here.
          </p>
        </section>
      </>
    );
  }

  return (
    <div className="satellite-mrv-workspace">
      {notice && (
        <div className="notice">
          <span>✓</span>{notice}
          <button onClick={() => setNotice("")}>×</button>
        </div>
      )}
      {error && (
        <div className="ledger-alert error">
          <span>!</span>{error}
          <button onClick={() => setError("")}>×</button>
        </div>
      )}

      {/* Hero Header */}
      <section className="mrv-hero">
        <div className="mrv-title">
          <span className="eyebrow">Automated MRV · Phase 4 Refined Telemetry</span>
          <h1>Satellite Monitoring Ledger</h1>
          <p>Pixel-level SCL masking, Biomass partitioning, and Composite Quality Indices (MQI).</p>
        </div>
        <div className="mrv-project-select">
          <label>Active Project</label>
          <select
            value={selectedProjectId}
            onChange={(e) => handleProjectChange(e.target.value)}
          >
            {projects.map((p) => (
              <option key={p.id} value={p.id}>{p.name}</option>
            ))}
          </select>
        </div>
        {canTrigger && (
          <button
            className="primary-button"
            disabled={triggering || !selectedProjectId}
            onClick={triggerMonitoring}
          >
            {triggering ? "Calculating telemetry…" : "＋ Trigger satellite check"}
          </button>
        )}
      </section>

      {/* Project Details */}
      {activeProject && (
        <section className="mrv-project-band">
          <div className={`eco-icon ${activeProject.ecosystem}`}>
            {activeProject.ecosystem === "mangrove" ? "♧" : activeProject.ecosystem === "seagrass" ? "≋" : "⌁"}
          </div>
          <div>
            <strong>{activeProject.name}</strong>
            <span>{activeProject.village}, {activeProject.district}, {activeProject.state}</span>
          </div>
          <dl>
            <div><dt>Boundary Area</dt><dd>{activeProject.areaHectares.toFixed(2)} ha</dd></div>
            <div><dt>Ecosystem Class</dt><dd>{activeProject.ecosystem.toUpperCase().replace("_", " ")}</dd></div>
            <div><dt>MRV Schedule</dt><dd><span className="mrv-active-dot" /> Monthly automated checks</dd></div>
          </dl>
        </section>
      )}

      {/* Baseline Section */}
      {baseline ? (
        <section className="ledger-panel panel baseline-section" style={{ marginBottom: "2rem" }}>
          <header className="ledger-head">
            <div>
              <span className="eyebrow">Immutable reference point</span>
              <h2>Project Baseline (Pre-Restoration Anchor)</h2>
            </div>
            <span className="append-only-badge" style={{ backgroundColor: "#1e293b", color: "#f8fafc" }}>
              Baseline Anchored: {formatDate(baseline.baselineDate)}
            </span>
          </header>
          <div className="baseline-content" style={{ display: "grid", gridTemplateColumns: "1fr 2fr", gap: "2rem", marginTop: "1rem" }}>
            <div className="baseline-maps" style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "1rem" }}>
              <div>
                <small style={{ display: "block", marginBottom: "0.25rem", color: "#64748b" }}>True-Color Preview</small>
                <img src={baseline.trueColorPath} alt="Baseline True Color" style={{ width: "100%", borderRadius: "8px", border: "1px solid #e2e8f0" }} />
              </div>
              <div>
                <small style={{ display: "block", marginBottom: "0.25rem", color: "#64748b" }}>NDVI Heatmap</small>
                <img src={baseline.ndviMapPath} alt="Baseline NDVI Heatmap" style={{ width: "100%", borderRadius: "8px", border: "1px solid #e2e8f0" }} />
              </div>
            </div>
            <div className="baseline-stats">
              <h4 style={{ margin: "0 0 1rem 0", color: "#1e293b" }}>Calculated Reference Scores</h4>
              <div className="sensor-values" style={{ display: "grid", gridTemplateColumns: "repeat(5, 1fr)", gap: "1rem" }}>
                <div><span>NDVI Mean</span><strong>{baseline.ndviMean}</strong></div>
                <div><span>EVI Mean</span><strong>{baseline.eviMean}</strong></div>
                <div><span>NDWI Mean</span><strong>{baseline.ndwiMean}</strong></div>
                <div><span>SAVI Mean</span><strong>{baseline.saviMean}</strong></div>
                <div><span>MSAVI Mean</span><strong>{baseline.msaviMean}</strong></div>
              </div>
              <p style={{ marginTop: "1rem", fontSize: "0.85rem", color: "#64748b" }}>
                This baseline establishes the pre-restoration biomass reference. Future vegetation delta growth
                compared to these scores determines the additionality of carbon sequestration.
              </p>
            </div>
          </div>
        </section>
      ) : (
        <div className="panel" style={{ padding: "2rem", textAlign: "center", marginBottom: "2rem" }}>
          <h3>Awaiting Baseline Establishment</h3>
          <p>Sentinel-2 imagery baseline will be generated automatically once the project triggers its first satellite scan.</p>
        </div>
      )}

      {/* Monitoring Timeline */}
      <section className="ledger-panel panel">
        <header className="ledger-head">
          <div>
            <span className="eyebrow">Chronological timeline</span>
            <h2>Automated Telemetry Runs</h2>
          </div>
        </header>

        {cycles.length > 0 ? (
          <div className="evidence-timeline">
            {cycles.map((cycle) => (
              <CycleCard
                key={cycle.id}
                cycle={cycle}
                baseline={baseline}
                project={activeProject}
                canReview={canReview}
                onReviewed={async () => {
                  if (selectedProjectId) await loadReports(selectedProjectId);
                }}
              />
            ))}
          </div>
        ) : (
          <div className="empty-ledger">
            <span>🛰️</span>
            <h3>No telemetry runs completed yet</h3>
            <p>Trigger a satellite check to fetch the first Sentinel-2 imagery and compute vegetation indices.</p>
          </div>
        )}
      </section>
    </div>
  );
}

function CycleCard({
  cycle,
  baseline,
  project,
  canReview,
  onReviewed,
}: {
  cycle: MonitoringCycle;
  baseline: Baseline | null;
  project?: Project;
  canReview: boolean;
  onReviewed: () => Promise<void>;
}) {
  const [open, setOpen] = useState(false);
  const [comment, setComment] = useState("");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");

  const scene = cycle.satelliteScenes[0];
  const veg = cycle.vegetation;
  const report = cycle.mrvReport;

  const qualityFlags: string[] = report?.qualityFlagsJson 
    ? (() => { try { return JSON.parse(report.qualityFlagsJson); } catch { return []; } })() 
    : [];

  // Calculate carbon estimations locally for presentation based on baseline or current
  const carbonEst = project && veg && baseline
    ? (() => {
        const factor = factors[project.ecosystem.toLowerCase()] || factors.mangrove;
        const annualCeiling = project.areaHectares * factor.biomass * factor.carbon * (44 / 12);
        const periodCeiling = annualCeiling * (30 / 365); // Monthly fraction
        
        let ndviDeltaPercent = report ? report.ndviDeltaPercent : 0;
        let growthMultiplier = 1.0;
        if (ndviDeltaPercent > 0) {
          growthMultiplier = 1.0 + Math.min(0.1, ndviDeltaPercent / 100);
        } else if (ndviDeltaPercent < 0) {
          growthMultiplier = Math.max(0.0, 1.0 + ndviDeltaPercent / 100);
        }
        
        const tons = Number(Math.min(periodCeiling * 1.1, periodCeiling * growthMultiplier).toFixed(2));
        return { tons, credits: Math.floor(tons) };
      })()
    : null;

  const submitReview = async (status: "verified" | "flagged") => {
    if (!report) return;
    setSaving(true);
    setError("");
    try {
      const response = await fetch("/api/mrv/review", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          reportId: report.id,
          status,
          comment,
        }),
      });
      const data = await response.json();
      if (response.ok) {
        setOpen(false);
        setComment("");
        await onReviewed();
      } else {
        setError(data.error ?? "Failed to save verification.");
      }
    } catch {
      setError("Network error recording verification.");
    } finally {
      setSaving(false);
    }
  };

  return (
    <article className="evidence-entry">
      <div className="timeline-marker">
        <span className="source-icon violet">◉</span>
      </div>
      <div className="evidence-card">
        <header>
          <div>
            <span className="evidence-type">
              {report?.algorithmVersion ? `Algorithm ${report.algorithmVersion}` : "Satellite Scan Run"}
            </span>
            <h3>{cycle.periodKey} Monitoring Cycle</h3>
            <p>Target Date: {formatDate(cycle.scheduledAt)}</p>
          </div>
          <div className="evidence-card-status">
            <span className={`period-tag quarterly`}>{cycle.status.toUpperCase()}</span>
            {report && (
              <span className={`evidence-status ${report.verificationStatus === "verified" ? "approved" : report.verificationStatus === "flagged" ? "rejected" : "pending"}`}>
                <i />
                {report.verificationStatus === "verified" ? "Verified" : report.verificationStatus === "flagged" ? "Flagged Anomaly" : "Awaiting Audit"}
              </span>
            )}
          </div>
        </header>

        {cycle.status === "running" && (
          <div className="mrv-loading-inner" style={{ padding: "1rem", textAlign: "center", color: "#64748b" }}>
            <span>🌀</span> Querying catalog, processing bands, and cloud masking...
          </div>
        )}

        {cycle.status === "failed" && (
          <div className="mrv-failed-inner" style={{ padding: "1rem", color: "#ef4444" }}>
            <strong>Processing Failed:</strong> {cycle.errorMessage || "Unknown pipeline error."}
          </div>
        )}

        {cycle.status === "skipped" && (
          <div className="mrv-failed-inner" style={{ padding: "1rem", color: "#f59e0b" }}>
            <strong>Cycle Skipped:</strong> {cycle.errorMessage || "Extreme cloud obstruction."}
          </div>
        )}

        {cycle.status === "completed" && veg && report && (
          <>
            {/* Map Previews */}
            <div className="evidence-images comparison" style={{ margin: "1rem 0" }}>
              <div>
                <img src={veg.trueColorPath} alt="Scene True Color" style={{ border: "1px solid #cbd5e1" }} />
                <span>Sentinel-2 True Color ({scene?.sceneId || "Telemetry Scene"})</span>
              </div>
              <div>
                <img src={veg.ndviMapPath} alt="NDVI Heatmap" style={{ border: "1px solid #cbd5e1" }} />
                <span>Clipped NDVI Heatmap Overlay</span>
              </div>
            </div>

            {/* Computed Index Metrics */}
            <h4 style={{ margin: "1.5rem 0 0.5rem 0", color: "#1e293b" }}>Computed Telemetry Stats</h4>
            <div className="sensor-values" style={{ display: "grid", gridTemplateColumns: "repeat(5, 1fr)", gap: "1rem" }}>
              <div><span>NDVI Mean</span><strong>{veg.ndviMean} <small>({veg.ndviMin} ~ {veg.ndviMax})</small></strong></div>
              <div><span>EVI Mean</span><strong>{veg.eviMean}</strong></div>
              <div><span>NDWI Mean</span><strong>{veg.ndwiMean}</strong></div>
              <div><span>SAVI Mean</span><strong>{veg.saviMean}</strong></div>
              <div><span>MSAVI Mean</span><strong>{veg.msaviMean}</strong></div>
            </div>

            {/* Biomass Breakdown (Phase 4) */}
            {veg.agbEstimated !== undefined && veg.agbEstimated !== null && (
              <div style={{ marginTop: "1rem", padding: "0.75rem 1rem", backgroundColor: "#f8fafc", borderRadius: "6px", border: "1px solid #e2e8f0" }}>
                <strong style={{ fontSize: "0.85rem", color: "#334155" }}>🌴 Ecosystem Biomass Stocks</strong>
                <div style={{ display: "grid", gridTemplateColumns: "repeat(3, 1fr)", gap: "1rem", marginTop: "0.5rem", fontSize: "0.85rem" }}>
                  <div><span style={{ color: "#64748b" }}>AGB Density:</span> <strong>{veg.agbEstimated} t/ha</strong></div>
                  <div><span style={{ color: "#64748b" }}>BGB Density:</span> <strong>{veg.bgbEstimated} t/ha</strong></div>
                  <div><span style={{ color: "#64748b" }}>Total Biomass:</span> <strong>{veg.totalBiomassTons} tons</strong></div>
                </div>
              </div>
            )}

            {/* Trend Calculations */}
            <h4 style={{ margin: "1.5rem 0 0.5rem 0", color: "#1e293b" }}>Automatic Trend Analysis</h4>
            <div className="evidence-data-grid" style={{ display: "grid", gridTemplateColumns: "repeat(5, 1fr)", gap: "1rem" }}>
              <div>
                <span>Delta vs Prior Month</span>
                <strong style={{ color: report.ndviDeltaPercent >= 0 ? "#10b981" : "#ef4444" }}>
                  {report.ndviDeltaPercent >= 0 ? "＋" : ""}{report.ndviDeltaPercent}%
                </strong>
              </div>
              <div>
                <span>Delta vs Baseline</span>
                <strong style={{ color: report.baselineDeltaPercent >= 0 ? "#10b981" : "#ef4444" }}>
                  {report.baselineDeltaPercent >= 0 ? "＋" : ""}{report.baselineDeltaPercent}%
                </strong>
              </div>
              <div>
                <span>YoY Comparison</span>
                <strong style={{ color: (report.yoyDeltaPercent ?? 0) >= 0 ? "#10b981" : "#ef4444" }}>
                  {report.yoyDeltaPercent !== undefined && report.yoyDeltaPercent !== null ? `${report.yoyDeltaPercent >= 0 ? "＋" : ""}${report.yoyDeltaPercent}%` : "N/A"}
                </strong>
              </div>
              <div>
                <span>MQI Score</span>
                <strong>{((report.mqiScore ?? report.confidenceScore) * 100).toFixed(0)}% <small>Index</small></strong>
              </div>
              <div>
                <span>SCL Valid Pixels</span>
                <strong>{scene?.sclValidRatio !== undefined && scene?.sclValidRatio !== null ? `${(scene.sclValidRatio * 100).toFixed(0)}%` : `${100 - (scene?.cloudCoverPercent || 0)}%`}</strong>
              </div>
            </div>

            {/* Quality Audit Flags */}
            {qualityFlags.length > 0 && (
              <div style={{ marginTop: "0.75rem", padding: "0.5rem 0.75rem", backgroundColor: "#f0f9ff", borderRadius: "6px", borderLeft: "3px solid #0284c7" }}>
                <small style={{ color: "#0369a1", fontWeight: 600 }}>Quality Framework Audit Notes:</small>
                <ul style={{ margin: "0.25rem 0 0 1.25rem", padding: 0, fontSize: "0.8rem", color: "#0c4a6e" }}>
                  {qualityFlags.map((flag, idx) => (
                    <li key={idx}>{flag}</li>
                  ))}
                </ul>
              </div>
            )}

            {report.anomalyDetected && (
              <div style={{ padding: "1rem", backgroundColor: "#fef2f2", borderLeft: "4px solid #ef4444", borderRadius: "4px", margin: "1rem 0" }}>
                <strong style={{ color: "#991b1b" }}>⚠️ Deforestation / Regression Alert</strong>
                <p style={{ margin: "0.25rem 0 0 0", fontSize: "0.85rem", color: "#7f1d1d" }}>{report.anomalyReason}</p>
              </div>
            )}

            {/* Carbon Estimation */}
            {carbonEst && (
              <div style={{ padding: "1rem", backgroundColor: "#f0fdf4", borderLeft: "4px solid #22c55e", borderRadius: "4px", margin: "1rem 0" }}>
                <strong style={{ color: "#166534" }}>🌳 Automated Carbon Estimations</strong>
                <p style={{ margin: "0.25rem 0 0 0", fontSize: "0.85rem", color: "#14532d" }}>
                  Estimated additions: <strong>{carbonEst.tons} tCO₂e</strong> sequestered during this cycle, generating <strong>{carbonEst.credits} credits</strong> inside compliance ceilings.
                </p>
              </div>
            )}

            {/* Audit Trail */}
            {report.timeline.length > 0 && (
              <div className="review-history" style={{ marginTop: "1rem" }}>
                {report.timeline.map((entry) => (
                  <div key={entry.id}>
                    <i>{entry.status === "VERIFIED" ? "✓" : entry.status === "FLAGGED" ? "×" : "?"}</i>
                    <span>
                      <strong>{entry.status}</strong>
                      <small>{entry.actorEmail} · {formatDateTime(entry.createdAt)}</small>
                      {entry.note && <p>{entry.note}</p>}
                    </span>
                  </div>
                ))}
              </div>
            )}

            {/* Verifier Review controls */}
            {canReview && report.verificationStatus === "awaiting_verification" && (
              <div className="verifier-box" style={{ marginTop: "1.5rem" }}>
                <div>
                  <span>MRV Compliance Verification</span>
                  <strong>Establish if satellite readings conform with boundary and additionality limits.</strong>
                </div>
                {!open ? (
                  <button className="secondary-button" onClick={() => setOpen(true)}>Review Report</button>
                ) : (
                  <div className="verifier-form" style={{ marginTop: "1rem" }}>
                    <label>
                      Verifier Assessment Notes
                      <textarea
                        value={comment}
                        onChange={(e) => setComment(e.target.value)}
                        placeholder="Document observations regarding cloud mask, NDVI density, anomalies..."
                      />
                    </label>
                    {error && <p className="form-error">{error}</p>}
                    <div style={{ display: "flex", gap: "1rem" }}>
                      <button
                        className="reject-button"
                        disabled={saving}
                        onClick={() => submitReview("flagged")}
                      >
                        {saving ? "Flagging..." : "Flag Anomaly"}
                      </button>
                      <button
                        className="primary-button"
                        disabled={saving}
                        onClick={() => submitReview("verified")}
                      >
                        {saving ? "Verifying..." : "Verify & Approve Report"}
                      </button>
                    </div>
                  </div>
                )}
              </div>
            )}
          </>
        )}
      </div>
    </article>
  );
}
