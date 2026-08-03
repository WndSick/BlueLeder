# BlueRegistry — SIH Demo Guide

## 1. Demo objective

The recommended demonstration tells one coherent story:

> A community-led mangrove project is registered, reviewed, monitored, technically verified, converted into a traceable credit batch, inspected by a buyer and understood by the participating community.

The demo is designed for approximately eight minutes. A shorter three-minute route is included at the end.

## 2. Demo account

When the application runs locally without an authenticated OpenAI workspace header, it uses:

- **Email:** `demo@blueregistry.local`
- **Display name:** `Asha — SIH Demo`
- **Default role:** NGO / project developer
- **Organization:** Sundarban Community Restoration Collective

No password is required in local demonstration mode. This is an isolated prototype identity, not a production authentication bypass.

The Overview dashboard contains an **SIH guided demo** switcher:

- NGO
- Community
- Admin
- Verifier
- Buyer

Changing the selected role updates the stored demo profile, so the API permission checks and visible navigation behave as that role. It is not only a cosmetic theme switch.

## 3. Seeded project records

### Approved showcase project

**Sundarban Mangrove Recovery Corridor**

- Project ID: `demo-sundarbans-001`
- Ecosystem: mangrove
- Village: Gosaba
- District: South 24 Parganas
- State: West Bengal
- Approved area: 154.8 hectares
- Restoration duration: 20 years
- Responsible organization: Sundarban Community Restoration Collective
- Community partner: Gosaba Gram Sabha
- Status: approved for MRV

Evidence:

- field survey with GPS location;
- 12,400 recorded saplings;
- Avicennia marina species record;
- 86% observed survival;
- salinity, water level, soil moisture and temperature sensor data;
- Sentinel-2 scene with 7.8% cloud cover;
- baseline NDVI 0.31;
- current NDVI 0.58; and
- three positive verifier decisions.

Credits:

- 1,280 tCO₂e issued for `2026-Q2`;
- 940 tCO₂e retired for `2025-ANNUAL`;
- report hashes;
- event hashes; and
- Polygon Amoy-format transaction identifiers.

Community benefits:

- INR 1,850,000 restoration grant to Gosaba Gram Sabha; and
- INR 620,000 in verified payments to 48 community restoration workers.

### Risk-review project

**Matla Creek Mangrove Proposal**

- Project ID: `demo-overlap-alert-002`
- Status: document review
- Area: 112.4 hectares
- Risk: proposed boundary intersects the approved Sundarban corridor
- Evidence: one baseline field record awaiting review
- Organization: Rahim Coastal Trust, currently unverified

This project gives the administrator meaningful queues and demonstrates that the system flags a possible overlap without automatically rejecting a legal or technical claim.

## 4. Recommended eight-minute presentation

### Step 1 — Start in SIH Judge Mode (45 seconds)

Open **SIH judge mode** from the sidebar.

Show:

1. the actor-to-application-to-storage architecture;
2. the five-role user flow;
3. the smart-contract lifecycle;
4. the seeded project journey; and
5. the limitations and responsible-AI statement.

Suggested narration:

> “BlueRegistry keeps large evidence usable off-chain while anchoring compact proofs on-chain. Every automated check supports a visible human decision. The platform never claims to automatically verify land ownership or accredited carbon.”

### Step 2 — NGO dashboard (60 seconds)

Return to **Overview** and select **NGO** in the demo switcher.

Point out:

- approved project status;
- 154.8-hectare boundary;
- next quarterly monitoring deadline;
- evidence completeness;
- annual estimated sequestration;
- verifier feedback; and
- report downloads.

Open **Evidence ledger** briefly to show the chronological records. Explain that evidence items are appended rather than overwritten.

Suggested narration:

> “The project developer sees what is missing and when monitoring is due. The latest verifier comment remains connected to the submitted evidence, so the NGO can respond without destroying the old record.”

### Step 3 — Admin dashboard (75 seconds)

Switch to **Admin**.

Show:

- one organization awaiting verification;
- one project in document review;
- one duplicate-boundary alert;
- one unreviewed evidence item; and
- high- and medium-severity system risks.

Open **Review queue** and highlight that available decisions are document review, approve for MRV, request changes or reject.

Important line:

> “Approval records that authorization evidence was reviewed. It does not establish or automatically verify land ownership.”

Do not approve the seeded overlapping project during the standard demo; retaining the alert makes later demonstrations repeatable.

### Step 4 — Verifier dashboard and MRV (90 seconds)

Switch to **Verifier**.

Show:

- chronological evidence;
- approved review outcomes;
- baseline/current satellite comparison;
- NDVI improvement from 0.31 to 0.58;
- mangrove biomass and carbon assumptions;
- uncertainty warning; and
- blockchain anchoring status.

Open **MRV analytics**.

Point out:

- approved-area calculation;
- overlap result;
- location consistency;
- evidence quality score;
- carbon equation;
- uncertainty range;
- confidence components; and
- generated technical MRV report.

Then open **BlueLedger** and show:

- project approval hash;
- evidence-bundle hash;
- MRV-report hash;
- verification-decision hash;
- anti-fraud gates;
- credit lifecycle;
- event hash chaining; and
- transaction links.

Suggested narration:

> “A verifier can reproduce why the estimate exists. Issuance is blocked if evidence is unapproved, the project overlaps another approved project, the monitoring period is duplicated or the quantity exceeds the prototype estimate.”

### Step 5 — Buyer / public verification (75 seconds)

Switch to **Buyer**, then select **Open public registry**.

Search for `Sundarban` or filter to `Retired`.

Open the retired `2025-ANNUAL` batch.

Show:

- retirement-confirmed state;
- project and batch ID;
- vintage and quantity;
- holder or retiring entity;
- MRV report hash;
- registry event hash;
- Polygon Amoy transaction link;
- retirement timestamp; and
- certificate download.

Then open the issued `2026-Q2` batch and note that the interface does **not** call it retired.

Suggested narration:

> “The certificate is status-aware. An issued batch cannot be presented as a retirement certificate, and a retired batch is a terminal lifecycle state.”

### Step 6 — Community dashboard (60 seconds)

Switch to **Community**.

Show the mobile-friendly cards:

- 12,400 saplings;
- 86% observed survival;
- 2,220 approved credits across the displayed vintages; and
- two funding/benefit records.

Highlight the beneficiary, description, amount and proof hash for each funding entry.

Suggested narration:

> “The community should not need to understand smart-contract internals to see whether restoration activity, approved credits and recorded funding agree.”

### Step 7 — Downloads and close (45 seconds)

From the Overview reporting centre, download:

1. Technical MRV report PDF;
2. credit or retirement certificate PDF; and
3. project audit trail CSV.

Close with:

> “BlueRegistry connects community work to buyer-visible proof without pretending that AI, satellite imagery or blockchain can replace legal authorization, carbon methodology or qualified human review.”

## 5. Three-minute rapid demo

If presentation time is restricted:

1. Open **SIH judge mode** and show the architecture for 20 seconds.
2. Switch to **Admin** and point out the overlap alert.
3. Switch to **Verifier**, open MRV analytics and show the transparent equation.
4. Open **BlueLedger** and show the hash chain plus retired status.
5. Switch to **Buyer**, open the retired batch proof sheet and download its certificate.
6. Switch to **Community** and show funding transparency.

## 6. Suggested judge questions and answers

### “Does the platform verify land ownership?”

No. It records authorization, lease and consent evidence. A qualified administrator reviews whether the evidence meets registry admission requirements. Legal title verification remains an external legal and administrative process.

### “Why use blockchain?”

Blockchain is used narrowly for tamper-evident lifecycle anchors: project approval, evidence bundle, MRV report, verification decision, issuance, transfer and retirement. Large files remain off-chain because storing them on-chain is expensive, slow and inappropriate for privacy.

### “Can the same monitoring period be issued twice?”

No. The database has a unique project-plus-period constraint, the API rejects an existing period and the contract contains a period-issued guard.

### “What prevents retired credits from being resold?”

The API permits transfers only from issued or transferred states. The contract enforces the same rule. Retired is terminal and cannot transition back to a transferable status.

### “Is the carbon estimate scientifically final?”

No. The prototype exposes ecosystem-specific factors and an uncertainty range to demonstrate the workflow. Production use requires regionally validated factors, an accepted carbon methodology and independent validation.

### “What does AI decide?”

AI-assisted checks can flag blurry or duplicate images, inconsistent GPS positions, stale satellite data and possible vegetation loss. These influence a data-quality or confidence score. They do not approve projects, approve evidence or issue credits.

### “Can a buyer verify the result independently?”

The buyer view exposes the project ID, report hash, event hash, transaction ID, vintage, quantity, holder and retirement status. The transaction opens in PolygonScan for independent inspection.

### “What happens when evidence is wrong?”

A verifier can reject it or request clarification with a comment. Corrected evidence is submitted as a new item, preserving the historical record rather than overwriting it.

### “How are communities protected?”

The prototype provides a simplified community view and a transparent benefit record. Production governance must additionally define consent, grievance, revenue-sharing, privacy and representation requirements with participating communities.

## 7. Reset and repeatability

The seed logic uses idempotent inserts. Restarting the application does not create duplicate demo projects, evidence, batches or benefits.

The demo role is persisted on the `demo@blueregistry.local` profile. Before a presentation, select **NGO** to restore the recommended starting role.

Avoid mutating the seeded risk project if the same environment will be used for repeated demos. Creating additional credit batches is safe as long as each uses a unique monitoring-period key.

## 8. Report behavior

Downloads are generated from current registry data:

- `MRV report` creates a PDF;
- `Credit certificate` creates a status-aware PDF;
- `Project audit trail` creates a CSV.

The seeded retired batch will generate a retirement-confirmed certificate. The issued batch will generate a credit certificate that explicitly states it is not retired.

## 9. Demo limitations to state proactively

- Polygon Amoy is a testnet.
- The included contract is prototype code and requires a formal audit.
- Demonstration transaction identifiers show the verification experience; production transactions must be generated by a deployed verifier-controlled contract.
- Seeded satellite comparison values represent the complete workflow but do not call an external satellite processor during the live demo.
- Carbon factors are illustrative defaults.
- No automated feature establishes land title.
- Organization verification, methodology validation and dispute resolution require real governance processes.
- The local role switcher is limited to the isolated demo identity and is not a production authorization feature.

Being explicit about these boundaries strengthens the project: the innovation is a transparent, testable evidence chain with responsible automation, not an exaggerated claim that software alone creates trustworthy carbon credits.

