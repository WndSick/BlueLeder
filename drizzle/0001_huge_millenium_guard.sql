CREATE TABLE `evidence_files` (
	`id` text PRIMARY KEY NOT NULL,
	`evidence_id` text NOT NULL,
	`project_id` text NOT NULL,
	`file_role` text NOT NULL,
	`file_name` text NOT NULL,
	`object_key` text NOT NULL,
	`content_type` text NOT NULL,
	`size_bytes` integer NOT NULL,
	`sha256` text NOT NULL,
	`uploaded_at` text NOT NULL
);
--> statement-breakpoint
CREATE TABLE `evidence_items` (
	`id` text PRIMARY KEY NOT NULL,
	`project_id` text NOT NULL,
	`source_type` text NOT NULL,
	`monitoring_stage` text NOT NULL,
	`period_label` text NOT NULL,
	`observed_at` text NOT NULL,
	`uploader_email` text NOT NULL,
	`data_json` text NOT NULL,
	`created_at` text NOT NULL
);
--> statement-breakpoint
CREATE TABLE `evidence_reviews` (
	`id` text PRIMARY KEY NOT NULL,
	`evidence_id` text NOT NULL,
	`project_id` text NOT NULL,
	`reviewer_email` text NOT NULL,
	`decision` text NOT NULL,
	`comment` text,
	`created_at` text NOT NULL
);
