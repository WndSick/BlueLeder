# BlueLedger: Codebase Implementation Inspection Report

This document reports on the actual implementation of the **BlueLedger / BlueRegistry** codebase, based strictly on the existing source files. 

---

## 1. Complete Technology Stack

Based on [package.json](file:///c:/Users/anish/Desktop/Major%20project/restored-blue-carbon/package.json), [vite.config.ts](file:///c:/Users/anish/Desktop/Major%20project/restored-blue-carbon/vite.config.ts), and the `app/` files:

* **Frontend framework:** Next.js (Version `16.2.6`) and React (Version `19.2.6`), configured via `vinext` in [package.json](file:///c:/Users/anish/Desktop/Major%20project/restored-blue-carbon/package.json).
* **Backend framework:** Node.js API endpoints using Next.js App Router API directory endpoints, running on Cloudflare Workers locally emulated by Wrangler (version `4.92.0`) and `@cloudflare/vite-plugin` (version `1.37.1`).
* **ORM:** Drizzle ORM (version `0.45.2`) is included in [package.json](file:///c:/Users/anish/Desktop/Major%20project/restored-blue-carbon/package.json) and defined in [db/schema.ts](file:///c:/Users/anish/Desktop/Major%20project/restored-blue-carbon/db/schema.ts). However, the API endpoints currently query D1/SQLite directly using raw, parameterized SQL execution via D1 bindings (`DB.prepare().bind()`).
* **Database currently used:** Cloudflare D1 Database (SQLite engine), configured inside [vite.config.ts](file:///c:/Users/anish/Desktop/Major%20project/restored-blue-carbon/vite.config.ts).
* **Object storage:** Cloudflare R2 Bucket (locally emulated in Wrangler), defined as `EVIDENCE` inside [vite.config.ts](file:///c:/Users/anish/Desktop/Major%20project/restored-blue-carbon/vite.config.ts).
* **Blockchain network:** Polygon Amoy Testnet (Chain ID `80002`), specified in [app/api/ledger/route.ts](file:///c:/Users/anish/Desktop/Major%20project/restored-blue-carbon/app/api/ledger/route.ts) and [contracts/BlueLedgerRegistry.sol](file:///c:/Users/anish/Desktop/Major%20project/restored-blue-carbon/contracts/BlueLedgerRegistry.sol).
* **Smart contract framework:** Hardhat (devDependency in `package.json`).
* **GIS libraries:** **Not Implemented**. No external GIS libraries (like Turf.js, Leaflet server-side utilities, or PostGIS) are imported or used in the backend. Handlers use custom mathematical functions written in pure TypeScript. Leaflet (version `1.9.4`) is used strictly on the client side for rendering maps.
* **PDF generation library:** **Not Implemented**. The application generates PDFs by compiling raw binary streams matching PDF structural declarations (`%PDF-1.4`) manually in [app/api/reports/route.ts](file:///c:/Users/anish/Desktop/Major%20project/restored-blue-carbon/app/api/reports/route.ts). No external PDF generator is used.
* **Authentication library:** **Not Implemented**. Bypassed using mock headers.
* **State management:** React `useState` hooks inside [app/registry-client.tsx](file:///c:/Users/anish/Desktop/Major%20project/restored-blue-carbon/app/registry-client.tsx).
* **Deployment configuration:** Wrangler configuration emulated via `@cloudflare/vite-plugin` in [vite.config.ts](file:///c:/Users/anish/Desktop/Major%20project/restored-blue-carbon/vite.config.ts).
* **Build tools:** Vite (version `8.0.13`) combined with the `vinext` plugin.

---

## 2. Database Implementation

### 2.1 Engine & Tables
The database is **Cloudflare D1 (SQLite)**, initialized dynamically inside [db/index.ts](file:///c:/Users/anish/Desktop/Major%20project/restored-blue-carbon/db/index.ts) using the `ensureSchema` function. 

The schema contains **10 tables**:
1. `users`: Stores user profiles (name, role, organization, and registration details).
2. `projects`: Stores submitted restoration projects, boundaries (as GeoJSON strings), and approval statuses.
3. `documents`: Stores object keys and metadata for project authorization documents.
4. `review_events`: Stores historical project approval logs and administrator notes.
5. `evidence_items`: Stores metadata and data payloads for submitted drone, sensor, satellite, and field observation data.
6. `evidence_files`: Stores uploader keys and SHA-256 hashes of raw files uploaded for monitoring evidence.
7. `evidence_reviews`: Stores verifier approvals or rejections of evidence items.
8. `credit_batches`: Stores credit vintage data, quantities, and current ownership status.
9. `ledger_events`: Stores cryptographic event logs mapping the hashes anchored onto the blockchain.
10. `benefit_records`: Stores community benefit-sharing transactions (amounts, beneficiaries, and proofs).

### 2.2 Table Relationships & Constraints
* **Foreign Keys:** **Not Implemented**. There are no `REFERENCES` constraints defined in any table creation scripts inside [db/index.ts](file:///c:/Users/anish/Desktop/Major%20project/restored-blue-carbon/db/index.ts). Tables are related logically via string fields (e.g., `project_id` matching `projects.id`), but referential integrity is not enforced at the database layer.
* **Indexes:**
  * Unique composite index `credit_batches_project_period_idx` on `credit_batches(project_id, period_key)`.
  * Unique index `ledger_events_hash_idx` on `ledger_events(event_hash)`.
  * Multi-column search index `evidence_items_project_time_idx` on `evidence_items(project_id, observed_at)`.
  * Indexes on `owner_email`, `status`, and `transaction_id`.

### 2.3 Storage Allocation

* **D1 Database:** Stores structural metadata, user accounts, GeoJSON strings, raw sensor numbers, status parameters, SHA-256 hashes, and local event chains.
* **R2 Bucket:** Stores raw file binaries (uploaded PDFs, JPEG/PNG field photos, and drone orthomosaics).
* **Blockchain:** Stores event hashes, project approval hashes, report anchors, and token statuses.

---

## 3. Authentication Implementation

* **Authentication:** **Not Implemented** (Mocked).
* **Login/Register Flow:** **Not Implemented**.
* **Password Hashing / JWT / Refresh Tokens / Sessions:** **Not Implemented**.

### 3.1 Mock Authentication Mechanism
The system implements mock authentication by checking incoming HTTP headers inside the `identity(request)` function in [app/api/registry/route.ts](file:///c:/Users/anish/Desktop/Major%20project/restored-blue-carbon/app/api/registry/route.ts#L20-L40):
```typescript
const email = request.headers.get("oai-authenticated-user-email");
const encodedName = request.headers.get("oai-authenticated-user-full-name");
```
If these headers are not present, it checks if `process.env.NODE_ENV !== "production"`. If true, it logs the user in as `demo@blueregistry.local`.

* **Middleware:** **Not Implemented**. There is no Next.js middleware file (`middleware.ts`) performing interception. Security checks are executed inline inside each API endpoint handler.
* **Protected Routes:** Every API route checks for a valid session via `identity(request)`. If it returns `null`, the route returns a `401 Unauthorized` JSON error.

---

## 4. Role-Based Access Control (RBAC)

RBAC is **partially implemented** using inline checks in the route handlers:

* **Role Storage:** Stored as a plain string (`role`) in the `users` table inside D1 ([db/index.ts](file:///c:/Users/anish/Desktop/Major%20project/restored-blue-carbon/db/index.ts)).
* **Checks Enforced in API Route Handlers:**
  * **Project Reviews:** Limited to `admin` in [app/api/registry/route.ts](file:///c:/Users/anish/Desktop/Major%20project/restored-blue-carbon/app/api/registry/route.ts#L307-L311):
    ```typescript
    if (reviewer?.role !== "admin") return jsonError("Admin access required.", 403);
    ```
  * **Evidence Reviews:** Limited to `admin` and `verifier` in [app/api/evidence/route.ts](file:///c:/Users/anish/Desktop/Major%20project/restored-blue-carbon/app/api/evidence/route.ts#L381-L384):
    ```typescript
    if (!["admin", "verifier"].includes(profile.role)) {
      return jsonError("Technical verifier access is required.", 403);
    }
    ```
  * **Project Creation:** Limited to `ngo` and `community` in [app/api/registry/route.ts](file:///c:/Users/anish/Desktop/Major%20project/restored-blue-carbon/app/api/registry/route.ts#L189-L195):
    ```typescript
    if (!profile || !["ngo", "community"].includes(profile.role)) {
      return jsonError("Your role cannot register projects.", 403);
    }
    ```
  * **Blockchain Key Operations / Issuance:** Restricted to `verifier` in [app/api/ledger/route.ts](file:///c:/Users/anish/Desktop/Major%20project/restored-blue-carbon/app/api/ledger/route.ts#L515-L516).

---

## 5. Registration System

* **Registration:** **Not Implemented**.
* There is no sign-up interface, email validation, invite verification, or KYC checks. Users are auto-created when they access the app if they have the proxy header, or they submit a profile form which calls the `save_profile` action inside [app/api/registry/route.ts](file:///c:/Users/anish/Desktop/Major%20project/restored-blue-carbon/app/api/registry/route.ts#L147-L187).

---

## 6. GIS Engine Implementation

No GIS database or PostGIS integrations exist. The spatial validations are written in pure TypeScript inside [app/api/analytics/route.ts](file:///c:/Users/anish/Desktop/Major%20project/restored-blue-carbon/app/api/analytics/route.ts) and [app/api/ledger/route.ts](file:///c:/Users/anish/Desktop/Major%20project/restored-blue-carbon/app/api/ledger/route.ts):

* **Polygon Storage:** Saved as raw JSON stringified structures in the `boundary_geojson` field of the `projects` table ([db/index.ts](file:///c:/Users/anish/Desktop/Major%20project/restored-blue-carbon/db/index.ts)).
* **Area Calculation:** Calculated using raw coordinate projection calculations assuming a flat earth approximation centered at the polygon's latitude:
  ```typescript
  const centerLat = points.reduce((sum, [, lat]) => sum + lat, 0) / points.length;
  const projected = points.map(([lng, lat]) => [
    earthRadius * lng * radians * Math.cos(centerLat * radians),
    earthRadius * lat * radians,
  ]);
  // Loops coordinates and calculates shoelace area divided by 10,000 to get Hectares
  ```
* **Overlap Detection:** Uses the `polygonsOverlap` function in [app/api/analytics/route.ts](file:///c:/Users/anish/Desktop/Major%20project/restored-blue-carbon/app/api/analytics/route.ts#L156-L168). It tests whether any segment of Polygon A intersects any segment of Polygon B using segment orientation math, and checks if the starting point of one polygon is contained within the other.
* **Point-In-Polygon:** Implements the Jordan ray-casting algorithm (`pointInPolygon`) checking if a GPS coordinate is inside the boundary:
  ```typescript
  yi > y !== yj > y && x < ((xj - xi) * (y - yi)) / (yj - yi || Number.EPSILON) + xi
  ```
* **Duplicate Detection:** Bounding box Intersection over Union (`bboxIou`) is calculated in [app/api/analytics/route.ts](file:///c:/Users/anish/Desktop/Major%20project/restored-blue-carbon/app/api/analytics/route.ts#L181-L191). If the resulting spatial similarity score exceeds $75\%$, a warning flag is triggered.

---

## 7. NDVI Telemetry Implementation

* **NDVI Telemetry:** **Mocked / Simulated**.
* **Google Earth Engine & Sentinel-2 APIs:** **Not Implemented**. No connections or api configurations exist.

### 7.1 Mock Calculations
NDVI is generated deterministically from the string characters of the Sentinel `sceneId` inside [app/api/analytics/route.ts](file:///c:/Users/anish/Desktop/Major%20project/restored-blue-carbon/app/api/analytics/route.ts#L225-L232):
```typescript
function deterministicNdvi(sceneId: string, ecosystem: string, stage: string, index: number) {
  let hash = 0;
  for (const character of sceneId) hash = (hash * 31 + character.charCodeAt(0)) >>> 0;
  const ecosystemBase = ecosystem === "mangrove" ? 0.5 : ecosystem === "seagrass" ? 0.38 : 0.45;
  const stageEffect = stage === "baseline" ? -0.06 : stage === "annual" ? 0.05 : 0.02;
  const variation = ((hash % 81) - 40) / 1000 + Math.min(index, 6) * 0.008;
  return Math.max(-1, Math.min(1, ecosystemBase + stageEffect + variation));
}
```
* `hash`: A 32-bit unsigned integer generated from the characters of the `sceneId`.
* `ecosystemBase`: Mangrove = `0.5`, Seagrass = `0.38`, Salt Marsh = `0.45`.
* `stageEffect`: Baseline = `-0.06`, Annual = `+0.05`, Quarterly/other = `+0.02`.
* `variation`: Adds variance based on the scene ID hash.

---

## 8. Continuous Monitoring Implementation

* **Continuous Monitoring:** **Not Implemented**.
* No cron jobs, background workers, or BullMQ tasks exist. 
* Checking for new satellite imagery must be triggered manually by the user interacting with the UI workspace, which initiates a fetch to `/api/analytics` or `/api/evidence`.

---

## 9. Carbon Sequestration Estimation

* **Estimation:** Simplified mathematical estimation.
* **Calculation Formula:** Located in `projectState` in [app/api/ledger/route.ts](file:///c:/Users/anish/Desktop/Major%20project/restored-blue-carbon/app/api/ledger/route.ts#L228-L230):
  ```typescript
  const annualCo2e = areaHectares * factor.biomass * factor.carbon * (44 / 12);
  ```
* **Biomass and Carbon Factors:**
  * `mangrove`: Biomass = `12.4`, Carbon = `0.47`
  * `seagrass`: Biomass = `4.2`, Carbon = `0.45`
  * `salt_marsh`: Biomass = `7.1`, Carbon = `0.46`
* **Variables:**
  * `44/12`: Conversion ratio from pure carbon weight to equivalent carbon dioxide ($\text{CO}_2$) weight.
  * `areaHectares`: Derived directly from the flat-earth geometry Shoelace calculations.

---

## 10. Blockchain Integration

### 10.1 Network & Deployment
* **Network:** Polygon Amoy Testnet (Chain ID `80002`).
* **Active Blockchain Integration:** **Not Implemented**. 
* Transaction execution does not connect to active wallets or provider nodes in the backend. Instead, the backend API expects a client-supplied hex transaction string (`transactionId`), validates it against the regex `/^0x[a-fA-F0-9]{64}$/`, and writes it directly to the local D1 database logs.

### 10.2 Solidity Smart Contract ([contracts/BlueLedgerRegistry.sol](file:///c:/Users/anish/Desktop/Major%20project/restored-blue-carbon/contracts/BlueLedgerRegistry.sol))
The contract implements a custom hash registry without token structures.

**Public and External Functions:**
* `setVerifier(address verifier, bool enabled)`: Authorizes or revokes a verifier account. (Owner only).
* `registerProject(bytes32 projectId, bytes32 approvalHash, bytes32 boundaryHash, bool areaCleared)`: Records project hash anchors. (Verifier only).
* `anchorMRVReport(...)`: Records report hash, evidence bundle hash, and verification decision hash. (Verifier only).
* `issueCredits(bytes32 batchId, bytes32 projectId, bytes32 periodKey, uint256 quantity, address recipient)`: Updates batch record status to `Issued` and blocks double issuance for the specified period. (Verifier only).
* `transferCredits(bytes32 batchId, address recipient)`: Updates the stored credit batch holder address. (Holder only).
* `retireCredits(bytes32 batchId, bytes32 retirementReasonHash)`: Updates status to `Retired` (Holder only).
* `cancelCredits(bytes32 batchId, bytes32 reasonHash)`: Sets status to `Cancelled` (Verifier only).

---

## 11. Credit Generation Pipeline

Step-by-step implementation flow:

1. **Project Registration:** NGO submits boundary and metadata via `/api/registry`. Saved as `status = 'submitted'` in the `projects` table.
2. **Document Approval:** Admin reviews the files via `/api/registry` (action `review_project`), updating the project status to `approved_for_mrv` in the `projects` table.
3. **Evidence Upload:** NGO uploads photos or sensor readings via `/api/evidence`. Saved in `evidence_items` and files in `evidence_files` (object keys stored in R2).
4. **Evidence Verification:** Verifier approves every evidence file via `/api/evidence` (action `review_evidence`), saving results in the `evidence_reviews` table.
5. **Hash Chain Preparation:** Verifier initiates `prepare_chain` via `/api/ledger`. The system generates SHA-256 hashes of the project approval data, boundary geometry, evidence items, and reviews, inserting them as events in the `ledger_events` table.
6. **Draft Credit Batch:** Project owner defines a monitoring period and quantity via `/api/ledger` (action `create_draft`), writing to the `credit_batches` table with status `draft`.
7. **Submit for Verification:** Owner submits the draft via `/api/ledger` (action `submit_for_verification`), updating the status to `pending_verification`.
8. **Credit Issuance:** Verifier executes `issue_credits` via `/api/ledger` (attaching a mock transaction hash). The API validates that all evidence items are approved, there are no overlaps, the quantity does not exceed the annual estimate, and the status changes to `issued`.

---

## 12. Storage Mapping

* **On-Chain (Polygon contract mappings):**
  * Project boundary and approval hashes (`approvalHash`, `boundaryHash`).
  * Report, evidence, and verification decision hashes (`reportHash`, `evidenceBundleHash`, `verificationDecisionHash`).
  * Token owner addresses and batch statuses (`holder`, `status`).
* **SQLite / D1 Database:**
  * Project names, locations, boundary coordinates (GeoJSON strings), and states.
  * Uploader profile data (emails, roles, contact numbers).
  * Raw sensor values, species counts, and observed tree survival percentages.
  * Local append-only ledger transaction event logs (`ledger_events`).
* **Cloudflare R2 Buckets:**
  * Baseline project PDF files.
  * Raw JPEG/PNG monitoring evidence photos.
* **Generated Cryptographic Hashes:**
  * `projectApprovalHash`: SHA-256 hash of project details.
  * `evidenceBundleHash`: SHA-256 hash of evidence items and files.
  * `verificationDecisionHash`: SHA-256 hash of verifier decisions.
  * `mrvReportHash`: SHA-256 hash of the complete MRV report payload.

---

## 13. Reports Generation

Reports are generated dynamically on GET requests to [app/api/reports/route.ts](file:///c:/Users/anish/Desktop/Major%20project/restored-blue-carbon/app/api/reports/route.ts):

* **PDF Reports:** Compiled manually by writing raw PDF document syntax strings (using `makePdf` function at lines 52-111). It wraps text lines, defines PDF catalogs, page collections, and renders Helvetica text using absolute coordinate parameters. No third-party PDF generators are imported.
* **CSV Audit Trails:** Generated by converting arrays of events into comma-separated text strings with escaped double quotes, using the `csv` helper function at line 113.
* **Data Source:** Queried directly from SQLite tables (`projects`, `evidence_items`, `credit_batches`, `ledger_events`, and `benefit_records`).

---

## 14. API Reference

### 14.1 `/api/registry` (NextRequest Handler)
* **GET:** Retrieves project metadata, user profiles, and uploads.
  * *Request Parameters:* `documentId` (optional).
  * *Response:* JSON containing user profile and projects array, or a PDF/image binary stream if `documentId` is passed.
  * *DB Tables:* `users`, `projects`, `documents`.
  * *R2 Interaction:* Fetches file binaries using `EVIDENCE.get()` if `documentId` is provided.
* **POST:** Executes profile updates, project registrations, or admin status reviews.
  * *Input:* Multipart FormData. Actions: `switch_demo_role`, `save_profile`, `create_project`, `review_project`.
  * *DB Tables:* `users`, `projects`, `documents`, `review_events`.
  * *R2 Interaction:* Uploads project registration files to R2 using `EVIDENCE.put()`.

### 14.2 `/api/evidence` (NextRequest Handler)
* **GET:** Retrieves project evidence items, uploads, and review files.
  * *Request Parameters:* `fileId` (optional), `projectId` (optional).
  * *Response:* JSON evidence timeline or raw file binaries.
  * *DB Tables:* `users`, `projects`, `evidence_items`, `evidence_files`, `evidence_reviews`.
  * *R2 Interaction:* Fetches files from R2 using `EVIDENCE.get()` if `fileId` is provided.
* **POST:** Submits evidence items or verifier review decisions.
  * *Input:* Multipart FormData. Actions: `submit_evidence`, `review_evidence`.
  * *DB Tables:* `users`, `projects`, `evidence_items`, `evidence_files`, `evidence_reviews`.
  * *R2 Interaction:* Uploads monitoring photos to R2 using `EVIDENCE.put()`.

### 14.3 `/api/ledger` (NextRequest Handler)
* **GET:** Retrieves hashes and transaction event lists.
  * *Response:* JSON object mapping ledger events, batches, and verification metrics.
  * *DB Tables:* `users`, `projects`, `evidence_items`, `evidence_files`, `evidence_reviews`, `credit_batches`, `ledger_events`.
* **POST:** Executes credit draft creation, submits batches, or records transfers/retirements.
  * *Input:* Multipart FormData. Actions: `prepare_chain`, `create_draft`, `submit_for_verification`, `issue_credits`, `transfer_credits`, `retire_credits`.
  * *DB Tables:* `projects`, `credit_batches`, `ledger_events`.

### 14.4 `/api/analytics` (NextRequest Handler)
* **GET:** Executes spatial validation checks.
  * *Response:* JSON containing overlap warnings, boundary conflicts, and simulated NDVI telemetry metrics.
  * *DB Tables:* `users`, `projects`, `evidence_items`, `evidence_files`, `evidence_reviews`.

### 14.5 `/api/reports` (NextRequest Handler)
* **GET:** Returns PDF reports or CSV audit trails.
  * *Request Parameters:* `type` (values: `mrv`, `certificate`, `audit`).
  * *Response:* PDF binary stream or CSV text file.
  * *DB Tables:* `projects`, `evidence_items`, `evidence_reviews`, `credit_batches`, `ledger_events`, `benefit_records`.

---

## 15. Smart Contract Review ([BlueLedgerRegistry.sol](file:///c:/Users/anish/Desktop/Major%20project/restored-blue-carbon/contracts/BlueLedgerRegistry.sol))

* **State Variables:**
  * `owner`: Address of the contract owner.
* **Mappings:**
  * `verifiers`: `address => bool` (tracks authorized verifier accounts).
  * `projects`: `bytes32 => ProjectAnchor` (maps project ID to registration approvals).
  * `reports`: `bytes32 => ReportAnchor` (maps hashed project and period to MRV details).
  * `batches`: `bytes32 => CreditBatch` (maps batch ID to batch details).
  * `periodIssued`: `bytes32 => mapping(bytes32 => bool)` (prevents double minting for a given project and period).
* **Modifiers:**
  * `onlyOwner`: Restricts execution to the owner.
  * `onlyVerifier`: Restricts execution to authorized verifiers.
* **Security Mechanics:** Modifies variables using standard check requirements (`require`), emitting matching events. It lacks contract upgrade pathways (no proxy patterns) and does not implement reentrancy guards.
* **Token Standard:** **Custom Mapping**. It does not inherit from ERC-20, ERC-721, or ERC-1155. It uses internal storage structs (`CreditBatch`) to track quantities and current holder addresses.

---

## 16. Current Project Status

| Feature | Implementation Status | References |
| :--- | :--- | :--- |
| **Authentication** | 🔵 Mock / Simulated | [app/chatgpt-auth.ts](file:///c:/Users/anish/Desktop/Major%20project/restored-blue-carbon/app/chatgpt-auth.ts) |
| **Registration** | ❌ Not Implemented | None |
| **RBAC** | 🟡 Partially Implemented | Inline checks in `/api/registry`, `/api/evidence`, `/api/ledger` |
| **NDVI Telemetry** | 🔵 Mock / Simulated | `deterministicNdvi` in [app/api/analytics/route.ts](file:///c:/Users/anish/Desktop/Major%20project/restored-blue-carbon/app/api/analytics/route.ts#L225) |
| **Google Earth Engine**| ❌ Not Implemented | None |
| **Polygon Rendering** | ✅ Fully Implemented | Client-side map workspace using Leaflet |
| **Credit Generation** | ✅ Fully Implemented | Handlers inside [app/api/ledger/route.ts](file:///c:/Users/anish/Desktop/Major%20project/restored-blue-carbon/app/api/ledger/route.ts) |
| **Marketplace** | ❌ Not Implemented | None |
| **Continuous Monitoring**| ❌ Not Implemented | None |
| **BullMQ & Redis** | ❌ Not Implemented | None |
| **Notifications** | ❌ Not Implemented | None |
| **Reports** | ✅ Fully Implemented | Native stream builder in [app/api/reports/route.ts](file:///c:/Users/anish/Desktop/Major%20project/restored-blue-carbon/app/api/reports/route.ts) |
| **GIS Operations** | 🔵 Mock / Simulated | Custom JS geometry in [app/api/analytics/route.ts](file:///c:/Users/anish/Desktop/Major%20project/restored-blue-carbon/app/api/analytics/route.ts) |
| **Blockchain** | 🔵 Mock / Simulated | Contract exists; transaction broadcasting is bypassed |
| **PDF Generation** | ✅ Fully Implemented | Manual string compilers in [app/api/reports/route.ts](file:///c:/Users/anish/Desktop/Major%20project/restored-blue-carbon/app/api/reports/route.ts) |
| **Cloudflare R2** | ✅ Fully Implemented | File uploads and downloads via local emulated uploader |
| **PostGIS** | ❌ Not Implemented | None |
| **Carbon Estimation** | ✅ Fully Implemented | Linear constants in [app/api/ledger/route.ts](file:///c:/Users/anish/Desktop/Major%20project/restored-blue-carbon/app/api/ledger/route.ts) |
| **Admin Dashboard** | ✅ Fully Implemented | [app/stakeholder-dashboard.tsx](file:///c:/Users/anish/Desktop/Major%20project/restored-blue-carbon/app/stakeholder-dashboard.tsx) |
| **Buyer Dashboard** | ✅ Fully Implemented | [app/stakeholder-dashboard.tsx](file:///c:/Users/anish/Desktop/Major%20project/restored-blue-carbon/app/stakeholder-dashboard.tsx) |
| **Evidence Upload** | ✅ Fully Implemented | [app/evidence-workspace.tsx](file:///c:/Users/anish/Desktop/Major%20project/restored-blue-carbon/app/evidence-workspace.tsx) |
| **Project Submission** | ✅ Fully Implemented | [app/registry-client.tsx](file:///c:/Users/anish/Desktop/Major%20project/restored-blue-carbon/app/registry-client.tsx) |
