CREATE TABLE `benefit_records` (
	`id` text PRIMARY KEY NOT NULL,
	`project_id` text NOT NULL,
	`record_type` text NOT NULL,
	`amount` real NOT NULL,
	`currency` text DEFAULT 'INR' NOT NULL,
	`beneficiary` text NOT NULL,
	`description` text NOT NULL,
	`recorded_at` text NOT NULL,
	`proof_hash` text NOT NULL
);
--> statement-breakpoint
CREATE INDEX `benefit_records_project_time_idx` ON `benefit_records` (`project_id`,`recorded_at`);