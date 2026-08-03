"use client";

import { useEffect, useMemo, useState } from "react";

type PublicProject = {
  id: string;
  name: string;
  ecosystem: string;
  location: string;
  areaHectares: number;
  annualEstimate: number;
  batches: Array<{
    id: string;
    periodKey: string;
    vintageYear: number;
    reportHash: string;
    quantity: number;
    holder: string;
    status: string;
    transactionId?: string;
    eventHash?: string;
    retiredAt?: string;
  }>;
};

function short(value?: string) {
  return value ? `${value.slice(0, 12)}…${value.slice(-9)}` : "Not anchored";
}

export default function PublicRegistry() {
  const [projects, setProjects] = useState<PublicProject[]>([]);
  const [query, setQuery] = useState("");
  const [status, setStatus] = useState("all");
  const [selected, setSelected] = useState<string | null>(null);

  useEffect(() => {
    fetch("/api/dashboard", { cache: "no-store" })
      .then((response) => response.json())
      .then((payload) => setProjects(payload.publicProjects ?? []));
  }, []);

  const results = useMemo(() => projects.filter((project) => {
    const matchesText = `${project.name} ${project.location} ${project.ecosystem}`
      .toLowerCase()
      .includes(query.toLowerCase());
    const matchesStatus =
      status === "all" || project.batches.some((batch) => batch.status === status);
    return matchesText && matchesStatus;
  }), [projects, query, status]);

  const selectedBatch = projects
    .flatMap((project) => project.batches.map((batch) => ({ project, batch })))
    .find(({ batch }) => batch.id === selected);

  return <div className="public-registry">
    <section className="public-hero">
      <span className="overline">Buyer / public registry</span>
      <h1>Verify every credit before you trust it.</h1>
      <p>Search approved projects, inspect report hashes, follow Polygon Amoy transactions and confirm retirement status.</p>
      <div className="registry-search">
        <label><span>⌕</span><input value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Search project, ecosystem or location…" /></label>
        <select value={status} onChange={(event) => setStatus(event.target.value)}>
          <option value="all">All credit states</option>
          <option value="issued">Issued</option>
          <option value="transferred">Transferred</option>
          <option value="retired">Retired</option>
        </select>
      </div>
    </section>

    <div className="public-trust-strip">
      <div><span>✓</span><p><b>Approved projects only</b>Qualified admin review recorded</p></div>
      <div><span>#</span><p><b>Hash-linked evidence</b>Reports connect to source records</p></div>
      <div><span>◆</span><p><b>Retirement protected</b>Retired batches cannot transfer</p></div>
    </div>

    <section className="public-results">
      <header><h2>Verified blue-carbon projects</h2><span>{results.length} result{results.length === 1 ? "" : "s"}</span></header>
      {results.map((project) => <article className="public-project" key={project.id}>
        <div className="public-project-main">
          <span className={`ecosystem-orb ${project.ecosystem}`}>♧</span>
          <div><small>{project.ecosystem.replace("_", " ")} · {project.location}</small><h3>{project.name}</h3><code>{project.id}</code></div>
          <dl>
            <div><dt>Approved area</dt><dd>{project.areaHectares} ha</dd></div>
            <div><dt>Annual estimate</dt><dd>{project.annualEstimate.toLocaleString()} tCO₂e</dd></div>
          </dl>
        </div>
        <div className="public-batches">
          {project.batches.map((batch) => <button key={batch.id} onClick={() => setSelected(batch.id)}>
            <span className={`credit-status ${batch.status}`}>{batch.status}</span>
            <b>{batch.periodKey}</b>
            <small>Vintage {batch.vintageYear}</small>
            <strong>{batch.quantity.toLocaleString()} <em>tCO₂e</em></strong>
            <code>{short(batch.reportHash)}</code>
            <i>Inspect proof →</i>
          </button>)}
        </div>
      </article>)}
    </section>

    {selectedBatch && <div className="proof-backdrop" onMouseDown={() => setSelected(null)}>
      <section className="proof-sheet" onMouseDown={(event) => event.stopPropagation()}>
        <header><div><span>RETIREMENT & PROOF VERIFIER</span><h2>{selectedBatch.project.name}</h2></div><button onClick={() => setSelected(null)}>×</button></header>
        <div className={`proof-status ${selectedBatch.batch.status}`}>
          <span>{selectedBatch.batch.status === "retired" ? "✓" : "◆"}</span>
          <div><b>{selectedBatch.batch.status === "retired" ? "Retirement confirmed in registry" : `${selectedBatch.batch.status} credit batch`}</b><p>{selectedBatch.batch.status === "retired" ? "This complete batch is locked from further transfer." : "This batch has not been marked as retired."}</p></div>
        </div>
        <dl className="proof-details">
          <div><dt>Batch ID</dt><dd><code>{selectedBatch.batch.id}</code></dd></div>
          <div><dt>Monitoring period</dt><dd>{selectedBatch.batch.periodKey} · vintage {selectedBatch.batch.vintageYear}</dd></div>
          <div><dt>Quantity</dt><dd>{selectedBatch.batch.quantity.toLocaleString()} tCO₂e</dd></div>
          <div><dt>Holder / retiring entity</dt><dd>{selectedBatch.batch.holder}</dd></div>
          <div><dt>MRV report hash</dt><dd><code>{selectedBatch.batch.reportHash}</code></dd></div>
          <div><dt>Registry event hash</dt><dd><code>{selectedBatch.batch.eventHash ?? "Not recorded"}</code></dd></div>
          <div><dt>Polygon Amoy transaction</dt><dd>{selectedBatch.batch.transactionId ? <a href={`https://amoy.polygonscan.com/tx/${selectedBatch.batch.transactionId}`} target="_blank" rel="noreferrer"><code>{selectedBatch.batch.transactionId}</code> ↗</a> : "Not anchored"}</dd></div>
          <div><dt>Retirement time</dt><dd>{selectedBatch.batch.retiredAt ? new Date(selectedBatch.batch.retiredAt).toLocaleString("en-IN") : "Not retired"}</dd></div>
        </dl>
        <footer>
          <p>Verify the transaction independently. Testnet records demonstrate traceability but are not accredited market instruments.</p>
          <a href={`/api/reports?type=certificate&projectId=${selectedBatch.project.id}&batchId=${selectedBatch.batch.id}`}>Download certificate ↓</a>
        </footer>
      </section>
    </div>}
  </div>;
}
