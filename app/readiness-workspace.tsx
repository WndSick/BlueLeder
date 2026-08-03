"use client";

const limitations = [
  ["Authorization, not title verification", "The platform records leases, permissions and consent evidence. A qualified administrator reviews them; the system does not determine legal ownership."],
  ["Prototype carbon factors", "Default ecosystem factors make the SIH workflow testable. Production estimates require regional calibration, accepted methodology and independent validation."],
  ["AI supports human review", "Blur, duplicate, location and NDVI checks produce flags and quality scores. They never approve a project or issue credits autonomously."],
  ["Testnet, not market infrastructure", "Polygon Amoy demonstrates anchoring and lifecycle controls. Security audit, key governance and registry integration are required before public issuance."],
];

export default function ReadinessWorkspace() {
  return <div className="readiness-workspace">
    <section className="readiness-hero">
      <div><span className="overline">SIH judge mode</span><h1>One restoration journey, fully traceable.</h1><p>Use these diagrams while presenting, then switch roles from the Overview dashboard to test the corresponding workflow.</p></div>
      <div className="judge-route"><span>Suggested live demo</span><b>NGO → Admin → Verifier → Buyer → Community</b><small>8-minute end-to-end walkthrough</small></div>
    </section>

    <section className="diagram-card architecture-diagram">
      <header><span>01 · SYSTEM ARCHITECTURE</span><h2>Evidence stays usable; proofs become tamper-evident.</h2></header>
      <div className="architecture-layers">
        <div className="actor-layer">
          {["NGO", "Community", "Admin", "Verifier", "Buyer"].map((item) => <span key={item}>{item}</span>)}
        </div>
        <i>↓ Secure role-based actions</i>
        <div className="app-layer">
          <div><b>Project registry</b><small>Profiles · boundaries · approvals</small></div>
          <div><b>Evidence & MRV</b><small>Field · IoT · satellite · analytics</small></div>
          <div><b>BlueLedger</b><small>Credits · transfers · retirement</small></div>
          <div><b>Dashboards</b><small>Role views · reports · public proof</small></div>
        </div>
        <i>↓ Structured records and cryptographic references</i>
        <div className="data-layer">
          <div><b>D1 database</b><small>Projects, reviews, metrics, ledger events</small></div>
          <div><b>R2 object storage</b><small>Documents, photos, surveys and reports</small></div>
          <div><b>Polygon Amoy</b><small>Hashes, IDs, timestamps and transaction proofs</small></div>
        </div>
      </div>
    </section>

    <div className="diagram-grid">
      <section className="diagram-card user-flow">
        <header><span>02 · USER FLOW</span><h2>Five roles, one chain of accountability.</h2></header>
        <ol>
          <li><b>1</b><div><strong>NGO registers</strong><span>Authorization, plan and GeoJSON boundary</span></div></li>
          <li><b>2</b><div><strong>Admin approves</strong><span>Documents and overlap risks reviewed</span></div></li>
          <li><b>3</b><div><strong>Community monitors</strong><span>GPS field work and benefit records</span></div></li>
          <li><b>4</b><div><strong>Verifier decides</strong><span>Evidence, NDVI and carbon assumptions</span></div></li>
          <li><b>5</b><div><strong>Buyer verifies</strong><span>Issuance, transaction and retirement proof</span></div></li>
        </ol>
      </section>
      <section className="diagram-card contract-flow">
        <header><span>03 · SMART-CONTRACT FLOW</span><h2>Rules enforced across the credit lifecycle.</h2></header>
        <div className="contract-nodes">
          <div><code>registerProject()</code><span>Approval + boundary hash</span></div><i>↓</i>
          <div><code>anchorMRVReport()</code><span>Evidence + report + decision</span></div><i>↓</i>
          <div><code>issueCredits()</code><span>One batch per period</span></div><i>↓</i>
          <div className="contract-branch"><span><code>transferCredits()</code><small>Active holder only</small></span><b>or</b><span className="retire"><code>retireCredits()</code><small>Terminal state</small></span></div>
        </div>
      </section>
    </div>

    <section className="journey-card">
      <header><span>04 · SAMPLE PROJECT JOURNEY</span><h2>Sundarban Mangrove Recovery Corridor</h2><p>The seeded demo account includes every record below.</p></header>
      <div className="journey-track">
        {[
          ["18 May 2025", "Registered", "154.8 ha boundary and authorization evidence"],
          ["02 Jun 2025", "Approved", "Admin review recorded without ownership claim"],
          ["18 Jun 2026", "Monitored", "12,400 saplings; 86% observed survival"],
          ["25 Jun 2026", "Verified", "Field, sensor and satellite evidence approved"],
          ["01 Jul 2026", "Issued", "1,280 tCO₂e anchored to Polygon Amoy"],
          ["02 Mar 2026", "Retired", "940-credit vintage permanently retired"],
        ].map(([date, title, detail], index) => <article key={title}><b>{String(index + 1).padStart(2, "0")}</b><small>{date}</small><h3>{title}</h3><p>{detail}</p></article>)}
      </div>
    </section>

    <section className="responsible-ai">
      <div><span>05 · KNOWN LIMITATIONS</span><h2>Designed to be honest about what it knows.</h2><p>Trust comes from inspectable evidence, explicit uncertainty and human accountability—not from calling every check “AI verified.”</p></div>
      <div className="limitation-list">{limitations.map(([title, body], index) => <article key={title}><span>{index + 1}</span><div><b>{title}</b><p>{body}</p></div></article>)}</div>
      <footer><b>Responsible-AI statement</b><p>BlueRegistry uses automated checks to prioritize human attention. Every flag exposes its supporting data, confidence and assumptions. Qualified reviewers retain approval authority, users can inspect source evidence, and unresolved issues remain visible in reports.</p></footer>
    </section>
  </div>;
}
