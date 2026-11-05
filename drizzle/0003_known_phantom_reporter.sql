CREATE TABLE `agency_files` (
	`id` text PRIMARY KEY NOT NULL,
	`tenant_id` text NOT NULL,
	`created_at` text NOT NULL,
	`customer_id` text,
	`expense_id` text,
	`kind` text NOT NULL,
	`object_key` text NOT NULL,
	`mime` text NOT NULL,
	`size` integer NOT NULL,
	`hash` text NOT NULL,
	`label` text NOT NULL,
	`verified_at` text,
	`verified_by` text,
	`revoked_at` text,
	FOREIGN KEY (`tenant_id`) REFERENCES `workspaces`(`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`tenant_id`,`customer_id`) REFERENCES `customers`(`tenant_id`,`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`tenant_id`,`expense_id`) REFERENCES `expenses`(`tenant_id`,`id`) ON UPDATE no action ON DELETE no action,
	CONSTRAINT "agency_file_size" CHECK("agency_files"."size">0 AND "agency_files"."size"<=5242880)
);
--> statement-breakpoint
CREATE UNIQUE INDEX `agency_files_tenant_id` ON `agency_files` (`tenant_id`,`id`);--> statement-breakpoint
CREATE INDEX `agency_files_customer` ON `agency_files` (`tenant_id`,`customer_id`);--> statement-breakpoint
CREATE TABLE `client_access` (
	`id` text PRIMARY KEY NOT NULL,
	`tenant_id` text NOT NULL,
	`created_at` text NOT NULL,
	`rental_id` text NOT NULL,
	`email` text NOT NULL,
	`name` text DEFAULT '' NOT NULL,
	`expires_at` text NOT NULL,
	`revoked_at` text,
	FOREIGN KEY (`tenant_id`,`rental_id`) REFERENCES `rentals`(`tenant_id`,`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE UNIQUE INDEX `client_access_current` ON `client_access` (`tenant_id`,`rental_id`,`email`) WHERE "client_access"."revoked_at" IS NULL;--> statement-breakpoint
CREATE INDEX `client_access_email` ON `client_access` (`email`);--> statement-breakpoint
CREATE TABLE `expense_payments` (
	`id` text PRIMARY KEY NOT NULL,
	`tenant_id` text NOT NULL,
	`created_at` text NOT NULL,
	`expense_id` text NOT NULL,
	`amount` integer NOT NULL,
	`method` text NOT NULL,
	`reference` text NOT NULL,
	`date` text NOT NULL,
	`note` text DEFAULT '' NOT NULL,
	FOREIGN KEY (`tenant_id`,`expense_id`) REFERENCES `expenses`(`tenant_id`,`id`) ON UPDATE no action ON DELETE no action,
	CONSTRAINT "expense_payment_positive" CHECK("expense_payments"."amount">0),
	CONSTRAINT "expense_payment_method" CHECK("expense_payments"."method" IN ('bank','card'))
);
--> statement-breakpoint
CREATE INDEX `expense_payments_expense` ON `expense_payments` (`tenant_id`,`expense_id`);--> statement-breakpoint
CREATE TABLE `obligations` (
	`id` text PRIMARY KEY NOT NULL,
	`tenant_id` text NOT NULL,
	`created_at` text NOT NULL,
	`vehicle_id` text NOT NULL,
	`title` text NOT NULL,
	`kind` text NOT NULL,
	`due_date` text DEFAULT '' NOT NULL,
	`due_km` integer,
	`reminder_days` integer DEFAULT 30 NOT NULL,
	`recurrence_months` integer DEFAULT 0 NOT NULL,
	`recurrence_km` integer DEFAULT 0 NOT NULL,
	`supplier_id` text,
	`estimated_cost` integer DEFAULT 0 NOT NULL,
	`notes` text DEFAULT '' NOT NULL,
	`status` text DEFAULT 'pending' NOT NULL,
	`completed_at` text,
	`completion_date` text,
	`completed_odometer` integer,
	`actual_cost` integer,
	`next_id` text,
	`version` integer DEFAULT 1 NOT NULL,
	FOREIGN KEY (`tenant_id`,`vehicle_id`) REFERENCES `vehicles`(`tenant_id`,`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`tenant_id`,`supplier_id`) REFERENCES `suppliers`(`tenant_id`,`id`) ON UPDATE no action ON DELETE no action,
	CONSTRAINT "obligation_due" CHECK("obligations"."due_date"<>'' OR "obligations"."due_km" IS NOT NULL),
	CONSTRAINT "obligation_nonnegative" CHECK("obligations"."estimated_cost">=0 AND ("obligations"."due_km" IS NULL OR "obligations"."due_km">=0) AND "obligations"."recurrence_months">=0 AND "obligations"."recurrence_km">=0)
);
--> statement-breakpoint
CREATE UNIQUE INDEX `obligations_tenant_id` ON `obligations` (`tenant_id`,`id`);--> statement-breakpoint
CREATE INDEX `obligations_due` ON `obligations` (`tenant_id`,`status`,`due_date`);--> statement-breakpoint
CREATE TABLE `quotes` (
	`id` text PRIMARY KEY NOT NULL,
	`tenant_id` text NOT NULL,
	`created_at` text NOT NULL,
	`rental_id` text NOT NULL,
	`customer_id` text NOT NULL,
	`number` text NOT NULL,
	`valid_until` text NOT NULL,
	`status` text DEFAULT 'issued' NOT NULL,
	`total` integer NOT NULL,
	`notes` text DEFAULT '' NOT NULL,
	`version` integer DEFAULT 1 NOT NULL,
	`decided_at` text,
	`snapshot` text NOT NULL,
	FOREIGN KEY (`tenant_id`,`rental_id`) REFERENCES `rentals`(`tenant_id`,`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`tenant_id`,`customer_id`) REFERENCES `customers`(`tenant_id`,`id`) ON UPDATE no action ON DELETE no action,
	CONSTRAINT "quote_nonnegative" CHECK("quotes"."total">=0)
);
--> statement-breakpoint
CREATE UNIQUE INDEX `quotes_tenant_id` ON `quotes` (`tenant_id`,`id`);--> statement-breakpoint
CREATE UNIQUE INDEX `quotes_number` ON `quotes` (`tenant_id`,`number`);--> statement-breakpoint
CREATE TABLE `suppliers` (
	`id` text PRIMARY KEY NOT NULL,
	`tenant_id` text NOT NULL,
	`created_at` text NOT NULL,
	`name` text NOT NULL,
	`contact` text DEFAULT '' NOT NULL,
	`email` text DEFAULT '' NOT NULL,
	`phone` text DEFAULT '' NOT NULL,
	`address` text DEFAULT '' NOT NULL,
	`tax_id` text DEFAULT '' NOT NULL,
	`category` text DEFAULT '' NOT NULL,
	`notes` text DEFAULT '' NOT NULL,
	`active` integer DEFAULT true NOT NULL,
	`version` integer DEFAULT 1 NOT NULL,
	FOREIGN KEY (`tenant_id`) REFERENCES `workspaces`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE UNIQUE INDEX `suppliers_tenant_id` ON `suppliers` (`tenant_id`,`id`);--> statement-breakpoint
CREATE INDEX `suppliers_name` ON `suppliers` (`tenant_id`,`name`);--> statement-breakpoint
DROP INDEX `members_user_id_unique`;--> statement-breakpoint
DROP INDEX `members_email_unique`;--> statement-breakpoint
CREATE UNIQUE INDEX `members_tenant_user` ON `members` (`tenant_id`,`user_id`);--> statement-breakpoint
CREATE UNIQUE INDEX `members_tenant_email` ON `members` (`tenant_id`,`email`);--> statement-breakpoint
DROP INDEX `workspaces_owner_id_unique`;--> statement-breakpoint
ALTER TABLE `expenses` ADD `supplier_id` text;--> statement-breakpoint
ALTER TABLE `expenses` ADD `reference` text DEFAULT '' NOT NULL;--> statement-breakpoint
ALTER TABLE `expenses` ADD `due_date` text DEFAULT '' NOT NULL;--> statement-breakpoint
ALTER TABLE `expenses` ADD `maintenance_id` text;--> statement-breakpoint
ALTER TABLE `expenses` ADD `obligation_id` text;--> statement-breakpoint
CREATE UNIQUE INDEX `expenses_tenant_id` ON `expenses` (`tenant_id`,`id`);--> statement-breakpoint
CREATE UNIQUE INDEX `expenses_maintenance` ON `expenses` (`tenant_id`,`maintenance_id`);--> statement-breakpoint
CREATE UNIQUE INDEX `expenses_obligation` ON `expenses` (`tenant_id`,`obligation_id`);--> statement-breakpoint
ALTER TABLE `inspections` ADD `inspection_data` text DEFAULT '' NOT NULL;--> statement-breakpoint
ALTER TABLE `vehicles` ADD `body_type` text DEFAULT 'hatchback' NOT NULL;--> statement-breakpoint
ALTER TABLE `vehicles` ADD `vin` text DEFAULT '' NOT NULL;