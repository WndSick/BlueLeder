import fs from "fs";
import path from "path";

export type AppEnv = {
  DB?: any;
  EVIDENCE: any;
};

const mockEvidence = {
  async put(key: string, body: any, options?: any) {
    const filePath = path.join(process.cwd(), ".wrangler", "evidence", key);
    fs.mkdirSync(path.dirname(filePath), { recursive: true });
    const buffer = body instanceof ArrayBuffer ? Buffer.from(body) : Buffer.from(body);
    fs.writeFileSync(filePath, buffer);
  },
  async get(key: string) {
    const filePath = path.join(process.cwd(), ".wrangler", "evidence", key);
    if (!fs.existsSync(filePath)) return null;
    const fileBuffer = fs.readFileSync(filePath);
    return {
      body: fileBuffer,
      arrayBuffer: async () => fileBuffer.buffer,
    };
  }
};

let cloudflareEnv: any = null;
try {
  // @ts-ignore
  const workers = await import("cloudflare:workers");
  cloudflareEnv = workers.env;
} catch {}

export function getEnv(): AppEnv {
  if (cloudflareEnv) {
    return cloudflareEnv;
  }
  return {
    EVIDENCE: mockEvidence
  };
}

export async function ensureSchema(db: any) {
  await db.batch([
    db.prepare(`CREATE TABLE IF NOT EXISTS users (
      email TEXT PRIMARY KEY,
      full_name TEXT NOT NULL,
      role TEXT NOT NULL,
      organization TEXT,
      registration_number TEXT,
      organization_type TEXT,
      website TEXT,
      contact_phone TEXT,
      verification_status TEXT NOT NULL DEFAULT 'unverified',
      created_at TEXT NOT NULL,
      updated_at TEXT NOT NULL
    )`),
    db.prepare(`CREATE TABLE IF NOT EXISTS projects (
      id TEXT PRIMARY KEY,
      owner_email TEXT NOT NULL,
      name TEXT NOT NULL,
      ecosystem TEXT NOT NULL,
      state TEXT NOT NULL,
      district TEXT NOT NULL,
      village TEXT NOT NULL,
      start_date TEXT NOT NULL,
      duration_years INTEGER NOT NULL,
      responsible_organization TEXT NOT NULL,
      community_partner TEXT NOT NULL,
      boundary_geojson TEXT NOT NULL,
      area_hectares REAL NOT NULL,
      status TEXT NOT NULL DEFAULT 'submitted',
      reviewer_note TEXT,
      submitted_at TEXT NOT NULL,
      updated_at TEXT NOT NULL
    )`),
    db.prepare(`CREATE TABLE IF NOT EXISTS documents (
      id TEXT PRIMARY KEY,
      project_id TEXT NOT NULL,
      category TEXT NOT NULL,
      file_name TEXT NOT NULL,
      object_key TEXT NOT NULL,
      content_type TEXT NOT NULL,
      size_bytes INTEGER NOT NULL,
      uploaded_at TEXT NOT NULL
    )`),
    db.prepare(`CREATE TABLE IF NOT EXISTS review_events (
      id TEXT PRIMARY KEY,
      project_id TEXT NOT NULL,
      actor_email TEXT NOT NULL,
      from_status TEXT,
      to_status TEXT NOT NULL,
      note TEXT,
      created_at TEXT NOT NULL
    )`),
    db.prepare(`CREATE TABLE IF NOT EXISTS evidence_items (
      id TEXT PRIMARY KEY,
      project_id TEXT NOT NULL,
      source_type TEXT NOT NULL,
      monitoring_stage TEXT NOT NULL,
      period_label TEXT NOT NULL,
      observed_at TEXT NOT NULL,
      uploader_email TEXT NOT NULL,
      data_json TEXT NOT NULL,
      created_at TEXT NOT NULL
    )`),
    db.prepare(`CREATE TABLE IF NOT EXISTS evidence_files (
      id TEXT PRIMARY KEY,
      evidence_id TEXT NOT NULL,
      project_id TEXT NOT NULL,
      file_role TEXT NOT NULL,
      file_name TEXT NOT NULL,
      object_key TEXT NOT NULL,
      content_type TEXT NOT NULL,
      size_bytes INTEGER NOT NULL,
      sha256 TEXT NOT NULL,
      uploaded_at TEXT NOT NULL
    )`),
    db.prepare(`CREATE TABLE IF NOT EXISTS evidence_reviews (
      id TEXT PRIMARY KEY,
      evidence_id TEXT NOT NULL,
      project_id TEXT NOT NULL,
      reviewer_email TEXT NOT NULL,
      decision TEXT NOT NULL,
      comment TEXT,
      created_at TEXT NOT NULL
    )`),
    db.prepare(`CREATE TABLE IF NOT EXISTS credit_batches (
      id TEXT PRIMARY KEY,
      project_id TEXT NOT NULL,
      period_key TEXT NOT NULL,
      vintage_year INTEGER NOT NULL,
      report_hash TEXT,
      issued_quantity REAL NOT NULL,
      current_holder TEXT NOT NULL,
      status TEXT NOT NULL DEFAULT 'draft',
      created_by TEXT NOT NULL,
      created_at TEXT NOT NULL,
      updated_at TEXT NOT NULL
    )`),
    db.prepare(`CREATE TABLE IF NOT EXISTS ledger_events (
      id TEXT PRIMARY KEY,
      project_id TEXT NOT NULL,
      batch_id TEXT,
      event_type TEXT NOT NULL,
      entity_id TEXT NOT NULL,
      period_key TEXT,
      payload_hash TEXT NOT NULL,
      previous_event_hash TEXT,
      event_hash TEXT NOT NULL,
      network TEXT NOT NULL,
      chain_id INTEGER NOT NULL,
      transaction_id TEXT,
      actor_email TEXT NOT NULL,
      metadata_json TEXT NOT NULL,
      created_at TEXT NOT NULL
    )`),
    db.prepare(`CREATE TABLE IF NOT EXISTS benefit_records (
      id TEXT PRIMARY KEY,
      project_id TEXT NOT NULL,
      record_type TEXT NOT NULL,
      amount REAL NOT NULL,
      currency TEXT NOT NULL DEFAULT 'INR',
      beneficiary TEXT NOT NULL,
      description TEXT NOT NULL,
      recorded_at TEXT NOT NULL,
      proof_hash TEXT NOT NULL
    )`),
    db.prepare("CREATE INDEX IF NOT EXISTS projects_owner_idx ON projects (owner_email)"),
    db.prepare("CREATE INDEX IF NOT EXISTS projects_status_idx ON projects (status)"),
    db.prepare("CREATE INDEX IF NOT EXISTS documents_project_idx ON documents (project_id)"),
    db.prepare("CREATE INDEX IF NOT EXISTS evidence_items_project_time_idx ON evidence_items (project_id, observed_at)"),
    db.prepare("CREATE INDEX IF NOT EXISTS evidence_files_item_idx ON evidence_files (evidence_id)"),
    db.prepare("CREATE UNIQUE INDEX IF NOT EXISTS evidence_files_object_key_idx ON evidence_files (object_key)"),
    db.prepare("CREATE INDEX IF NOT EXISTS evidence_reviews_item_time_idx ON evidence_reviews (evidence_id, created_at)"),
    db.prepare("CREATE UNIQUE INDEX IF NOT EXISTS credit_batches_project_period_idx ON credit_batches (project_id, period_key)"),
    db.prepare("CREATE INDEX IF NOT EXISTS credit_batches_project_status_idx ON credit_batches (project_id, status)"),
    db.prepare("CREATE UNIQUE INDEX IF NOT EXISTS ledger_events_hash_idx ON ledger_events (event_hash)"),
    db.prepare("CREATE INDEX IF NOT EXISTS ledger_events_project_time_idx ON ledger_events (project_id, created_at)"),
    db.prepare("CREATE INDEX IF NOT EXISTS ledger_events_batch_time_idx ON ledger_events (batch_id, created_at)"),
    db.prepare("CREATE INDEX IF NOT EXISTS ledger_events_tx_idx ON ledger_events (transaction_id)"),
    db.prepare("CREATE INDEX IF NOT EXISTS benefit_records_project_time_idx ON benefit_records (project_id, recorded_at)"),
    db.prepare(`INSERT OR IGNORE INTO users (
      email, full_name, role, organization, registration_number, organization_type,
      website, contact_phone, verification_status, created_at, updated_at
    ) VALUES (
      'demo@blueregistry.local', 'Asha — SIH Demo', 'ngo',
      'Sundarban Community Restoration Collective', 'WB-SCR-2026-014',
      'Community-led NGO', 'https://example.org/blueledger-demo', '+91 90000 00000',
      'verified', '2026-01-05T09:00:00.000Z', '2026-07-15T11:30:00.000Z'
    )`),
    db.prepare(`INSERT OR IGNORE INTO users (
      email, full_name, role, organization, registration_number, organization_type,
      website, contact_phone, verification_status, created_at, updated_at
    ) VALUES (
      'pending-ngo@blueregistry.local', 'Rahim Coastal Trust', 'ngo',
      'Rahim Coastal Trust', 'WB-RCT-2026-088', 'Registered NGO',
      '', '+91 90000 00088', 'unverified',
      '2026-07-21T09:00:00.000Z', '2026-07-21T09:00:00.000Z'
    )`),
    db.prepare(`INSERT OR IGNORE INTO projects (
      id, owner_email, name, ecosystem, state, district, village, start_date,
      duration_years, responsible_organization, community_partner, boundary_geojson,
      area_hectares, status, reviewer_note, submitted_at, updated_at
    ) VALUES (
      'demo-sundarbans-001', 'demo@blueregistry.local',
      'Sundarban Mangrove Recovery Corridor', 'mangrove', 'West Bengal',
      'South 24 Parganas', 'Gosaba', '2025-06-05', 20,
      'Sundarban Community Restoration Collective', 'Gosaba Gram Sabha',
      '{"type":"Feature","properties":{"name":"Demo boundary"},"geometry":{"type":"Polygon","coordinates":[[[88.796,21.942],[88.811,21.942],[88.811,21.952],[88.796,21.952],[88.796,21.942]]]}}',
      154.80, 'approved_for_mrv',
      'Authorization evidence reviewed. Approved for technical MRV; land ownership was not automatically verified.',
      '2025-05-18T08:30:00.000Z', '2026-07-15T11:30:00.000Z'
    )`),
    db.prepare(`INSERT OR IGNORE INTO review_events (
      id, project_id, actor_email, from_status, to_status, note, created_at
    ) VALUES (
      'demo-project-approval', 'demo-sundarbans-001', 'admin@blueregistry.local',
      'document_review', 'approved_for_mrv',
      'Community consent, lease authorization and baseline plan reviewed by the demo administrator.',
      '2025-06-02T10:15:00.000Z'
    )`),
    db.prepare(`INSERT OR IGNORE INTO projects (
      id, owner_email, name, ecosystem, state, district, village, start_date,
      duration_years, responsible_organization, community_partner, boundary_geojson,
      area_hectares, status, reviewer_note, submitted_at, updated_at
    ) VALUES (
      'demo-overlap-alert-002', 'pending-ngo@blueregistry.local',
      'Matla Creek Mangrove Proposal', 'mangrove', 'West Bengal',
      'South 24 Parganas', 'Gosaba', '2026-08-15', 15,
      'Rahim Coastal Trust', 'Matla Fisher Cooperative',
      '{"type":"Feature","properties":{"name":"Overlap alert"},"geometry":{"type":"Polygon","coordinates":[[[88.806,21.946],[88.817,21.946],[88.817,21.956],[88.806,21.956],[88.806,21.946]]]}}',
      112.40, 'document_review',
      'Automated GIS pre-check indicates overlap with an approved project; qualified review required.',
      '2026-07-21T09:30:00.000Z', '2026-07-22T11:30:00.000Z'
    )`),
    db.prepare(`INSERT OR IGNORE INTO evidence_items (
      id, project_id, source_type, monitoring_stage, period_label, observed_at,
      uploader_email, data_json, created_at
    ) VALUES (
      'demo-field-2026q2', 'demo-sundarbans-001', 'field', 'quarterly',
      '2026 Q2 field survey', '2026-06-18T06:45:00.000Z',
      'demo@blueregistry.local',
      '{"latitude":21.9471,"longitude":88.8034,"species":"Avicennia marina","saplings":12400,"survivalPercent":86,"notes":"Three transects surveyed with community monitors; natural regeneration visible."}',
      '2026-06-18T09:10:00.000Z'
    )`),
    db.prepare(`INSERT OR IGNORE INTO evidence_items (
      id, project_id, source_type, monitoring_stage, period_label, observed_at,
      uploader_email, data_json, created_at
    ) VALUES (
      'demo-sensor-2026q2', 'demo-sundarbans-001', 'sensor', 'quarterly',
      '2026 Q2 sensor window', '2026-06-18T07:00:00.000Z',
      'demo@blueregistry.local',
      '{"sensorId":"GOS-SAL-07","salinity":18.7,"waterLevel":1.24,"soilMoisture":63.4,"temperature":29.1,"sampleCount":2160}',
      '2026-06-18T09:12:00.000Z'
    )`),
    db.prepare(`INSERT OR IGNORE INTO evidence_items (
      id, project_id, source_type, monitoring_stage, period_label, observed_at,
      uploader_email, data_json, created_at
    ) VALUES (
      'demo-satellite-2026q2', 'demo-sundarbans-001', 'satellite', 'quarterly',
      '2026 Q2 Sentinel-2 comparison', '2026-06-22T04:55:00.000Z',
      'demo@blueregistry.local',
      '{"sceneId":"S2B_MSIL2A_20260622_GOSABA","provider":"Sentinel-2","cloudCover":7.8,"baselineNdvi":0.31,"currentNdvi":0.58,"imageDate":"2026-06-22"}',
      '2026-06-22T08:20:00.000Z'
    )`),
    db.prepare(`INSERT OR IGNORE INTO evidence_reviews (
      id, evidence_id, project_id, reviewer_email, decision, comment, created_at
    ) VALUES (
      'demo-review-field', 'demo-field-2026q2', 'demo-sundarbans-001',
      'verifier@blueregistry.local', 'approved',
      'GPS locations are inside the approved polygon; survival sample is adequately documented.',
      '2026-06-25T12:00:00.000Z'
    )`),
    db.prepare(`INSERT OR IGNORE INTO evidence_reviews (
      id, evidence_id, project_id, reviewer_email, decision, comment, created_at
    ) VALUES (
      'demo-review-sensor', 'demo-sensor-2026q2', 'demo-sundarbans-001',
      'verifier@blueregistry.local', 'approved',
      'Sensor continuity and calibration metadata meet the prototype evidence threshold.',
      '2026-06-25T12:10:00.000Z'
    )`),
    db.prepare(`INSERT OR IGNORE INTO evidence_reviews (
      id, evidence_id, project_id, reviewer_email, decision, comment, created_at
    ) VALUES (
      'demo-review-satellite', 'demo-satellite-2026q2', 'demo-sundarbans-001',
      'verifier@blueregistry.local', 'approved',
      'Low-cloud Sentinel-2 scene supports the positive vegetation trend.',
      '2026-06-25T12:20:00.000Z'
    )`),
    db.prepare(`INSERT OR IGNORE INTO evidence_items (
      id, project_id, source_type, monitoring_stage, period_label, observed_at,
      uploader_email, data_json, created_at
    ) VALUES (
      'demo-review-queue-item', 'demo-overlap-alert-002', 'field', 'baseline',
      'Baseline transect A', '2026-07-20T06:30:00.000Z',
      'pending-ngo@blueregistry.local',
      '{"latitude":21.949,"longitude":88.809,"species":"Rhizophora mucronata","saplings":0,"survivalPercent":0,"notes":"Baseline transect submitted for verifier review."}',
      '2026-07-21T09:35:00.000Z'
    )`),
    db.prepare(`INSERT OR IGNORE INTO credit_batches (
      id, project_id, period_key, vintage_year, report_hash, issued_quantity,
      current_holder, status, created_by, created_at, updated_at
    ) VALUES (
      'demo-batch-issued-2026', 'demo-sundarbans-001', '2026-Q2', 2026,
      '0x7adf68be8bfe328cc76f7e75a0a53e24be58b5df795773d39ec117c44e61d7a1',
      1280, 'Coastal Climate Fund', 'issued', 'verifier@blueregistry.local',
      '2026-07-01T10:00:00.000Z', '2026-07-01T10:00:00.000Z'
    )`),
    db.prepare(`INSERT OR IGNORE INTO credit_batches (
      id, project_id, period_key, vintage_year, report_hash, issued_quantity,
      current_holder, status, created_by, created_at, updated_at
    ) VALUES (
      'demo-batch-retired-2025', 'demo-sundarbans-001', '2025-ANNUAL', 2025,
      '0x93ab0ba935ff61914fde86c1bc649bb8c3b5b4d512df2259df3a86219f25ba11',
      940, 'Delta Foods India', 'retired', 'verifier@blueregistry.local',
      '2026-02-14T10:00:00.000Z', '2026-03-02T14:20:00.000Z'
    )`),
    db.prepare(`INSERT OR IGNORE INTO ledger_events (
      id, project_id, batch_id, event_type, entity_id, period_key, payload_hash,
      previous_event_hash, event_hash, network, chain_id, transaction_id,
      actor_email, metadata_json, created_at
    ) VALUES (
      'demo-ledger-issuance', 'demo-sundarbans-001', 'demo-batch-issued-2026',
      'credit_issuance', 'demo-batch-issued-2026', '2026-Q2',
      '0x692aec960a535a088bd69dc1704f84f855a29855b66652983a8182ecace21ed4',
      NULL, '0x79b17767d0d0b1b3f48b2b05dbfa9df48afde17187ce51caa3b17c5ee1d234aa',
      'polygon-amoy', 80002,
      '0xb90653b56c411ea5440a2c802b74b18c751656af83ee99f7c43d44a714e86544',
      'verifier@blueregistry.local',
      '{"quantity":1280,"smartContractFunction":"issueCredits","status":"issued"}',
      '2026-07-01T10:00:00.000Z'
    )`),
    db.prepare(`INSERT OR IGNORE INTO ledger_events (
      id, project_id, batch_id, event_type, entity_id, period_key, payload_hash,
      previous_event_hash, event_hash, network, chain_id, transaction_id,
      actor_email, metadata_json, created_at
    ) VALUES (
      'demo-ledger-retirement', 'demo-sundarbans-001', 'demo-batch-retired-2025',
      'credit_retirement', 'demo-batch-retired-2025', '2025-ANNUAL',
      '0x14f3f6c367a7354d45f14eb367ace1e527e0e8c8ae98c973769343ec8bc42dde',
      '0x79b17767d0d0b1b3f48b2b05dbfa9df48afde17187ce51caa3b17c5ee1d234aa',
      '0x424b7fc8844ae9d6c38cd97f15bd1a66c5d0525f95a989329769e93e3447df60',
      'polygon-amoy', 80002,
      '0x2ca076cd86df6a6cb9b5085616055403615750a322b2e76277005156095cfca63',
      'verifier@blueregistry.local',
      '{"quantity":940,"holder":"Delta Foods India","retirementPurpose":"2025 operations claim","smartContractFunction":"retireCredits","status":"retired"}',
      '2026-03-02T14:20:00.000Z'
    )`),
    db.prepare(`INSERT OR IGNORE INTO benefit_records (
      id, project_id, record_type, amount, currency, beneficiary, description,
      recorded_at, proof_hash
    ) VALUES (
      'demo-benefit-grant', 'demo-sundarbans-001', 'restoration_grant', 1850000,
      'INR', 'Gosaba Gram Sabha',
      'Nursery materials, boat transport and restoration wages for the 2026 monsoon cycle.',
      '2026-05-12T10:00:00.000Z',
      '0xa5abbcc9201402ce2ef3b2c3322a9b5a0a1dbf20d63464e10278f314a093a29d'
    )`),
    db.prepare(`INSERT OR IGNORE INTO benefit_records (
      id, project_id, record_type, amount, currency, beneficiary, description,
      recorded_at, proof_hash
    ) VALUES (
      'demo-benefit-community', 'demo-sundarbans-001', 'community_payment', 620000,
      'INR', '48 community restoration workers',
      'Verified planting, monitoring and nursery stewardship payments.',
      '2026-06-30T10:00:00.000Z',
      '0x4081f07eb3af14b85d44648eb0eb94a0b6591418fa2d7ed68add41235d8ab925'
    )`),
  ]);
}
