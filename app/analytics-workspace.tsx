"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";

type Flag = {
  severity: "high" | "medium" | "low";
  code: string;
  message: string;
  evidenceId?: string;
};

type AnalyticsProject = {
  id: string;
  name: string;
  ecosystem: string;
  village: string;
  district: string;
  state: string;
};

type Analysis = {
  project: {
    id: string;
    name: string;
    ecosystem: string;
    location: string;
    responsibleOrganization: string;
    communityPartner: string;
    boundaryGeojson: string;
  };
  gis: {
    approvedAreaHectares: number;
    submittedAreaHectares: number;
    coordinateCount: number;
    duplicateCoordinateCount: number;
    projectChecks: Array<{
      projectId: string;
      projectName: string;
      overlap: boolean;
      similarityScore: number;
      suspiciouslySimilar: boolean;
      sharedCoordinatePercent: number;
    }>;
    flags: Flag[];
    method: string;
  };
  ndvi: {
    points: Array<{
      id: string;
      date: string;
      value: number;
      mode: "submitted" | "simulated";
      sceneId: string;
      platform: string;
      cloudCover: number;
      monitoringStage: string;
    }>;
    baseline: number | null;
    current: number | null;
    change: number | null;
    trend: "insufficient_data" | "degradation" | "improving" | "stable";
    flags: Flag[];
    method: string;
  };
  quality: {
    score: number;
    items: Array<{
      id: string;
      sourceType: string;
      monitoringStage: string;
      periodLabel: string;
      observedAt: string;
      uploaderEmail: string;
      score: number;
      locationInside: boolean | null;
      flags: Flag[];
      latestReview: {
        decision: string;
        comment?: string;
        reviewerEmail: string;
        reviewedAt: string;
      } | null;
      fileCount: number;
      hashes: string[];
    }>;
    method: string;
  };
  carbon: {
    ecosystemLabel: string;
    approvedAreaHectares: number;
    biomassFactor: number;
    carbonConversionFactor: number;
    co2ConversionFactor: number;
    uncertaintyPercent: number;
    annualCarbonTonnes: number;
    annualCo2eTonnes: number;
    lowerCo2eTonnes: number;
    upperCo2eTonnes: number;
    assumptions: string[];
  };
  confidence: {
    score: number;
    components: Record<string, number>;
    weights: Record<string, number>;
  };
  report: {
    generatedAt: string;
    evidenceItemCount: number;
    evidenceFileCount: number;
    unresolvedFlags: Flag[];
  };
};

const sourceNames: Record<string, string> = {
  field_photo: "Field evidence",
  sensor: "Sensor reading",
  drone: "Drone survey",
  satellite: "Satellite scene",
};

const confidenceLabels: Record<string, string> = {
  evidenceCompleteness: "Evidence completeness",
  sensorAvailability: "Sensor availability",
  satelliteFreshness: "Satellite freshness",
  locationConsistency: "Location consistency",
  verifierApproval: "Verifier approval",
};

function formatDate(value: string) {
  return new Intl.DateTimeFormat("en-IN", {
    day: "2-digit",
    month: "short",
    year: "numeric",
  }).format(new Date(value));
}

function ecosystemLabel(value: string) {
  if (value === "salt_marsh") return "Salt marsh";
  return value.charAt(0).toUpperCase() + value.slice(1);
}

function severityLabel(flags: Flag[]) {
  if (flags.some((flag) => flag.severity === "high")) return "Action required";
  if (flags.some((flag) => flag.severity === "medium")) return "Review advised";
  return "No flags";
}

export default function AnalyticsWorkspace() {
  const [projects, setProjects] = useState<AnalyticsProject[]>([]);
  const [selectedProjectId, setSelectedProjectId] = useState("");
  const [analysis, setAnalysis] = useState<Analysis | null>(null);
  const [loading, setLoading] = useState(true);
  const [triggering, setTriggering] = useState(false);
  const [notice, setNotice] = useState("");
  const [error, setError] = useState("");
  const [reportOpen, setReportOpen] = useState(false);

  const load = useCallback(async (projectId?: string) => {
    setLoading(true);
    const suffix = projectId ? `?projectId=${encodeURIComponent(projectId)}` : "";
    const response = await fetch(`/api/analytics${suffix}`, { cache: "no-store" });
    if (response.ok) {
      const data = await response.json();
      setProjects(data.projects ?? []);
      setSelectedProjectId(data.selectedProjectId ?? "");
      setAnalysis(data.analysis ?? null);
    }
    setLoading(false);
  }, []);

  useEffect(() => {
    load();
  }, [load]);

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
          date: new Date().toISOString(),
        }),
      });
      const data = await response.json();
      if (response.ok) {
        setNotice(data.message ?? "Satellite observation cycle completed.");
        await load(selectedProjectId);
      } else {
        setError(data.error ?? "Trigger run failed.");
      }
    } catch {
      setError("Network error running satellite monitoring cycle.");
    } finally {
      setTriggering(false);
    }
  };

  if (loading && !analysis) {
    return (
      <section className="analytics-loading panel">
        <div className="analysis-pulse"><span /></div>
        <h2>Running transparent MRV checks…</h2>
        <p>Screening geometry, evidence quality, vegetation signals and carbon assumptions.</p>
      </section>
    );
  }

  if (!analysis || !projects.length) {
    return (
      <>
        <section className="page-heading">
          <div><span className="eyebrow">AI-assisted verification</span><h1>MRV analytics</h1><p>Analysis becomes available after a project is approved for MRV.</p></div>
        </section>
        <section className="panel no-analytics">
          <span>⌁</span><h2>No approved project to analyse</h2>
          <p>Approve a project and add monitoring evidence to generate technical metrics.</p>
        </section>
      </>
    );
  }

  const highFlags = analysis.report.unresolvedFlags.filter((flag) => flag.severity === "high").length;
  const trendLabel =
    analysis.ndvi.trend === "improving" ? "Vegetation improving" :
      analysis.ndvi.trend === "degradation" ? "Possible degradation" :
        analysis.ndvi.trend === "stable" ? "Vegetation stable" : "Insufficient scenes";

  return (
    <>
      {notice && (
        <div className="notice" style={{ marginBottom: "1rem" }}>
          <span>✓</span>{notice}
          <button onClick={() => setNotice("")}>×</button>
        </div>
      )}
      {error && (
        <div className="ledger-alert error" style={{ marginBottom: "1rem" }}>
          <span>!</span>{error}
          <button onClick={() => setError("")}>×</button>
        </div>
      )}

      <section className="analytics-hero">
        <div>
          <span className="eyebrow">Explainable technical MRV</span>
          <h1>Verification & carbon model</h1>
          <p>Every score exposes its inputs, rules, assumptions and unresolved issues.</p>
        </div>
        <label>
          Analysed project
          <select value={selectedProjectId} onChange={(event) => load(event.target.value)}>
            {projects.map((project) => <option key={project.id} value={project.id}>{project.name}</option>)}
          </select>
        </label>
        <div style={{ display: "flex", gap: "0.75rem", alignItems: "center" }}>
          <button
            className="report-button"
            disabled={triggering || !selectedProjectId}
            onClick={triggerMonitoring}
            style={{ backgroundColor: "#059669", color: "white", borderColor: "#047857" }}
          >
            <span>🛰️</span>
            <div>
              <strong>{triggering ? "Calculating…" : "Trigger Satellite Check"}</strong>
              <small>Sentinel-2 telemetry cycle</small>
            </div>
            <b>→</b>
          </button>
          <button className="report-button" onClick={() => setReportOpen(true)}>
            <span>▤</span><div><strong>Generate report</strong><small>Technical MRV summary</small></div><b>→</b>
          </button>
        </div>
      </section>

      <section className="analysis-project-strip">
        <span className={`eco-icon ${analysis.project.ecosystem}`}>
          {analysis.project.ecosystem === "mangrove" ? "♧" : analysis.project.ecosystem === "seagrass" ? "≋" : "⌁"}
        </span>
        <div><strong>{analysis.project.name}</strong><small>{analysis.project.location}</small></div>
        <dl>
          <div><dt>Ecosystem</dt><dd>{ecosystemLabel(analysis.project.ecosystem)}</dd></div>
          <div><dt>Approved area</dt><dd>{analysis.gis.approvedAreaHectares.toFixed(2)} ha</dd></div>
          <div><dt>Evidence</dt><dd>{analysis.report.evidenceItemCount} ledger items</dd></div>
          <div><dt>Open high-risk flags</dt><dd className={highFlags ? "risk" : "clear"}>{highFlags}</dd></div>
        </dl>
      </section>

      <section className="analytics-score-grid">
        <ScoreCard label="MRV confidence" value={analysis.confidence.score} suffix="/100" tone="forest" detail="Weighted evidence confidence" />
        <ScoreCard label="Data quality" value={analysis.quality.score} suffix="/100" tone="teal" detail={`${analysis.quality.items.length} evidence items screened`} />
        <ScoreCard label="Current NDVI" value={analysis.ndvi.current ?? 0} suffix="" tone={analysis.ndvi.trend === "degradation" ? "clay" : "leaf"} decimals={3} detail={trendLabel} />
        <ScoreCard label="Annual estimate" value={analysis.carbon.annualCo2eTonnes} suffix=" tCO₂e" tone="sand" decimals={1} detail={`${analysis.carbon.uncertaintyPercent}% uncertainty`} />
      </section>

      <section className="analytics-grid">
        <article className="panel gis-analysis-card">
          <PanelHeading eyebrow="GIS validation" title="Boundary screening" badge={severityLabel(analysis.gis.flags)} badgeTone={analysis.gis.flags.length ? "warn" : "ok"} />
          <BoundaryCanvas geojson={analysis.project.boundaryGeojson} />
          <div className="gis-stat-row">
            <div><span>Calculated approved area</span><strong>{analysis.gis.approvedAreaHectares.toFixed(2)} ha</strong></div>
            <div><span>Boundary vertices</span><strong>{analysis.gis.coordinateCount}</strong></div>
            <div><span>Overlap checks</span><strong>{analysis.gis.projectChecks.length}</strong></div>
            <div><span>Repeated points</span><strong>{analysis.gis.duplicateCoordinateCount}</strong></div>
          </div>
          <FlagList flags={analysis.gis.flags} emptyText="No polygon overlap, duplicate-coordinate or similarity flags detected." />
          {analysis.gis.projectChecks.length > 0 && (
            <details className="analysis-details">
              <summary>Compare registered boundaries <span>{analysis.gis.projectChecks.length} projects screened</span></summary>
              <div className="boundary-comparisons">
                {analysis.gis.projectChecks.map((check) => (
                  <div key={check.projectId}>
                    <strong>{check.projectName}</strong>
                    <span>{check.overlap ? "Overlap detected" : "No intersection"}</span>
                    <b>{check.similarityScore}% similar</b>
                  </div>
                ))}
              </div>
            </details>
          )}
          <MethodNote>{analysis.gis.method}</MethodNote>
        </article>

        <article className="panel ndvi-analysis-card">
          <PanelHeading eyebrow="Vegetation analysis" title="NDVI monitoring trend" badge={trendLabel} badgeTone={analysis.ndvi.trend === "degradation" ? "risk" : "ok"} />
          <NdviChart points={analysis.ndvi.points} />
          <div className="ndvi-comparison">
            <div><span>Baseline</span><strong>{analysis.ndvi.baseline?.toFixed(3) ?? "—"}</strong></div>
            <span className={`ndvi-change ${analysis.ndvi.change !== null && analysis.ndvi.change < 0 ? "negative" : ""}`}>
              {analysis.ndvi.change === null ? "No comparison" : `${analysis.ndvi.change >= 0 ? "+" : ""}${analysis.ndvi.change.toFixed(3)}`}
            </span>
            <div><span>Current</span><strong>{analysis.ndvi.current?.toFixed(3) ?? "—"}</strong></div>
          </div>
          {analysis.ndvi.points.length > 0 && (
            <div className="scene-ledger">
              {analysis.ndvi.points.map((point) => (
                <div key={point.id}>
                  <i className={point.mode} />
                  <span><strong>{point.platform}</strong><small>{formatDate(point.date)} · {point.cloudCover}% cloud</small></span>
                  <code>{point.value.toFixed(3)}</code>
                  <b>{point.mode}</b>
                </div>
              ))}
            </div>
          )}
          <FlagList flags={analysis.ndvi.flags} emptyText="No vegetation-loss or scene-quality flags detected." />
          <MethodNote>{analysis.ndvi.method}</MethodNote>
        </article>
      </section>

      <section className="analytics-grid carbon-confidence-grid">
        <CarbonModel analysis={analysis} />
        <ConfidenceModel confidence={analysis.confidence} />
      </section>

      <section className="panel evidence-quality-panel">
        <PanelHeading eyebrow="AI-assisted evidence checks" title="Evidence quality screening" badge={`${analysis.quality.score}/100 average`} badgeTone={analysis.quality.score >= 75 ? "ok" : "warn"} />
        <div className="quality-method-strip">
          <span>⌖ GPS containment</span><span># Exact duplicate hash</span><span>◫ Small-file blur-risk proxy</span><span>✓ Verifier decision</span>
        </div>
        <div className="quality-table-wrap">
          <table className="quality-table">
            <thead><tr><th>Evidence item</th><th>Period</th><th>Location</th><th>Files</th><th>Verifier</th><th>Quality</th><th>Flags</th></tr></thead>
            <tbody>
              {analysis.quality.items.map((item) => (
                <tr key={item.id}>
                  <td><strong>{sourceNames[item.sourceType] ?? item.sourceType}</strong><small>{formatDate(item.observedAt)} · #{item.id.slice(0, 8)}</small></td>
                  <td>{item.periodLabel}</td>
                  <td>
                    {item.locationInside === null ? <span className="quality-na">Not applicable</span> :
                      item.locationInside ? <span className="quality-pass">✓ Inside site</span> :
                        <span className="quality-fail">! Outside site</span>}
                  </td>
                  <td>{item.fileCount}</td>
                  <td>{item.latestReview ? item.latestReview.decision.replaceAll("_", " ") : "Pending"}</td>
                  <td><QualityScore value={item.score} /></td>
                  <td>{item.flags.length ? <span className="flag-count">{item.flags.length}</span> : <span className="quality-pass">Clear</span>}</td>
                </tr>
              ))}
            </tbody>
          </table>
          {!analysis.quality.items.length && <div className="empty-quality">Add monitoring evidence to begin quality screening.</div>}
        </div>
        <MethodNote>{analysis.quality.method}</MethodNote>
      </section>

      {reportOpen && (
        <TechnicalReport
          analysis={analysis}
          onClose={() => setReportOpen(false)}
        />
      )}
    </>
  );
}

function ScoreCard({
  label,
  value,
  suffix,
  tone,
  detail,
  decimals = 0,
}: {
  label: string;
  value: number;
  suffix: string;
  tone: string;
  detail: string;
  decimals?: number;
}) {
  return (
    <article>
      <span className={`score-card-icon ${tone}`}>{tone === "forest" ? "◎" : tone === "teal" ? "✓" : tone === "sand" ? "C" : "⌁"}</span>
      <div><span>{label}</span><strong>{value.toFixed(decimals)}<small>{suffix}</small></strong><p>{detail}</p></div>
    </article>
  );
}

function PanelHeading({
  eyebrow,
  title,
  badge,
  badgeTone,
}: {
  eyebrow: string;
  title: string;
  badge: string;
  badgeTone: string;
}) {
  return (
    <header className="analysis-panel-head">
      <div><span className="eyebrow">{eyebrow}</span><h2>{title}</h2></div>
      <span className={`analysis-badge ${badgeTone}`}><i />{badge}</span>
    </header>
  );
}

function BoundaryCanvas({ geojson }: { geojson: string }) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    let coordinates: number[][] = [];
    try {
      coordinates = JSON.parse(geojson)?.geometry?.coordinates?.[0] ?? [];
    } catch {}
    const context = canvas.getContext("2d");
    if (!context || !coordinates.length) return;
    const ratio = window.devicePixelRatio || 1;
    const width = canvas.clientWidth;
    const height = canvas.clientHeight;
    canvas.width = width * ratio;
    canvas.height = height * ratio;
    context.scale(ratio, ratio);
    context.fillStyle = "#e9f0eb";
    context.fillRect(0, 0, width, height);
    context.strokeStyle = "rgba(68,111,101,.12)";
    context.lineWidth = 1;
    for (let x = 0; x < width; x += 38) {
      context.beginPath(); context.moveTo(x, 0); context.lineTo(x, height); context.stroke();
    }
    for (let y = 0; y < height; y += 38) {
      context.beginPath(); context.moveTo(0, y); context.lineTo(width, y); context.stroke();
    }
    const lngs = coordinates.map((point) => Number(point[0]));
    const lats = coordinates.map((point) => Number(point[1]));
    const minLng = Math.min(...lngs);
    const maxLng = Math.max(...lngs);
    const minLat = Math.min(...lats);
    const maxLat = Math.max(...lats);
    const pad = 34;
    const project = ([lng, lat]: number[]) => [
      pad + ((lng - minLng) / Math.max(maxLng - minLng, Number.EPSILON)) * (width - pad * 2),
      height - pad - ((lat - minLat) / Math.max(maxLat - minLat, Number.EPSILON)) * (height - pad * 2),
    ];
    context.beginPath();
    coordinates.forEach((point, index) => {
      const [x, y] = project(point);
      if (index === 0) context.moveTo(x, y);
      else context.lineTo(x, y);
    });
    context.closePath();
    context.fillStyle = "rgba(43,138,120,.28)";
    context.strokeStyle = "#0e6557";
    context.lineWidth = 3;
    context.fill();
    context.stroke();
    coordinates.slice(0, -1).forEach((point, index) => {
      const [x, y] = project(point);
      context.beginPath();
      context.arc(x, y, 4, 0, Math.PI * 2);
      context.fillStyle = "#e9b94f";
      context.fill();
      context.strokeStyle = "white";
      context.lineWidth = 2;
      context.stroke();
      context.fillStyle = "#17483f";
      context.font = "8px sans-serif";
      context.fillText(String(index + 1), x + 7, y - 6);
    });
  }, [geojson]);
  return <div className="boundary-canvas-wrap"><canvas ref={canvasRef} aria-label="Approved project boundary visualization" /><span>Approved GeoJSON boundary</span></div>;
}

function NdviChart({ points }: { points: Analysis["ndvi"]["points"] }) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const context = canvas.getContext("2d");
    if (!context) return;
    const ratio = window.devicePixelRatio || 1;
    const width = canvas.clientWidth;
    const height = canvas.clientHeight;
    canvas.width = width * ratio;
    canvas.height = height * ratio;
    context.scale(ratio, ratio);
    context.clearRect(0, 0, width, height);
    const pad = { left: 38, right: 18, top: 22, bottom: 28 };
    context.font = "8px sans-serif";
    context.fillStyle = "#83938d";
    context.strokeStyle = "#e0e7e2";
    context.lineWidth = 1;
    [0, 0.25, 0.5, 0.75, 1].forEach((value) => {
      const y = pad.top + (1 - value) * (height - pad.top - pad.bottom);
      context.beginPath(); context.moveTo(pad.left, y); context.lineTo(width - pad.right, y); context.stroke();
      context.fillText(value.toFixed(2), 4, y + 3);
    });
    if (!points.length) {
      context.fillStyle = "#71847e";
      context.font = "11px sans-serif";
      context.fillText("Add satellite scenes to plot NDVI", pad.left + 20, height / 2);
      return;
    }
    const xFor = (index: number) =>
      pad.left + (index / Math.max(points.length - 1, 1)) * (width - pad.left - pad.right);
    const yFor = (value: number) =>
      pad.top + (1 - Math.max(0, Math.min(1, value))) * (height - pad.top - pad.bottom);
    const gradient = context.createLinearGradient(0, pad.top, 0, height - pad.bottom);
    gradient.addColorStop(0, "rgba(43,138,120,.28)");
    gradient.addColorStop(1, "rgba(43,138,120,0)");
    context.beginPath();
    points.forEach((point, index) => {
      const x = xFor(index);
      const y = yFor(point.value);
      if (index === 0) context.moveTo(x, y);
      else context.lineTo(x, y);
    });
    context.lineTo(xFor(points.length - 1), height - pad.bottom);
    context.lineTo(xFor(0), height - pad.bottom);
    context.closePath();
    context.fillStyle = gradient;
    context.fill();
    context.beginPath();
    points.forEach((point, index) => {
      const x = xFor(index);
      const y = yFor(point.value);
      if (index === 0) context.moveTo(x, y);
      else context.lineTo(x, y);
    });
    context.strokeStyle = "#167665";
    context.lineWidth = 2.5;
    context.stroke();
    points.forEach((point, index) => {
      const x = xFor(index);
      const y = yFor(point.value);
      context.beginPath(); context.arc(x, y, 4, 0, Math.PI * 2);
      context.fillStyle = point.mode === "simulated" ? "#e9b94f" : "#167665";
      context.fill();
      context.strokeStyle = "white"; context.lineWidth = 2; context.stroke();
      context.fillStyle = "#758881"; context.font = "7px sans-serif";
      context.fillText(new Date(point.date).getFullYear().toString(), x - 8, height - 9);
    });
  }, [points]);
  return <div className="ndvi-chart"><canvas ref={canvasRef} aria-label="NDVI vegetation trend chart" /><div><span><i className="submitted" />Submitted NDVI</span><span><i className="simulated" />Simulated prototype</span></div></div>;
}

function FlagList({ flags, emptyText }: { flags: Flag[]; emptyText: string }) {
  return (
    <div className="analysis-flags">
      {flags.length ? flags.map((flag, index) => (
        <div className={flag.severity} key={`${flag.code}-${index}`}>
          <i>{flag.severity === "high" ? "!" : "?"}</i>
          <span><strong>{flag.code.replaceAll("_", " ")}</strong><p>{flag.message}</p></span>
        </div>
      )) : <div className="clear"><i>✓</i><span><strong>Screening clear</strong><p>{emptyText}</p></span></div>}
    </div>
  );
}

function MethodNote({ children }: { children: React.ReactNode }) {
  return <details className="method-note"><summary>How this was calculated</summary><p>{children}</p></details>;
}

function CarbonModel({ analysis }: { analysis: Analysis }) {
  const [area, setArea] = useState(analysis.carbon.approvedAreaHectares);
  const [biomass, setBiomass] = useState(analysis.carbon.biomassFactor);
  const [conversion, setConversion] = useState(analysis.carbon.carbonConversionFactor);
  const [uncertainty, setUncertainty] = useState(analysis.carbon.uncertaintyPercent);

  useEffect(() => {
    setArea(analysis.carbon.approvedAreaHectares);
    setBiomass(analysis.carbon.biomassFactor);
    setConversion(analysis.carbon.carbonConversionFactor);
    setUncertainty(analysis.carbon.uncertaintyPercent);
  }, [analysis.project.id, analysis.carbon]);

  const carbon = Math.max(0, area) * Math.max(0, biomass) * Math.max(0, conversion);
  const co2e = carbon * (44 / 12);
  const low = co2e * (1 - Math.max(0, uncertainty) / 100);
  const high = co2e * (1 + Math.max(0, uncertainty) / 100);

  return (
    <article className="panel carbon-model-card">
      <PanelHeading eyebrow="Carbon-estimation engine" title="Editable input model" badge={analysis.carbon.ecosystemLabel} badgeTone="neutral" />
      <div className="carbon-formula">
        <div><span>Area</span><strong>{area.toFixed(2)} ha</strong></div><b>×</b>
        <div><span>Biomass factor</span><strong>{biomass.toFixed(2)}</strong></div><b>×</b>
        <div><span>Carbon conversion</span><strong>{conversion.toFixed(2)}</strong></div>
        <b>=</b><div className="result"><span>Annual carbon</span><strong>{carbon.toFixed(1)} tC</strong></div>
      </div>
      <div className="carbon-inputs">
        <label>Approved area (ha)<input type="number" min="0" step="0.01" value={area} onChange={(event) => setArea(Number(event.target.value))} /></label>
        <label>Biomass factor (t/ha/yr)<input type="number" min="0" step="0.01" value={biomass} onChange={(event) => setBiomass(Number(event.target.value))} /></label>
        <label>Carbon-conversion factor<input type="number" min="0" max="1" step="0.01" value={conversion} onChange={(event) => setConversion(Number(event.target.value))} /></label>
        <label>Uncertainty (±%)<input type="number" min="0" max="100" step="1" value={uncertainty} onChange={(event) => setUncertainty(Number(event.target.value))} /></label>
      </div>
      <div className="carbon-result">
        <div><span>Annual sequestration estimate</span><strong>{co2e.toFixed(1)} <small>tCO₂e / year</small></strong></div>
        <div><span>Uncertainty range</span><strong>{low.toFixed(1)} – {high.toFixed(1)} <small>tCO₂e</small></strong></div>
      </div>
      <details className="assumptions-list">
        <summary>View model assumptions <span>{analysis.carbon.assumptions.length}</span></summary>
        <ol>{analysis.carbon.assumptions.map((assumption) => <li key={assumption}>{assumption}</li>)}</ol>
      </details>
    </article>
  );
}

function ConfidenceModel({ confidence }: { confidence: Analysis["confidence"] }) {
  const components = confidence?.components ?? {};
  const weights = confidence?.weights ?? {};
  const score = confidence?.score ?? 0;
  return (
    <article className="panel confidence-card">
      <PanelHeading eyebrow="MRV confidence score" title="Evidence-weighted confidence" badge={`${score}/100`} badgeTone={score >= 75 ? "ok" : "warn"} />
      <div className="confidence-content">
        <div className="confidence-ring" style={{ "--score": `${score}%` } as React.CSSProperties}>
          <span><strong>{score}</strong><small>out of 100</small></span>
        </div>
        <div className="confidence-bars">
          {Object.entries(components).map(([key, value]) => (
            <div key={key}>
              <span><b>{confidenceLabels[key] ?? key}</b><small>{weights[key] ?? 0}% weight</small><strong>{value}</strong></span>
              <i><b style={{ width: `${value}%` }} /></i>
            </div>
          ))}
        </div>
      </div>
      <p className="confidence-note">Confidence is a transparent readiness indicator, not a crediting decision. Each component is independently reviewable.</p>
    </article>
  );
}

function QualityScore({ value }: { value: number }) {
  return <span className={`quality-score ${value >= 80 ? "good" : value >= 60 ? "medium" : "poor"}`}><i style={{ width: `${value}%` }} /><b>{value}</b></span>;
}

function TechnicalReport({ analysis, onClose }: { analysis: Analysis; onClose: () => void }) {
  const exportJson = () => {
    const blob = new Blob([JSON.stringify(analysis, null, 2)], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    const anchor = document.createElement("a");
    anchor.href = url;
    anchor.download = `${analysis.project.name.toLowerCase().replace(/[^a-z0-9]+/g, "-")}-mrv-report.json`;
    anchor.click();
    URL.revokeObjectURL(url);
  };
  return (
    <div className="report-backdrop" role="presentation" onMouseDown={(event) => {
      if (event.currentTarget === event.target) onClose();
    }}>
      <section className="technical-report" role="dialog" aria-modal="true" aria-labelledby="technical-report-title">
        <header>
          <div className="report-brand"><span>BC</span><div><strong>BlueRegistry</strong><small>Technical MRV report</small></div></div>
          <div className="report-actions"><button onClick={exportJson}>↓ Export data</button><button onClick={() => window.print()}>Print / PDF</button><button aria-label="Close report" onClick={onClose}>×</button></div>
        </header>
        <div className="report-body">
          <div className="report-title-block">
            <span>Generated {new Date(analysis.report.generatedAt).toLocaleString("en-IN")}</span>
            <h1 id="technical-report-title">{analysis.project.name}</h1>
            <p>{analysis.project.location} · {ecosystemLabel(analysis.project.ecosystem)} · {analysis.gis.approvedAreaHectares.toFixed(2)} hectares</p>
          </div>
          <div className="report-summary">
            <div><span>MRV confidence</span><strong>{analysis.confidence.score}/100</strong></div>
            <div><span>Annual estimate</span><strong>{analysis.carbon.annualCo2eTonnes.toFixed(1)} tCO₂e</strong></div>
            <div><span>NDVI trend</span><strong>{analysis.ndvi.trend.replaceAll("_", " ")}</strong></div>
            <div><span>Unresolved issues</span><strong>{analysis.report.unresolvedFlags.length}</strong></div>
          </div>
          <ReportSection title="1. Approved boundary">
            <BoundaryCanvas geojson={analysis.project.boundaryGeojson} />
            <dl><dt>Calculated area</dt><dd>{analysis.gis.approvedAreaHectares.toFixed(2)} ha</dd><dt>Submitted area</dt><dd>{analysis.gis.submittedAreaHectares.toFixed(2)} ha</dd><dt>Vertices</dt><dd>{analysis.gis.coordinateCount}</dd><dt>Method</dt><dd>{analysis.gis.method}</dd></dl>
          </ReportSection>
          <ReportSection title="2. Monitoring evidence">
            <p>{analysis.report.evidenceItemCount} evidence items and {analysis.report.evidenceFileCount} immutable files support this analysis. Average data-quality score: {analysis.quality.score}/100.</p>
            <ul>
              {analysis.quality.items.map((item) => (
                <li key={item.id}>
                  {sourceNames[item.sourceType] ?? item.sourceType} · {item.periodLabel} ·
                  {" "}{formatDate(item.observedAt)} · quality {item.score}/100 ·
                  {" "}{item.latestReview?.decision.replaceAll("_", " ") ?? "pending verifier review"}
                </li>
              ))}
            </ul>
          </ReportSection>
          <ReportSection title="3. Vegetation analysis">
            <NdviChart points={analysis.ndvi.points} />
            <dl><dt>Baseline NDVI</dt><dd>{analysis.ndvi.baseline?.toFixed(3) ?? "Unavailable"}</dd><dt>Current NDVI</dt><dd>{analysis.ndvi.current?.toFixed(3) ?? "Unavailable"}</dd><dt>Change</dt><dd>{analysis.ndvi.change?.toFixed(3) ?? "Unavailable"}</dd><dt>Method</dt><dd>{analysis.ndvi.method}</dd></dl>
          </ReportSection>
          <ReportSection title="4. Carbon estimate and uncertainty">
            <div className="report-equation">{analysis.carbon.approvedAreaHectares.toFixed(2)} ha × {analysis.carbon.biomassFactor} t/ha/yr × {analysis.carbon.carbonConversionFactor} × {analysis.carbon.co2ConversionFactor} = <strong>{analysis.carbon.annualCo2eTonnes.toFixed(2)} tCO₂e/yr</strong></div>
            <p>Uncertainty range: {analysis.carbon.lowerCo2eTonnes.toFixed(2)}–{analysis.carbon.upperCo2eTonnes.toFixed(2)} tCO₂e/year (±{analysis.carbon.uncertaintyPercent}%).</p>
            <ul>{analysis.carbon.assumptions.map((assumption) => <li key={assumption}>{assumption}</li>)}</ul>
          </ReportSection>
          <ReportSection title="5. Confidence components">
            <div className="report-confidence">{Object.entries(analysis.confidence.components ?? {}).map(([key, value]) => <div key={key}><span>{confidenceLabels[key] ?? key}</span><strong>{value}/100</strong><small>{analysis.confidence.weights?.[key] ?? 0}% weight</small></div>)}</div>
          </ReportSection>
          <ReportSection title="6. Flags and unresolved issues">
            {analysis.report.unresolvedFlags.length ? <ul className="report-flags">{analysis.report.unresolvedFlags.map((flag, index) => <li key={`${flag.code}-${index}`}><b>{flag.severity}</b><span>{flag.message}</span></li>)}</ul> : <p>No unresolved technical flags were detected by the prototype screening rules.</p>}
          </ReportSection>
          <footer>This AI-assisted report supports qualified technical review. It does not independently certify carbon credits, land title, or regulatory compliance.</footer>
        </div>
      </section>
    </div>
  );
}

function ReportSection({ title, children }: { title: string; children: React.ReactNode }) {
  return <section className="report-section"><h2>{title}</h2>{children}</section>;
}
