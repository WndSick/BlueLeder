CREATE TABLE `documents` (
	`id` text PRIMARY KEY NOT NULL,
	`project_id` text NOT NULL,
	`category` text NOT NULL,
	`file_name` text NOT NULL,
	`object_key` text NOT NULL,
	`content_type` text NOT NULL,
	`size_bytes` integer NOT NULL,
	`uploaded_at` text NOT NULL
);
--> statement-breakpoint
CREATE TABLE `projects` (
	`id` text PRIMARY KEY NOT NULL,
	`owner_email` text NOT NULL,
	`name` text NOT NULL,
	`ecosystem` text NOT NULL,
	`state` text NOT NULL,
	`district` text NOT NULL,
	`village` text NOT NULL,
	`start_date` text NOT NULL,
	`duration_years` integer NOT NULL,
	`responsible_organization` text NOT NULL,
	`community_partner` text NOT NULL,
	`boundary_geojson` text NOT NULL,
	`area_hectares` real NOT NULL,
	`status` text DEFAULT 'submitted' NOT NULL,
	`reviewer_note` text,
	`submitted_at` text NOT NULL,
	`updated_at` text NOT NULL
);
--> statement-breakpoint
CREATE TABLE `review_events` (
	`id` text PRIMARY KEY NOT NULL,
	`project_id` text NOT NULL,
	`actor_email` text NOT NULL,
	`from_status` text,
	`to_status` text NOT NULL,
	`note` text,
	`created_at` text NOT NULL
);
--> statement-breakpoint
CREATE TABLE `users` (
	`email` text PRIMARY KEY NOT NULL,
	`full_name` text NOT NULL,
	`role` text NOT NULL,
	`organization` text,
	`registration_number` text,
	`organization_type` text,
	`website` text,
	`contact_phone` text,
	`verification_status` text DEFAULT 'unverified' NOT NULL,
	`created_at` text NOT NULL,
	`updated_at` text NOT NULL
);
