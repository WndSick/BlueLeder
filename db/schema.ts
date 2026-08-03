import { index, integer, real, sqliteTable, text, uniqueIndex } from "drizzle-orm/sqlite-core";

export const users = sqliteTable("users", {
  email: text("email").primaryKey(),
  fullName: text("full_name").notNull(),
  role: text("role").notNull(),
  organization: text("organization"),
  registrationNumber: text("registration_number"),
  organizationType: text("organization_type"),
  website: text("website"),
  contactPhone: text("contact_phone"),
  verificationStatus: text("verification_status").notNull().default("unverified"),
  createdAt: text("created_at").notNull(),
  updatedAt: text("updated_at").notNull(),
});

export const projects = sqliteTable("projects", {
  id: text("id").primaryKey(),
  ownerEmail: text("owner_email").notNull(),
  name: text("name").notNull(),
  ecosystem: text("ecosystem").notNull(),
  state: text("state").notNull(),
  district: text("district").notNull(),
  village: text("village").notNull(),
  startDate: text("start_date").notNull(),
  durationYears: integer("duration_years").notNull(),
  responsibleOrganization: text("responsible_organization").notNull(),
  communityPartner: text("community_partner").notNull(),
  boundaryGeojson: text("boundary_geojson").notNull(),
  areaHectares: real("area_hectares").notNull(),
  status: text("status").notNull().default("submitted"),
  reviewerNote: text("reviewer_note"),
  submittedAt: text("submitted_at").notNull(),
  updatedAt: text("updated_at").notNull(),
});

export const documents = sqliteTable("documents", {
  id: text("id").primaryKey(),
  projectId: text("project_id").notNull(),
  category: text("category").notNull(),
  fileName: text("file_name").notNull(),
  objectKey: text("object_key").notNull(),
  contentType: text("content_type").notNull(),
  sizeBytes: integer("size_bytes").notNull(),
  uploadedAt: text("uploaded_at").notNull(),
});

export const reviewEvents = sqliteTable("review_events", {
  id: text("id").primaryKey(),
  projectId: text("project_id").notNull(),
  actorEmail: text("actor_email").notNull(),
  fromStatus: text("from_status"),
  toStatus: text("to_status").notNull(),
  note: text("note"),
  createdAt: text("created_at").notNull(),
});

export const evidenceItems = sqliteTable(
  "evidence_items",
  {
    id: text("id").primaryKey(),
    projectId: text("project_id").notNull(),
    sourceType: text("source_type").notNull(),
    monitoringStage: text("monitoring_stage").notNull(),
    periodLabel: text("period_label").notNull(),
    observedAt: text("observed_at").notNull(),
    uploaderEmail: text("uploader_email").notNull(),
    dataJson: text("data_json").notNull(),
    createdAt: text("created_at").notNull(),
  },
  (table) => [
    index("evidence_items_project_time_idx").on(table.projectId, table.observedAt),
  ],
);

export const evidenceFiles = sqliteTable(
  "evidence_files",
  {
    id: text("id").primaryKey(),
    evidenceId: text("evidence_id").notNull(),
    projectId: text("project_id").notNull(),
    fileRole: text("file_role").notNull(),
    fileName: text("file_name").notNull(),
    objectKey: text("object_key").notNull(),
    contentType: text("content_type").notNull(),
    sizeBytes: integer("size_bytes").notNull(),
    sha256: text("sha256").notNull(),
    uploadedAt: text("uploaded_at").notNull(),
  },
  (table) => [
    index("evidence_files_item_idx").on(table.evidenceId),
    uniqueIndex("evidence_files_object_key_idx").on(table.objectKey),
  ],
);

export const evidenceReviews = sqliteTable(
  "evidence_reviews",
  {
    id: text("id").primaryKey(),
    evidenceId: text("evidence_id").notNull(),
    projectId: text("project_id").notNull(),
    reviewerEmail: text("reviewer_email").notNull(),
    decision: text("decision").notNull(),
    comment: text("comment"),
    createdAt: text("created_at").notNull(),
  },
  (table) => [
    index("evidence_reviews_item_time_idx").on(table.evidenceId, table.createdAt),
  ],
);

export const creditBatches = sqliteTable(
  "credit_batches",
  {
    id: text("id").primaryKey(),
    projectId: text("project_id").notNull(),
    periodKey: text("period_key").notNull(),
    vintageYear: integer("vintage_year").notNull(),
    reportHash: text("report_hash"),
    issuedQuantity: real("issued_quantity").notNull(),
    currentHolder: text("current_holder").notNull(),
    status: text("status").notNull().default("draft"),
    createdBy: text("created_by").notNull(),
    createdAt: text("created_at").notNull(),
    updatedAt: text("updated_at").notNull(),
  },
  (table) => [
    uniqueIndex("credit_batches_project_period_idx").on(table.projectId, table.periodKey),
    index("credit_batches_project_status_idx").on(table.projectId, table.status),
  ],
);

export const ledgerEvents = sqliteTable(
  "ledger_events",
  {
    id: text("id").primaryKey(),
    projectId: text("project_id").notNull(),
    batchId: text("batch_id"),
    eventType: text("event_type").notNull(),
    entityId: text("entity_id").notNull(),
    periodKey: text("period_key"),
    payloadHash: text("payload_hash").notNull(),
    previousEventHash: text("previous_event_hash"),
    eventHash: text("event_hash").notNull(),
    network: text("network").notNull(),
    chainId: integer("chain_id").notNull(),
    transactionId: text("transaction_id"),
    actorEmail: text("actor_email").notNull(),
    metadataJson: text("metadata_json").notNull(),
    createdAt: text("created_at").notNull(),
  },
  (table) => [
    uniqueIndex("ledger_events_hash_idx").on(table.eventHash),
    index("ledger_events_project_time_idx").on(table.projectId, table.createdAt),
    index("ledger_events_batch_time_idx").on(table.batchId, table.createdAt),
    index("ledger_events_tx_idx").on(table.transactionId),
  ],
);

export const benefitRecords = sqliteTable(
  "benefit_records",
  {
    id: text("id").primaryKey(),
    projectId: text("project_id").notNull(),
    recordType: text("record_type").notNull(),
    amount: real("amount").notNull(),
    currency: text("currency").notNull().default("INR"),
    beneficiary: text("beneficiary").notNull(),
    description: text("description").notNull(),
    recordedAt: text("recorded_at").notNull(),
    proofHash: text("proof_hash").notNull(),
  },
  (table) => [
    index("benefit_records_project_time_idx").on(table.projectId, table.recordedAt),
  ],
);
