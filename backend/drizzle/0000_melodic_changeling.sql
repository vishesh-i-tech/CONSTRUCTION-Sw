CREATE TABLE `client_payments` (
	`id` text PRIMARY KEY NOT NULL,
	`organization_id` text NOT NULL,
	`site_id` text NOT NULL,
	`amount` real NOT NULL,
	`payment_date` text NOT NULL,
	`payment_mode` text NOT NULL,
	`payer_name` text,
	`reference_no` text,
	`notes` text,
	`created_at` text DEFAULT (CURRENT_TIMESTAMP) NOT NULL,
	FOREIGN KEY (`organization_id`) REFERENCES `organizations`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`site_id`) REFERENCES `sites`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE INDEX `client_payments_org_idx` ON `client_payments` (`organization_id`);--> statement-breakpoint
CREATE INDEX `client_payments_site_idx` ON `client_payments` (`site_id`);--> statement-breakpoint
CREATE TABLE `daily_records` (
	`id` text PRIMARY KEY NOT NULL,
	`client_id` text NOT NULL,
	`organization_id` text NOT NULL,
	`site_id` text NOT NULL,
	`submitted_by` text NOT NULL,
	`record_date` text NOT NULL,
	`status` text NOT NULL,
	`captured_at` text NOT NULL,
	`received_at` text DEFAULT (CURRENT_TIMESTAMP) NOT NULL,
	`flags` text DEFAULT '{}' NOT NULL,
	`missing_photo` integer DEFAULT false NOT NULL,
	`missing_voice` integer DEFAULT false NOT NULL,
	`created_at` text DEFAULT (CURRENT_TIMESTAMP) NOT NULL,
	`updated_at` text DEFAULT (CURRENT_TIMESTAMP) NOT NULL,
	FOREIGN KEY (`organization_id`) REFERENCES `organizations`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`site_id`) REFERENCES `sites`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`submitted_by`) REFERENCES `users`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE UNIQUE INDEX `daily_records_client_id_unique` ON `daily_records` (`client_id`);--> statement-breakpoint
CREATE UNIQUE INDEX `unique_site_record_date` ON `daily_records` (`site_id`,`record_date`);--> statement-breakpoint
CREATE INDEX `records_org_date_idx` ON `daily_records` (`organization_id`,`record_date`);--> statement-breakpoint
CREATE INDEX `records_site_idx` ON `daily_records` (`site_id`);--> statement-breakpoint
CREATE TABLE `expense_dues` (
	`id` text PRIMARY KEY NOT NULL,
	`organization_id` text NOT NULL,
	`site_id` text NOT NULL,
	`vendor_id` text,
	`material_id` text,
	`title` text NOT NULL,
	`category` text NOT NULL,
	`amount_due` real DEFAULT 0 NOT NULL,
	`amount_paid` real DEFAULT 0 NOT NULL,
	`due_date` text NOT NULL,
	`status` text DEFAULT 'pending' NOT NULL,
	`notes` text,
	`created_at` text DEFAULT (CURRENT_TIMESTAMP) NOT NULL,
	FOREIGN KEY (`organization_id`) REFERENCES `organizations`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`site_id`) REFERENCES `sites`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`vendor_id`) REFERENCES `vendors`(`id`) ON UPDATE no action ON DELETE set null,
	FOREIGN KEY (`material_id`) REFERENCES `materials`(`id`) ON UPDATE no action ON DELETE set null
);
--> statement-breakpoint
CREATE INDEX `expense_dues_org_idx` ON `expense_dues` (`organization_id`);--> statement-breakpoint
CREATE INDEX `expense_dues_site_idx` ON `expense_dues` (`site_id`);--> statement-breakpoint
CREATE INDEX `expense_dues_vendor_idx` ON `expense_dues` (`vendor_id`);--> statement-breakpoint
CREATE TABLE `issue_types` (
	`id` text PRIMARY KEY NOT NULL,
	`organization_id` text NOT NULL,
	`label_hi` text NOT NULL,
	`label_en` text NOT NULL,
	`icon` text,
	`sort_order` integer DEFAULT 0 NOT NULL,
	`is_active` integer DEFAULT true NOT NULL,
	`is_default` integer DEFAULT false NOT NULL,
	`created_at` text DEFAULT (CURRENT_TIMESTAMP) NOT NULL,
	`updated_at` text DEFAULT (CURRENT_TIMESTAMP) NOT NULL,
	FOREIGN KEY (`organization_id`) REFERENCES `organizations`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE INDEX `issue_types_org_idx` ON `issue_types` (`organization_id`);--> statement-breakpoint
CREATE INDEX `issue_types_sort_idx` ON `issue_types` (`organization_id`,`sort_order`);--> statement-breakpoint
CREATE TABLE `labour_entries` (
	`id` text PRIMARY KEY NOT NULL,
	`labour_record_id` text NOT NULL,
	`worker_id` text,
	`worker_name` text NOT NULL,
	`role` text NOT NULL,
	`attendance_status` text NOT NULL,
	`daily_wage` real DEFAULT 0 NOT NULL,
	`paid_amount` real DEFAULT 0 NOT NULL,
	`balance_due` real DEFAULT 0 NOT NULL,
	`payment_status` text DEFAULT 'pending' NOT NULL,
	`created_at` text DEFAULT (CURRENT_TIMESTAMP) NOT NULL,
	FOREIGN KEY (`labour_record_id`) REFERENCES `labour_records`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`worker_id`) REFERENCES `workers`(`id`) ON UPDATE no action ON DELETE set null
);
--> statement-breakpoint
CREATE INDEX `labour_entries_record_idx` ON `labour_entries` (`labour_record_id`);--> statement-breakpoint
CREATE INDEX `labour_entries_worker_idx` ON `labour_entries` (`worker_id`);--> statement-breakpoint
CREATE TABLE `labour_records` (
	`id` text PRIMARY KEY NOT NULL,
	`organization_id` text NOT NULL,
	`site_id` text NOT NULL,
	`submitted_by` text,
	`record_date` text NOT NULL,
	`total_workers` integer DEFAULT 0 NOT NULL,
	`total_daily_wage` real DEFAULT 0 NOT NULL,
	`total_paid` real DEFAULT 0 NOT NULL,
	`raw_photo_url` text,
	`ocr_raw_text` text,
	`voice_note_url` text,
	`notes` text,
	`created_at` text DEFAULT (CURRENT_TIMESTAMP) NOT NULL,
	`updated_at` text DEFAULT (CURRENT_TIMESTAMP) NOT NULL,
	FOREIGN KEY (`organization_id`) REFERENCES `organizations`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`site_id`) REFERENCES `sites`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`submitted_by`) REFERENCES `users`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE INDEX `labour_records_org_idx` ON `labour_records` (`organization_id`);--> statement-breakpoint
CREATE INDEX `labour_records_site_idx` ON `labour_records` (`site_id`);--> statement-breakpoint
CREATE INDEX `labour_records_date_idx` ON `labour_records` (`organization_id`,`record_date`);--> statement-breakpoint
CREATE TABLE `machinery` (
	`id` text PRIMARY KEY NOT NULL,
	`organization_id` text NOT NULL,
	`site_id` text NOT NULL,
	`machine_type` text NOT NULL,
	`fuel_litres` real DEFAULT 0 NOT NULL,
	`fuel_cost` real DEFAULT 0 NOT NULL,
	`rental_hours_or_days` real DEFAULT 0 NOT NULL,
	`rental_cost` real DEFAULT 0 NOT NULL,
	`total_cost` real DEFAULT 0 NOT NULL,
	`log_date` text NOT NULL,
	`notes` text,
	`created_at` text DEFAULT (CURRENT_TIMESTAMP) NOT NULL,
	FOREIGN KEY (`organization_id`) REFERENCES `organizations`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`site_id`) REFERENCES `sites`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE INDEX `machinery_org_idx` ON `machinery` (`organization_id`);--> statement-breakpoint
CREATE INDEX `machinery_site_idx` ON `machinery` (`site_id`);--> statement-breakpoint
CREATE TABLE `material_requests` (
	`id` text PRIMARY KEY NOT NULL,
	`organization_id` text NOT NULL,
	`site_id` text NOT NULL,
	`requested_by` text NOT NULL,
	`items_json` text NOT NULL,
	`urgency` text DEFAULT 'normal' NOT NULL,
	`status` text DEFAULT 'pending' NOT NULL,
	`notes` text,
	`created_at` text DEFAULT (CURRENT_TIMESTAMP) NOT NULL,
	FOREIGN KEY (`organization_id`) REFERENCES `organizations`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`site_id`) REFERENCES `sites`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`requested_by`) REFERENCES `users`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE INDEX `material_requests_org_idx` ON `material_requests` (`organization_id`);--> statement-breakpoint
CREATE INDEX `material_requests_site_idx` ON `material_requests` (`site_id`);--> statement-breakpoint
CREATE TABLE `materials` (
	`id` text PRIMARY KEY NOT NULL,
	`organization_id` text NOT NULL,
	`site_id` text NOT NULL,
	`vendor_id` text,
	`item_name` text NOT NULL,
	`quantity` real DEFAULT 0 NOT NULL,
	`unit` text NOT NULL,
	`unit_price` real DEFAULT 0 NOT NULL,
	`total_cost` real DEFAULT 0 NOT NULL,
	`purchase_date` text NOT NULL,
	`payment_status` text DEFAULT 'pending' NOT NULL,
	`paid_amount` real DEFAULT 0 NOT NULL,
	`receipt_photo` text,
	`notes` text,
	`created_at` text DEFAULT (CURRENT_TIMESTAMP) NOT NULL,
	FOREIGN KEY (`organization_id`) REFERENCES `organizations`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`site_id`) REFERENCES `sites`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`vendor_id`) REFERENCES `vendors`(`id`) ON UPDATE no action ON DELETE set null
);
--> statement-breakpoint
CREATE INDEX `materials_org_idx` ON `materials` (`organization_id`);--> statement-breakpoint
CREATE INDEX `materials_site_idx` ON `materials` (`site_id`);--> statement-breakpoint
CREATE INDEX `materials_vendor_idx` ON `materials` (`vendor_id`);--> statement-breakpoint
CREATE TABLE `media` (
	`id` text PRIMARY KEY NOT NULL,
	`record_id` text NOT NULL,
	`kind` text NOT NULL,
	`storage_key` text NOT NULL,
	`mime_type` text NOT NULL,
	`size_bytes` integer NOT NULL,
	`duration_seconds` integer,
	`latitude` real,
	`longitude` real,
	`accuracy_m` real,
	`captured_at` text NOT NULL,
	`flags` text DEFAULT '{}' NOT NULL,
	`created_at` text DEFAULT (CURRENT_TIMESTAMP) NOT NULL,
	FOREIGN KEY (`record_id`) REFERENCES `daily_records`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE INDEX `media_record_idx` ON `media` (`record_id`);--> statement-breakpoint
CREATE TABLE `notification_log` (
	`id` text PRIMARY KEY NOT NULL,
	`user_id` text NOT NULL,
	`type` text NOT NULL,
	`sent_at` text DEFAULT (CURRENT_TIMESTAMP) NOT NULL,
	`status` text NOT NULL,
	FOREIGN KEY (`user_id`) REFERENCES `users`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE INDEX `notifications_user_idx` ON `notification_log` (`user_id`);--> statement-breakpoint
CREATE TABLE `organizations` (
	`id` text PRIMARY KEY NOT NULL,
	`name` text NOT NULL,
	`created_at` text DEFAULT (CURRENT_TIMESTAMP) NOT NULL,
	`updated_at` text DEFAULT (CURRENT_TIMESTAMP) NOT NULL
);
--> statement-breakpoint
CREATE TABLE `record_acknowledgements` (
	`id` text PRIMARY KEY NOT NULL,
	`record_id` text NOT NULL,
	`owner_id` text NOT NULL,
	`seen_at` text DEFAULT (CURRENT_TIMESTAMP) NOT NULL,
	`reply_media_id` text,
	FOREIGN KEY (`record_id`) REFERENCES `daily_records`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`owner_id`) REFERENCES `users`(`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`reply_media_id`) REFERENCES `media`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE INDEX `acknowledgements_record_idx` ON `record_acknowledgements` (`record_id`);--> statement-breakpoint
CREATE TABLE `record_edits` (
	`id` text PRIMARY KEY NOT NULL,
	`record_id` text NOT NULL,
	`edited_by` text NOT NULL,
	`change_json` text NOT NULL,
	`edited_at` text DEFAULT (CURRENT_TIMESTAMP) NOT NULL,
	FOREIGN KEY (`record_id`) REFERENCES `daily_records`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`edited_by`) REFERENCES `users`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE INDEX `record_edits_record_idx` ON `record_edits` (`record_id`);--> statement-breakpoint
CREATE TABLE `record_issues` (
	`id` text PRIMARY KEY NOT NULL,
	`record_id` text NOT NULL,
	`issue_type_id` text NOT NULL,
	`created_at` text DEFAULT (CURRENT_TIMESTAMP) NOT NULL,
	FOREIGN KEY (`record_id`) REFERENCES `daily_records`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`issue_type_id`) REFERENCES `issue_types`(`id`) ON UPDATE no action ON DELETE restrict
);
--> statement-breakpoint
CREATE INDEX `record_issues_record_idx` ON `record_issues` (`record_id`);--> statement-breakpoint
CREATE INDEX `record_issues_type_idx` ON `record_issues` (`issue_type_id`);--> statement-breakpoint
CREATE TABLE `site_assignments` (
	`id` text PRIMARY KEY NOT NULL,
	`site_id` text NOT NULL,
	`user_id` text NOT NULL,
	`created_at` text DEFAULT (CURRENT_TIMESTAMP) NOT NULL,
	FOREIGN KEY (`site_id`) REFERENCES `sites`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`user_id`) REFERENCES `users`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE UNIQUE INDEX `unique_site_user` ON `site_assignments` (`site_id`,`user_id`);--> statement-breakpoint
CREATE INDEX `site_assignments_user_idx` ON `site_assignments` (`user_id`);--> statement-breakpoint
CREATE TABLE `site_tasks` (
	`id` text PRIMARY KEY NOT NULL,
	`organization_id` text NOT NULL,
	`site_id` text NOT NULL,
	`title` text NOT NULL,
	`description` text,
	`assigned_to` text,
	`priority` text DEFAULT 'medium' NOT NULL,
	`status` text DEFAULT 'todo' NOT NULL,
	`due_date` text,
	`created_at` text DEFAULT (CURRENT_TIMESTAMP) NOT NULL,
	FOREIGN KEY (`organization_id`) REFERENCES `organizations`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`site_id`) REFERENCES `sites`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`assigned_to`) REFERENCES `users`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE INDEX `site_tasks_org_idx` ON `site_tasks` (`organization_id`);--> statement-breakpoint
CREATE INDEX `site_tasks_site_idx` ON `site_tasks` (`site_id`);--> statement-breakpoint
CREATE TABLE `sites` (
	`id` text PRIMARY KEY NOT NULL,
	`organization_id` text NOT NULL,
	`name` text NOT NULL,
	`location_text` text NOT NULL,
	`latitude` real,
	`longitude` real,
	`site_type` text,
	`estimated_budget` real,
	`work_status` text DEFAULT 'ongoing' NOT NULL,
	`payment_status` text DEFAULT 'unpaid' NOT NULL,
	`client_name` text,
	`client_phone` text,
	`start_date` text,
	`expected_end_date` text,
	`completed_date` text,
	`notes` text,
	`cover_photo` text,
	`is_archived` integer DEFAULT false NOT NULL,
	`created_at` text DEFAULT (CURRENT_TIMESTAMP) NOT NULL,
	`updated_at` text DEFAULT (CURRENT_TIMESTAMP) NOT NULL,
	FOREIGN KEY (`organization_id`) REFERENCES `organizations`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE INDEX `sites_org_idx` ON `sites` (`organization_id`);--> statement-breakpoint
CREATE TABLE `summaries` (
	`id` text PRIMARY KEY NOT NULL,
	`record_id` text NOT NULL,
	`summary_text` text NOT NULL,
	`material_mentions` text DEFAULT '[]' NOT NULL,
	`model_info` text NOT NULL,
	`status` text NOT NULL,
	`created_at` text DEFAULT (CURRENT_TIMESTAMP) NOT NULL,
	FOREIGN KEY (`record_id`) REFERENCES `daily_records`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE INDEX `summaries_record_idx` ON `summaries` (`record_id`);--> statement-breakpoint
CREATE TABLE `tools` (
	`id` text PRIMARY KEY NOT NULL,
	`organization_id` text NOT NULL,
	`site_id` text NOT NULL,
	`name` text NOT NULL,
	`quantity` integer DEFAULT 1 NOT NULL,
	`size` text,
	`date_sent` text NOT NULL,
	`expected_return_date` text NOT NULL,
	`actual_return_date` text,
	`source_type` text DEFAULT 'self_owned' NOT NULL,
	`purchase_price` real DEFAULT 0 NOT NULL,
	`rent_or_repair_cost` real DEFAULT 0 NOT NULL,
	`status` text DEFAULT 'on_site' NOT NULL,
	`notes` text,
	`photo_url` text,
	`created_at` text DEFAULT (CURRENT_TIMESTAMP) NOT NULL,
	FOREIGN KEY (`organization_id`) REFERENCES `organizations`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`site_id`) REFERENCES `sites`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE INDEX `tools_org_idx` ON `tools` (`organization_id`);--> statement-breakpoint
CREATE INDEX `tools_site_idx` ON `tools` (`site_id`);--> statement-breakpoint
CREATE TABLE `transcripts` (
	`id` text PRIMARY KEY NOT NULL,
	`record_id` text NOT NULL,
	`audio_media_id` text NOT NULL,
	`language` text DEFAULT 'hi' NOT NULL,
	`raw_text` text NOT NULL,
	`status` text NOT NULL,
	`provider` text NOT NULL,
	`error` text,
	`created_at` text DEFAULT (CURRENT_TIMESTAMP) NOT NULL,
	`updated_at` text DEFAULT (CURRENT_TIMESTAMP) NOT NULL,
	FOREIGN KEY (`record_id`) REFERENCES `daily_records`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`audio_media_id`) REFERENCES `media`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE INDEX `transcripts_record_idx` ON `transcripts` (`record_id`);--> statement-breakpoint
CREATE TABLE `users` (
	`id` text PRIMARY KEY NOT NULL,
	`organization_id` text NOT NULL,
	`role` text NOT NULL,
	`name` text NOT NULL,
	`phone` text NOT NULL,
	`email` text,
	`password_hash` text,
	`pin_hash` text,
	`is_active` integer DEFAULT true NOT NULL,
	`language` text DEFAULT 'hi' NOT NULL,
	`push_token` text,
	`last_login_at` text,
	`created_at` text DEFAULT (CURRENT_TIMESTAMP) NOT NULL,
	`updated_at` text DEFAULT (CURRENT_TIMESTAMP) NOT NULL,
	FOREIGN KEY (`organization_id`) REFERENCES `organizations`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE UNIQUE INDEX `users_phone_unique` ON `users` (`phone`);--> statement-breakpoint
CREATE INDEX `users_org_idx` ON `users` (`organization_id`);--> statement-breakpoint
CREATE INDEX `users_phone_idx` ON `users` (`phone`);--> statement-breakpoint
CREATE TABLE `vendors` (
	`id` text PRIMARY KEY NOT NULL,
	`organization_id` text NOT NULL,
	`name` text NOT NULL,
	`phone` text NOT NULL,
	`trade_specialty` text,
	`materials_supplied` text DEFAULT '[]' NOT NULL,
	`total_udhaar_balance` real DEFAULT 0 NOT NULL,
	`created_at` text DEFAULT (CURRENT_TIMESTAMP) NOT NULL,
	`updated_at` text DEFAULT (CURRENT_TIMESTAMP) NOT NULL,
	FOREIGN KEY (`organization_id`) REFERENCES `organizations`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE INDEX `vendors_org_idx` ON `vendors` (`organization_id`);--> statement-breakpoint
CREATE TABLE `workers` (
	`id` text PRIMARY KEY NOT NULL,
	`organization_id` text NOT NULL,
	`name` text NOT NULL,
	`phone` text,
	`role` text NOT NULL,
	`daily_wage` real DEFAULT 0 NOT NULL,
	`skill_type` text,
	`is_active` integer DEFAULT true NOT NULL,
	`created_at` text DEFAULT (CURRENT_TIMESTAMP) NOT NULL,
	`updated_at` text DEFAULT (CURRENT_TIMESTAMP) NOT NULL,
	FOREIGN KEY (`organization_id`) REFERENCES `organizations`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE INDEX `workers_org_idx` ON `workers` (`organization_id`);