CREATE INDEX `evidence_files_item_idx` ON `evidence_files` (`evidence_id`);--> statement-breakpoint
CREATE UNIQUE INDEX `evidence_files_object_key_idx` ON `evidence_files` (`object_key`);--> statement-breakpoint
CREATE INDEX `evidence_items_project_time_idx` ON `evidence_items` (`project_id`,`observed_at`);--> statement-breakpoint
CREATE INDEX `evidence_reviews_item_time_idx` ON `evidence_reviews` (`evidence_id`,`created_at`);