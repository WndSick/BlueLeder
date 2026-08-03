"use client";

import { FormEvent, useCallback, useEffect, useMemo, useState } from "react";

type Role = "ngo" | "community" | "admin" | "verifier" | "buyer";
type Project = { id: string; name: string; ecosystem: string; village: string; state: string };
type Batch = {
  id: string;
  period_key: string;
  vintage_year: number;
  report_hash?: string;
  issued_quantity: number;
  current_holder: string;
  status: "draft" | "pending_verification" | "issued" | "transferred" | "retired" | "cancelled";
};
type LedgerEvent = {
  id: string;
  batch_id?: string;
  event_type: string;
  event_hash: string;
  previous_event_hash?: string;
  payload_hash: string;
  transaction_id?: string;
  actor_email: string;
  created_at: string;
  metadata: Record<string, unknown>;
};
type LedgerData = {
  projects: Project[];
  selectedProjectId: string | null;
  chain: {
    network: string;
    chainId: number;
    explorerUrl: string;
    contractAddress: string | null;
    contractFunctions?: string[];
  };
  ledger: null | {
    project: {
      id: string;
      name: string;
      ecosystem: string;
      location: string;
      approvedAreaHectares: number;
    };
    hashes: Record<string, string>;
    antiFraud: {
      projectApproved: boolean;
      overlapClear: boolean;
      overlaps: Array<{ projectId: string; projectName: string }>;
      evidenceAvailable: boolean;
      evidenceCount: number;
      verifierApprovalComplete: boolean;
      annualIssuanceLimit: number;
    };
    events: LedgerEvent[];
    batches: Batch[];
    totals: { issued: number; retired: number };
  };
};

const statusLabels: Record<Batch["status"], string> = {
  draft: "Draft",
  pending_verification: "Pending verification",
  issued: "Issued",
  transferred: "Transferred",
  retired: "Retired",
  cancelled: "Cancelled",
};

const eventLabels: Record<string, string> = {
  project_approval_hash: "Project approval anchored",
  evidence_bundle_hash: "Evidence bundle anchored",
  mrv_report_hash: "MRV report anchored",
  verification_decision_hash: "Verification decision anchored",
  credit_draft_created: "Credit draft created",
  credit_pending_verification: "Sent for verification",
  credit_issuance: "Credits issued",
  credit_transfer: "Credits transferred",
  credit_retirement: "Credits retired",
  credit_cancellation: "Credits cancelled",
  testnet_transaction: "Testnet transaction linked",
};

function compactHash(value?: string) {
  return value ? `${value.slice(0, 10)}…${value.slice(-8)}` : "Not recorded";
}

function dateTime(value: string) {
  return new Intl.DateTimeFormat("en-IN", {
    day: "2-digit",
    month: "short",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  }).format(new Date(value));
}

export default function LedgerWorkspace({ role }: { role: Role }) {
  const [data, setData] = useState<LedgerData | null>(null);
  const [projectId, setProjectId] = useState("");
  const [busy, setBusy] = useState("");
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");
  const canVerify = role === "admin" || role === "verifier";
  const canCreate = role !== "buyer";

  const load = useCallback(async (requestedId?: string) => {
    const query = requestedId ? `?projectId=${encodeURIComponent(requestedId)}` : "";
    const response = await fetch(`/api/ledger${query}`, { cache: "no-store" });
    const payload = await response.json();
    if (!response.ok) throw new Error(payload.error ?? "Could not load BlueLedger.");
    setData(payload);
    setProjectId(payload.selectedProjectId ?? "");
  }, []);

  useEffect(() => {
    load().catch((reason) => setError(reason.message));
  }, [load]);

  async function act(action: string, fields: Record<string, string> = {}) {
    if (!projectId) return;
    setBusy(action + (fields.batchId ?? fields.eventHash ?? ""));
    setError("");
    setMessage("");
    const form = new FormData();
    form.set("action", action);
    form.set("projectId", projectId);
    Object.entries(fields).forEach(([key, value]) => form.set(key, value));
    const response = await fetch("/api/ledger", { method: "POST", body: form });
    const payload = await response.json();
    if (!response.ok) {
      setError(payload.error ?? "The ledger action could not be completed.");
      setBusy("");
      return;
    }
    setMessage(
      action === "prepare_chain"
        ? "Verification hash chain prepared and recorded."
        : "Lifecycle event recorded in the append-only registry.",
    );
    await load(projectId);
    setBusy("");
  }

  const issuedBatches = useMemo(
    () => data?.ledger?.batches.filter((batch) =>
      ["issued", "transferred", "retired"].includes(batch.status)) ?? [],
    [data],
  );

  if (!data) {
    return <div className="ledger-loading">Loading tamper-evident registry…</div>;
  }

  if (!data.ledger) {
    return (
      <section className="ledger-empty">
        <span>◆</span>
        <h1>BlueLedger</h1>
        <p>No approved MRV projects are available to this account yet.</p>
      </section>
    );
  }

  const { ledger, chain } = data;
  const gates = [
    ["Approved for MRV", ledger.antiFraud.projectApproved],
    ["Boundary overlap clear", ledger.antiFraud.overlapClear],
    [`Evidence available (${ledger.antiFraud.evidenceCount})`, ledger.antiFraud.evidenceAvailable],
    ["Verifier approvals complete", ledger.antiFraud.verifierApprovalComplete],
  ] as const;

  return (
    <div className="blue-ledger">
      <section className="ledger-hero">
        <div>
          <span className="overline">Phase 4 · Credit integrity</span>
          <h1>BlueLedger registry</h1>
          <p>A traceable chain from approved project evidence to credit retirement.</p>
        </div>
        <label>
          Approved project
          <select
            value={projectId}
            onChange={(event) => load(event.target.value).catch((reason) => setError(reason.message))}
          >
            {data.projects.map((project) => (
              <option key={project.id} value={project.id}>{project.name}</option>
            ))}
          </select>
        </label>
        <div className={`chain-state ${chain.contractAddress ? "live" : ""}`}>
          <i />
          <span><b>Polygon Amoy · {chain.chainId}</b>{chain.contractAddress ? "Contract configured" : "Testnet-ready · deployment required"}</span>
        </div>
      </section>

      {(message || error) && (
        <div className={`ledger-alert ${error ? "error" : ""}`}>
          <span>{error ? "!" : "✓"}</span>{error || message}
          <button onClick={() => { setError(""); setMessage(""); }}>×</button>
        </div>
      )}

      <section className="ledger-project-strip">
        <div className="project-glyph">◆</div>
        <div><small>PROJECT ID</small><strong>{ledger.project.id}</strong><span>{ledger.project.name} · {ledger.project.location}</span></div>
        <dl>
          <div><dt>Approved area</dt><dd>{ledger.project.approvedAreaHectares.toLocaleString()} ha</dd></div>
          <div><dt>Issuance ceiling</dt><dd>{ledger.antiFraud.annualIssuanceLimit.toLocaleString()} tCO₂e / yr</dd></div>
          <div><dt>Credits issued</dt><dd>{ledger.totals.issued.toLocaleString()}</dd></div>
          <div><dt>Credits retired</dt><dd>{ledger.totals.retired.toLocaleString()}</dd></div>
        </dl>
      </section>

      <section className="hash-pipeline">
        {[
          ["Project approval", ledger.hashes.projectApprovalHash, "registerProject"],
          ["Evidence bundle", ledger.hashes.evidenceBundleHash, "anchorMRVReport"],
          ["MRV report", ledger.hashes.mrvReportHash, "anchorMRVReport"],
          ["Verification", ledger.hashes.verificationDecisionHash, "issueCredits"],
        ].map(([label, hash, fn], index) => (
          <div key={label}>
            <b>{String(index + 1).padStart(2, "0")}</b>
            <span><small>{label}</small><code title={hash}>{compactHash(hash)}</code><em>{fn}</em></span>
          </div>
        ))}
      </section>

      <div className="ledger-grid">
        <section className="ledger-panel">
          <header><div><span className="eyebrow">ISSUANCE CONTROL</span><h2>Anti-fraud gates</h2></div>{canVerify && <button className="small-primary" disabled={busy === "prepare_chain"} onClick={() => act("prepare_chain")}>{busy === "prepare_chain" ? "Preparing…" : "Prepare hash chain"}</button>}</header>
          <div className="gate-list">
            {gates.map(([label, passed]) => <div key={label} className={passed ? "pass" : "fail"}><span>{passed ? "✓" : "!"}</span><b>{label}</b><small>{passed ? "Passed" : "Issuance blocked"}</small></div>)}
          </div>
          {!ledger.antiFraud.overlapClear && (
            <p className="overlap-warning">Overlaps: {ledger.antiFraud.overlaps.map((item) => item.projectName).join(", ")}</p>
          )}
          <p className="ledger-rule">Credits cannot be issued until verification is complete; duplicate monitoring periods are rejected; retired batches cannot move again.</p>
        </section>

        <section className="ledger-panel chain-panel">
          <header><div><span className="eyebrow">ON-CHAIN TARGET</span><h2>Smart-contract lifecycle</h2></div><span className="network-chip">Amoy</span></header>
          <ol>
            {(chain.contractFunctions ?? []).map((fn, index) => <li key={fn}><span>{index + 1}</span><code>{fn}()</code></li>)}
          </ol>
          <div className="storage-split">
            <div><b>Off-chain</b><span>Documents, photos, sensor data and reports</span></div>
            <div><b>On-chain</b><span>Hashes, IDs, timestamps and transaction IDs</span></div>
          </div>
          <p className="contract-address"><b>Contract</b><code>{chain.contractAddress ?? "Not configured — set BLUELEDGER_CONTRACT_ADDRESS after deployment"}</code></p>
        </section>
      </div>

      <section className="ledger-panel credit-lifecycle">
        <header><div><span className="eyebrow">CREDIT LIFECYCLE</span><h2>Monitoring-period batches</h2></div></header>
        {canCreate && <DraftForm ceiling={ledger.antiFraud.annualIssuanceLimit} busy={busy === "create_draft"} onSubmit={(fields) => act("create_draft", fields)} />}
        <div className="batch-list">
          {ledger.batches.length === 0 && <div className="ledger-zero">No batches yet. Create one for a unique monitoring period.</div>}
          {ledger.batches.map((batch) => (
            <BatchCard key={batch.id} batch={batch} role={role} busy={busy} onAct={act} />
          ))}
        </div>
      </section>

      <section className="ledger-panel registry-explorer">
        <header><div><span className="eyebrow">PUBLIC-READY VIEW</span><h2>Registry explorer</h2></div><span>{issuedBatches.length} traceable batch{issuedBatches.length === 1 ? "" : "es"}</span></header>
        <div className="registry-table-wrap">
          <table>
            <thead><tr><th>Project ID</th><th>Report hash</th><th>Transaction ID</th><th>Quantity</th><th>Status / retirement</th></tr></thead>
            <tbody>
              {issuedBatches.length === 0 && <tr><td colSpan={5}>No issued credits to display.</td></tr>}
              {issuedBatches.map((batch) => {
                const events = ledger.events.filter((item) => item.batch_id === batch.id);
                const transaction = events.find((item) => item.transaction_id)?.transaction_id;
                const retired = events.find((item) => item.event_type === "credit_retirement");
                return <tr key={batch.id}><td><code>{compactHash(ledger.project.id)}</code><small>{batch.period_key} · {batch.vintage_year}</small></td><td><code title={batch.report_hash}>{compactHash(batch.report_hash)}</code></td><td>{transaction ? <a href={`${chain.explorerUrl}/tx/${transaction}`} target="_blank" rel="noreferrer"><code>{compactHash(transaction)}</code> ↗</a> : <span>Awaiting testnet anchor</span>}</td><td><b>{Number(batch.issued_quantity).toLocaleString()}</b> tCO₂e</td><td><span className={`credit-status ${batch.status}`}>{statusLabels[batch.status]}</span>{retired && <small>{dateTime(retired.created_at)}</small>}</td></tr>;
              })}
            </tbody>
          </table>
        </div>
      </section>

      <section className="ledger-panel event-explorer">
        <header><div><span className="eyebrow">APPEND-ONLY AUDIT TRAIL</span><h2>Evidence-to-retirement event chain</h2></div><span>{ledger.events.length} immutable-style records</span></header>
        <div className="event-chain">
          {ledger.events.length === 0 && <div className="ledger-zero">Prepare the hash chain to create the first registry events.</div>}
          {ledger.events.map((event) => (
            <article key={event.id}>
              <i />
              <div className="event-title"><b>{eventLabels[event.event_type] ?? event.event_type}</b><span>{dateTime(event.created_at)} · {event.actor_email}</span></div>
              <dl>
                <div><dt>Event hash</dt><dd><code title={event.event_hash}>{compactHash(event.event_hash)}</code></dd></div>
                <div><dt>Previous</dt><dd><code title={event.previous_event_hash}>{compactHash(event.previous_event_hash)}</code></dd></div>
                <div><dt>Payload</dt><dd><code title={event.payload_hash}>{compactHash(event.payload_hash)}</code></dd></div>
              </dl>
              {event.transaction_id
                ? <a href={`${chain.explorerUrl}/tx/${event.transaction_id}`} target="_blank" rel="noreferrer">View testnet transaction ↗</a>
                : canVerify && <EventAnchorForm disabled={busy === `record_transaction${event.event_hash}`} onSubmit={(transactionId) => act("record_transaction", { eventHash: event.event_hash, transactionId })} />}
            </article>
          ))}
        </div>
      </section>

      <p className="ledger-disclaimer">BlueLedger stores cryptographic hashes as tamper-evident references. A record is on-chain only when a valid testnet transaction ID is attached; this interface does not imply mainnet issuance or legal title.</p>
    </div>
  );
}

function DraftForm({ ceiling, busy, onSubmit }: { ceiling: number; busy: boolean; onSubmit: (fields: Record<string, string>) => void }) {
  function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = new FormData(event.currentTarget);
    onSubmit(Object.fromEntries([...form.entries()].map(([key, value]) => [key, String(value)])));
    event.currentTarget.reset();
  }
  return <form className="draft-form" onSubmit={submit}>
    <label>Monitoring period<input name="periodKey" placeholder="2026-Q1" minLength={3} maxLength={40} required /></label>
    <label>Vintage year<input name="vintageYear" type="number" min="2000" max="2100" defaultValue={new Date().getFullYear()} required /></label>
    <label>Quantity (tCO₂e)<input name="quantity" type="number" min="0.01" max={ceiling} step="0.01" placeholder={`≤ ${ceiling}`} required /></label>
    <button className="small-primary" disabled={busy}>{busy ? "Creating…" : "Create draft"}</button>
  </form>;
}

function BatchCard({ batch, role, busy, onAct }: { batch: Batch; role: Role; busy: string; onAct: (action: string, fields: Record<string, string>) => void }) {
  const [recipient, setRecipient] = useState("");
  const [transactionId, setTransactionId] = useState("");
  const [reason, setReason] = useState("");
  const verifier = role === "admin" || role === "verifier";
  const working = busy.endsWith(batch.id);
  const base = { batchId: batch.id, transactionId };
  return <article className="batch-card">
    <div className="batch-main"><span className={`credit-status ${batch.status}`}>{statusLabels[batch.status]}</span><h3>{batch.period_key}</h3><p>Vintage {batch.vintage_year} · {Number(batch.issued_quantity).toLocaleString()} tCO₂e</p><small>Holder: {batch.current_holder}</small></div>
    <div className="batch-inputs">
      {["issued", "transferred"].includes(batch.status) && <input value={recipient} onChange={(event) => setRecipient(event.target.value)} placeholder="Recipient wallet or account" />}
      {["issued", "transferred"].includes(batch.status) || (verifier && ["draft", "pending_verification", "issued"].includes(batch.status)) ? <input value={reason} onChange={(event) => setReason(event.target.value)} placeholder="Retirement / cancellation reason" /> : null}
      {["pending_verification", "issued", "transferred", "draft"].includes(batch.status) && <input value={transactionId} onChange={(event) => setTransactionId(event.target.value)} placeholder="Optional 0x testnet transaction hash" />}
    </div>
    <div className="batch-actions">
      {batch.status === "draft" && <button disabled={working || role === "buyer"} onClick={() => onAct("submit_for_verification", base)}>Submit</button>}
      {batch.status === "pending_verification" && verifier && <button className="issue" disabled={working} onClick={() => onAct("issue_credits", base)}>Issue credits</button>}
      {["issued", "transferred"].includes(batch.status) && <button disabled={working || !recipient} onClick={() => onAct("transfer_credits", { ...base, recipient })}>Transfer</button>}
      {["issued", "transferred"].includes(batch.status) && <button disabled={working || reason.trim().length < 5} onClick={() => onAct("retire_credits", { ...base, reason })}>Retire</button>}
      {verifier && ["draft", "pending_verification", "issued"].includes(batch.status) && <button className="cancel" disabled={working || reason.trim().length < 5} onClick={() => onAct("cancel_credits", { ...base, reason })}>Cancel</button>}
    </div>
  </article>;
}

function EventAnchorForm({ disabled, onSubmit }: { disabled: boolean; onSubmit: (transactionId: string) => void }) {
  const [transactionId, setTransactionId] = useState("");
  return <div className="event-anchor-form">
    <input value={transactionId} onChange={(event) => setTransactionId(event.target.value)} placeholder="0x transaction hash" aria-label="Polygon Amoy transaction hash" />
    <button disabled={disabled || !/^0x[a-fA-F0-9]{64}$/.test(transactionId)} onClick={() => onSubmit(transactionId)}>Link tx</button>
  </div>;
}
