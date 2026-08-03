CREATE TABLE `credit_batches` (
	`id` text PRIMARY KEY NOT NULL,
	`project_id` text NOT NULL,
	`period_key` text NOT NULL,
	`vintage_year` integer NOT NULL,
	`report_hash` text,
	`issued_quantity` real NOT NULL,
	`current_holder` text NOT NULL,
	`status` text DEFAULT 'draft' NOT NULL,
	`created_by` text NOT NULL,
	`created_at` text NOT NULL,
	`updated_at` text NOT NULL
);
--> statement-breakpoint
CREATE UNIQUE INDEX `credit_batches_project_period_idx` ON `credit_batches` (`project_id`,`period_key`);--> statement-breakpoint
CREATE INDEX `credit_batches_project_status_idx` ON `credit_batches` (`project_id`,`status`);--> statement-breakpoint
CREATE TABLE `ledger_events` (
	`id` text PRIMARY KEY NOT NULL,
	`project_id` text NOT NULL,
	`batch_id` text,
	`event_type` text NOT NULL,
	`entity_id` text NOT NULL,
	`period_key` text,
	`payload_hash` text NOT NULL,
	`previous_event_hash` text,
	`event_hash` text NOT NULL,
	`network` text NOT NULL,
	`chain_id` integer NOT NULL,
	`transaction_id` text,
	`actor_email` text NOT NULL,
	`metadata_json` text NOT NULL,
	`created_at` text NOT NULL
);
--> statement-breakpoint
CREATE UNIQUE INDEX `ledger_events_hash_idx` ON `ledger_events` (`event_hash`);--> statement-breakpoint
CREATE INDEX `ledger_events_project_time_idx` ON `ledger_events` (`project_id`,`created_at`);--> statement-breakpoint
CREATE INDEX `ledger_events_batch_time_idx` ON `ledger_events` (`batch_id`,`created_at`);--> statement-breakpoint
CREATE INDEX `ledger_events_tx_idx` ON `ledger_events` (`transaction_id`);