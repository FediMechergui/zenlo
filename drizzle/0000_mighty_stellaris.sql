CREATE TABLE `assignments` (
	`id` text PRIMARY KEY NOT NULL,
	`tenant_id` text NOT NULL,
	`created_at` text NOT NULL,
	`rental_id` text NOT NULL,
	`vehicle_id` text NOT NULL,
	`start_at` text NOT NULL,
	`end_at` text,
	`start_odometer` integer NOT NULL,
	`end_odometer` integer,
	`reason` text NOT NULL,
	FOREIGN KEY (`tenant_id`,`rental_id`) REFERENCES `rentals`(`tenant_id`,`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`tenant_id`,`vehicle_id`) REFERENCES `vehicles`(`tenant_id`,`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE INDEX `assignments_rental` ON `assignments` (`tenant_id`,`rental_id`);--> statement-breakpoint
CREATE TABLE `attachments` (
	`id` text PRIMARY KEY NOT NULL,
	`tenant_id` text NOT NULL,
	`created_at` text NOT NULL,
	`rental_id` text NOT NULL,
	`inspection_id` text,
	`object_key` text NOT NULL,
	`mime` text NOT NULL,
	`size` integer NOT NULL,
	`hash` text NOT NULL,
	`label` text NOT NULL,
	FOREIGN KEY (`tenant_id`,`rental_id`) REFERENCES `rentals`(`tenant_id`,`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE UNIQUE INDEX `attachment_hash` ON `attachments` (`tenant_id`,`rental_id`,`hash`);--> statement-breakpoint
CREATE TABLE `audit` (
	`id` text PRIMARY KEY NOT NULL,
	`tenant_id` text NOT NULL,
	`created_at` text NOT NULL,
	`actor` text NOT NULL,
	`action` text NOT NULL,
	`entity_type` text NOT NULL,
	`entity_id` text NOT NULL,
	`detail` text NOT NULL,
	FOREIGN KEY (`tenant_id`) REFERENCES `workspaces`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE INDEX `audit_tenant_time` ON `audit` (`tenant_id`,`created_at`);--> statement-breakpoint
CREATE TABLE `cash_sessions` (
	`id` text PRIMARY KEY NOT NULL,
	`tenant_id` text NOT NULL,
	`created_at` text NOT NULL,
	`opened_at` text NOT NULL,
	`closed_at` text,
	`opening_amount` integer NOT NULL,
	`expected_amount` integer,
	`counted_amount` integer,
	`note` text NOT NULL,
	FOREIGN KEY (`tenant_id`) REFERENCES `workspaces`(`id`) ON UPDATE no action ON DELETE no action,
	CONSTRAINT "cash_nonnegative" CHECK("cash_sessions"."opening_amount">=0 AND ("cash_sessions"."counted_amount" IS NULL OR "cash_sessions"."counted_amount">=0))
);
--> statement-breakpoint
CREATE UNIQUE INDEX `cash_tenant_id` ON `cash_sessions` (`tenant_id`,`id`);--> statement-breakpoint
CREATE UNIQUE INDEX `cash_one_open` ON `cash_sessions` (`tenant_id`) WHERE "cash_sessions"."closed_at" IS NULL;--> statement-breakpoint
CREATE TABLE `credit_notes` (
	`id` text PRIMARY KEY NOT NULL,
	`tenant_id` text NOT NULL,
	`created_at` text NOT NULL,
	`invoice_id` text NOT NULL,
	`number` text NOT NULL,
	`amount` integer NOT NULL,
	`reason` text NOT NULL,
	`snapshot` text NOT NULL,
	FOREIGN KEY (`tenant_id`,`invoice_id`) REFERENCES `invoices`(`tenant_id`,`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE UNIQUE INDEX `credit_invoice` ON `credit_notes` (`tenant_id`,`invoice_id`);--> statement-breakpoint
CREATE UNIQUE INDEX `credit_number` ON `credit_notes` (`tenant_id`,`number`);--> statement-breakpoint
CREATE TABLE `customers` (
	`id` text PRIMARY KEY NOT NULL,
	`tenant_id` text NOT NULL,
	`created_at` text NOT NULL,
	`type` text NOT NULL,
	`name` text NOT NULL,
	`email` text NOT NULL,
	`phone` text NOT NULL,
	`country` text NOT NULL,
	`license_number` text NOT NULL,
	`license_until` text NOT NULL,
	`tax_id` text NOT NULL,
	`notes` text NOT NULL,
	FOREIGN KEY (`tenant_id`) REFERENCES `workspaces`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE UNIQUE INDEX `customers_tenant_id` ON `customers` (`tenant_id`,`id`);--> statement-breakpoint
CREATE INDEX `customers_name` ON `customers` (`tenant_id`,`name`);--> statement-breakpoint
CREATE TABLE `document_snapshots` (
	`id` text PRIMARY KEY NOT NULL,
	`tenant_id` text NOT NULL,
	`created_at` text NOT NULL,
	`rental_id` text NOT NULL,
	`kind` text NOT NULL,
	`version` integer NOT NULL,
	`data` text NOT NULL,
	`hash` text NOT NULL,
	FOREIGN KEY (`tenant_id`,`rental_id`) REFERENCES `rentals`(`tenant_id`,`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE UNIQUE INDEX `document_version` ON `document_snapshots` (`tenant_id`,`rental_id`,`kind`,`version`);--> statement-breakpoint
CREATE TABLE `expenses` (
	`id` text PRIMARY KEY NOT NULL,
	`tenant_id` text NOT NULL,
	`created_at` text NOT NULL,
	`vehicle_id` text,
	`category` text NOT NULL,
	`supplier` text NOT NULL,
	`amount` integer NOT NULL,
	`date` text NOT NULL,
	`note` text NOT NULL,
	FOREIGN KEY (`tenant_id`,`vehicle_id`) REFERENCES `vehicles`(`tenant_id`,`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`tenant_id`) REFERENCES `workspaces`(`id`) ON UPDATE no action ON DELETE no action,
	CONSTRAINT "expense_positive" CHECK("expenses"."amount">0)
);
--> statement-breakpoint
CREATE TABLE `idempotency` (
	`id` text PRIMARY KEY NOT NULL,
	`tenant_id` text NOT NULL,
	`actor_id` text NOT NULL,
	`key` text NOT NULL,
	`request_hash` text NOT NULL,
	`response` text NOT NULL,
	`created_at` text NOT NULL
);
--> statement-breakpoint
CREATE UNIQUE INDEX `idempotency_key` ON `idempotency` (`tenant_id`,`actor_id`,`key`);--> statement-breakpoint
CREATE TABLE `inspections` (
	`id` text PRIMARY KEY NOT NULL,
	`tenant_id` text NOT NULL,
	`created_at` text NOT NULL,
	`rental_id` text NOT NULL,
	`vehicle_id` text NOT NULL,
	`type` text NOT NULL,
	`odometer` integer NOT NULL,
	`fuel_percent` integer NOT NULL,
	`condition` text NOT NULL,
	`damages` text NOT NULL,
	`customer_accepted` integer NOT NULL,
	FOREIGN KEY (`tenant_id`,`rental_id`) REFERENCES `rentals`(`tenant_id`,`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`tenant_id`,`vehicle_id`) REFERENCES `vehicles`(`tenant_id`,`id`) ON UPDATE no action ON DELETE no action,
	CONSTRAINT "inspection_values" CHECK("inspections"."odometer">=0 AND "inspections"."fuel_percent" BETWEEN 0 AND 100)
);
--> statement-breakpoint
CREATE TABLE `invoices` (
	`id` text PRIMARY KEY NOT NULL,
	`tenant_id` text NOT NULL,
	`created_at` text NOT NULL,
	`number` text NOT NULL,
	`rental_id` text NOT NULL,
	`customer_id` text NOT NULL,
	`status` text NOT NULL,
	`subtotal` integer NOT NULL,
	`tax` integer NOT NULL,
	`stamp` integer NOT NULL,
	`daily_levy` integer NOT NULL,
	`total` integer NOT NULL,
	`tax_rate_bps` integer NOT NULL,
	`external_status` text NOT NULL,
	`issued_at` text,
	`snapshot` text NOT NULL,
	FOREIGN KEY (`tenant_id`,`rental_id`) REFERENCES `rentals`(`tenant_id`,`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`tenant_id`,`customer_id`) REFERENCES `customers`(`tenant_id`,`id`) ON UPDATE no action ON DELETE no action,
	CONSTRAINT "invoice_values" CHECK("invoices"."total">=0 AND "invoices"."subtotal">=0 AND "invoices"."tax">=0 AND "invoices"."stamp">=0)
);
--> statement-breakpoint
CREATE UNIQUE INDEX `invoices_tenant_id` ON `invoices` (`tenant_id`,`id`);--> statement-breakpoint
CREATE UNIQUE INDEX `invoices_number` ON `invoices` (`tenant_id`,`number`);--> statement-breakpoint
CREATE UNIQUE INDEX `invoices_current_rental` ON `invoices` (`tenant_id`,`rental_id`) WHERE "invoices"."status"<>'credited';--> statement-breakpoint
CREATE TABLE `maintenance` (
	`id` text PRIMARY KEY NOT NULL,
	`tenant_id` text NOT NULL,
	`created_at` text NOT NULL,
	`vehicle_id` text NOT NULL,
	`title` text NOT NULL,
	`start_at` text NOT NULL,
	`end_at` text NOT NULL,
	`status` text NOT NULL,
	`cost` integer NOT NULL,
	`supplier` text NOT NULL,
	`odometer` integer NOT NULL,
	`notes` text NOT NULL,
	FOREIGN KEY (`tenant_id`,`vehicle_id`) REFERENCES `vehicles`(`tenant_id`,`id`) ON UPDATE no action ON DELETE no action,
	CONSTRAINT "maintenance_values" CHECK("maintenance"."end_at">"maintenance"."start_at" AND "maintenance"."cost">=0 AND "maintenance"."odometer">=0)
);
--> statement-breakpoint
CREATE UNIQUE INDEX `maintenance_tenant_id` ON `maintenance` (`tenant_id`,`id`);--> statement-breakpoint
CREATE TABLE `members` (
	`id` text PRIMARY KEY NOT NULL,
	`tenant_id` text NOT NULL,
	`created_at` text NOT NULL,
	`user_id` text,
	`email` text NOT NULL,
	`name` text NOT NULL,
	`role` text NOT NULL,
	FOREIGN KEY (`tenant_id`) REFERENCES `workspaces`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE UNIQUE INDEX `members_user_id_unique` ON `members` (`user_id`);--> statement-breakpoint
CREATE UNIQUE INDEX `members_email_unique` ON `members` (`email`);--> statement-breakpoint
CREATE INDEX `members_tenant` ON `members` (`tenant_id`);--> statement-breakpoint
CREATE TABLE `operation_guards` (
	`id` text PRIMARY KEY NOT NULL,
	`ok` integer NOT NULL,
	CONSTRAINT "operation_precondition" CHECK("operation_guards"."ok"=1)
);
--> statement-breakpoint
CREATE TABLE `payments` (
	`id` text PRIMARY KEY NOT NULL,
	`tenant_id` text NOT NULL,
	`created_at` text NOT NULL,
	`rental_id` text NOT NULL,
	`invoice_id` text,
	`kind` text NOT NULL,
	`method` text NOT NULL,
	`amount` integer NOT NULL,
	`reference` text NOT NULL,
	`note` text NOT NULL,
	`cash_session_id` text,
	FOREIGN KEY (`tenant_id`,`rental_id`) REFERENCES `rentals`(`tenant_id`,`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`tenant_id`,`invoice_id`) REFERENCES `invoices`(`tenant_id`,`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`tenant_id`,`cash_session_id`) REFERENCES `cash_sessions`(`tenant_id`,`id`) ON UPDATE no action ON DELETE no action,
	CONSTRAINT "payment_positive" CHECK("payments"."amount">0)
);
--> statement-breakpoint
CREATE INDEX `payments_rental` ON `payments` (`tenant_id`,`rental_id`);--> statement-breakpoint
CREATE TABLE `rentals` (
	`id` text PRIMARY KEY NOT NULL,
	`tenant_id` text NOT NULL,
	`created_at` text NOT NULL,
	`number` text NOT NULL,
	`customer_id` text NOT NULL,
	`vehicle_id` text NOT NULL,
	`start_at` text NOT NULL,
	`end_at` text NOT NULL,
	`actual_start_at` text,
	`actual_end_at` text,
	`status` text NOT NULL,
	`daily_rate` integer NOT NULL,
	`days` integer NOT NULL,
	`discount` integer NOT NULL,
	`extras` integer NOT NULL,
	`total` integer NOT NULL,
	`subtotal` integer NOT NULL,
	`tax` integer NOT NULL,
	`stamp` integer NOT NULL,
	`daily_levy` integer NOT NULL,
	`daily_levy_rate` integer NOT NULL,
	`daily_levy_taxable` integer NOT NULL,
	`tax_rate_bps` integer NOT NULL,
	`deposit_required` integer NOT NULL,
	`included_km` integer NOT NULL,
	`extra_km_rate` integer NOT NULL,
	`source` text NOT NULL,
	`pickup_location` text NOT NULL,
	`return_location` text NOT NULL,
	`notes` text NOT NULL,
	`terms_version` text NOT NULL,
	`terms_snapshot` text NOT NULL,
	`pricing_snapshot` text NOT NULL,
	`version` integer DEFAULT 1 NOT NULL,
	FOREIGN KEY (`tenant_id`,`customer_id`) REFERENCES `customers`(`tenant_id`,`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`tenant_id`,`vehicle_id`) REFERENCES `vehicles`(`tenant_id`,`id`) ON UPDATE no action ON DELETE no action,
	CONSTRAINT "rental_duration" CHECK("rentals"."end_at">"rentals"."start_at"),
	CONSTRAINT "rental_money" CHECK("rentals"."total">=0 AND "rentals"."daily_rate">=0 AND "rentals"."discount">=0 AND "rentals"."extras">=0 AND "rentals"."deposit_required">=0 AND "rentals"."extra_km_rate">=0)
);
--> statement-breakpoint
CREATE UNIQUE INDEX `rentals_tenant_id` ON `rentals` (`tenant_id`,`id`);--> statement-breakpoint
CREATE UNIQUE INDEX `rentals_number` ON `rentals` (`tenant_id`,`number`);--> statement-breakpoint
CREATE INDEX `rentals_dates` ON `rentals` (`tenant_id`,`start_at`,`end_at`);--> statement-breakpoint
CREATE TABLE `sequences` (
	`id` text PRIMARY KEY NOT NULL,
	`tenant_id` text NOT NULL,
	`kind` text NOT NULL,
	`value` integer NOT NULL
);
--> statement-breakpoint
CREATE UNIQUE INDEX `sequence_kind` ON `sequences` (`tenant_id`,`kind`);--> statement-breakpoint
CREATE TABLE `vehicle_blocks` (
	`id` text PRIMARY KEY NOT NULL,
	`tenant_id` text NOT NULL,
	`vehicle_id` text NOT NULL,
	`rental_id` text,
	`maintenance_id` text,
	`kind` text NOT NULL,
	`start_ms` integer NOT NULL,
	`end_ms` integer NOT NULL,
	FOREIGN KEY (`tenant_id`,`vehicle_id`) REFERENCES `vehicles`(`tenant_id`,`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`tenant_id`,`rental_id`) REFERENCES `rentals`(`tenant_id`,`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`tenant_id`,`maintenance_id`) REFERENCES `maintenance`(`tenant_id`,`id`) ON UPDATE no action ON DELETE no action,
	CONSTRAINT "block_interval" CHECK("vehicle_blocks"."end_ms">"vehicle_blocks"."start_ms")
);
--> statement-breakpoint
CREATE INDEX `blocks_overlap` ON `vehicle_blocks` (`tenant_id`,`vehicle_id`,`start_ms`,`end_ms`);--> statement-breakpoint
CREATE UNIQUE INDEX `blocks_rental` ON `vehicle_blocks` (`tenant_id`,`rental_id`);--> statement-breakpoint
CREATE UNIQUE INDEX `blocks_maintenance` ON `vehicle_blocks` (`tenant_id`,`maintenance_id`);--> statement-breakpoint
CREATE TABLE `vehicles` (
	`id` text PRIMARY KEY NOT NULL,
	`tenant_id` text NOT NULL,
	`created_at` text NOT NULL,
	`registration` text NOT NULL,
	`make` text NOT NULL,
	`model` text NOT NULL,
	`category` text NOT NULL,
	`year` integer NOT NULL,
	`transmission` text NOT NULL,
	`fuel` text NOT NULL,
	`seats` integer NOT NULL,
	`odometer` integer NOT NULL,
	`status` text DEFAULT 'ready' NOT NULL,
	`daily_rate` integer NOT NULL,
	`deposit` integer NOT NULL,
	`insurance_until` text NOT NULL,
	`inspection_until` text NOT NULL,
	`color` text NOT NULL,
	`version` integer DEFAULT 1 NOT NULL,
	FOREIGN KEY (`tenant_id`) REFERENCES `workspaces`(`id`) ON UPDATE no action ON DELETE no action,
	CONSTRAINT "vehicle_money" CHECK("vehicles"."daily_rate" >= 0 AND "vehicles"."deposit" >= 0 AND "vehicles"."odometer" >= 0)
);
--> statement-breakpoint
CREATE UNIQUE INDEX `vehicles_tenant_id` ON `vehicles` (`tenant_id`,`id`);--> statement-breakpoint
CREATE UNIQUE INDEX `vehicles_registration` ON `vehicles` (`tenant_id`,`registration`);--> statement-breakpoint
CREATE TABLE `workspaces` (
	`id` text PRIMARY KEY NOT NULL,
	`owner_id` text NOT NULL,
	`name` text NOT NULL,
	`mode` text NOT NULL,
	`settings` text NOT NULL,
	`version` integer DEFAULT 1 NOT NULL,
	`created_at` text NOT NULL
);
--> statement-breakpoint
CREATE UNIQUE INDEX `workspaces_owner_id_unique` ON `workspaces` (`owner_id`);
--> statement-breakpoint
-- Append these triggers to the generated schema migration, preserving statement breakpoints.
CREATE TRIGGER blocks_no_overlap_insert BEFORE INSERT ON vehicle_blocks
WHEN NEW.kind <> 'cleanup' AND EXISTS (
  SELECT 1 FROM vehicle_blocks b LEFT JOIN rentals r ON r.id=b.rental_id AND r.tenant_id=b.tenant_id
  WHERE b.tenant_id=NEW.tenant_id AND b.vehicle_id=NEW.vehicle_id
    AND b.start_ms<NEW.end_ms
    AND (CASE WHEN r.status='active' AND b.end_ms<CAST(strftime('%s','now') AS INTEGER)*1000 THEN 253402300799000 ELSE b.end_ms END)>NEW.start_ms
)
BEGIN SELECT RAISE(ABORT,'CAPACITY_CONFLICT'); END;
--> statement-breakpoint
CREATE TRIGGER blocks_no_overlap_update BEFORE UPDATE ON vehicle_blocks
WHEN NEW.kind <> 'cleanup' AND EXISTS (
  SELECT 1 FROM vehicle_blocks b LEFT JOIN rentals r ON r.id=b.rental_id AND r.tenant_id=b.tenant_id
  WHERE b.tenant_id=NEW.tenant_id AND b.vehicle_id=NEW.vehicle_id AND b.id<>OLD.id
    AND b.start_ms<NEW.end_ms
    AND (CASE WHEN r.status='active' AND b.end_ms<CAST(strftime('%s','now') AS INTEGER)*1000 THEN 253402300799000 ELSE b.end_ms END)>NEW.start_ms
)
BEGIN SELECT RAISE(ABORT,'CAPACITY_CONFLICT'); END;
--> statement-breakpoint
CREATE TRIGGER payment_deposit_limit BEFORE INSERT ON payments
WHEN NEW.kind IN ('deposit_returned','deposit_applied') AND NEW.amount > COALESCE((
  SELECT SUM(CASE WHEN kind='deposit_received' THEN amount WHEN kind IN ('deposit_returned','deposit_applied') THEN -amount ELSE 0 END)
  FROM payments WHERE tenant_id=NEW.tenant_id AND rental_id=NEW.rental_id
),0)
BEGIN SELECT RAISE(ABORT,'DEPOSIT_INSUFFICIENT'); END;
--> statement-breakpoint
CREATE TRIGGER payment_refund_limit BEFORE INSERT ON payments
WHEN NEW.kind='refund' AND NEW.amount > COALESCE((
  SELECT SUM(CASE WHEN kind IN ('payment','deposit_applied') THEN amount WHEN kind='refund' THEN -amount ELSE 0 END)
  FROM payments WHERE tenant_id=NEW.tenant_id AND rental_id=NEW.rental_id
),0)
BEGIN SELECT RAISE(ABORT,'REFUND_EXCEEDS_PAYMENT'); END;
--> statement-breakpoint
CREATE TRIGGER payment_receipt_limit BEFORE INSERT ON payments
WHEN NEW.kind IN ('payment','deposit_applied') AND NEW.amount + COALESCE((
  SELECT SUM(CASE WHEN kind IN ('payment','deposit_applied') THEN amount WHEN kind='refund' THEN -amount ELSE 0 END)
  FROM payments WHERE tenant_id=NEW.tenant_id AND rental_id=NEW.rental_id
),0) > (SELECT total FROM rentals WHERE tenant_id=NEW.tenant_id AND id=NEW.rental_id)
BEGIN SELECT RAISE(ABORT,'PAYMENT_EXCEEDS_BALANCE'); END;
--> statement-breakpoint
CREATE TRIGGER payment_guarantee_limit BEFORE INSERT ON payments
WHEN NEW.kind='deposit_received' AND NEW.amount + COALESCE((
  SELECT SUM(CASE WHEN kind='deposit_received' THEN amount WHEN kind IN ('deposit_returned','deposit_applied') THEN -amount ELSE 0 END)
  FROM payments WHERE tenant_id=NEW.tenant_id AND rental_id=NEW.rental_id
),0) > (SELECT deposit_required FROM rentals WHERE tenant_id=NEW.tenant_id AND id=NEW.rental_id)
BEGIN SELECT RAISE(ABORT,'DEPOSIT_EXCEEDS_REQUIRED'); END;
--> statement-breakpoint
CREATE TRIGGER payment_cash_session BEFORE INSERT ON payments
WHEN NEW.method='cash' AND NEW.kind<>'deposit_applied' AND NOT EXISTS (
  SELECT 1 FROM cash_sessions WHERE id=NEW.cash_session_id AND tenant_id=NEW.tenant_id AND closed_at IS NULL
)
BEGIN SELECT RAISE(ABORT,'CASH_SESSION_REQUIRED'); END;
--> statement-breakpoint
CREATE TRIGGER payment_cash_nonnegative BEFORE INSERT ON payments
WHEN NEW.method='cash' AND NEW.kind IN ('refund','deposit_returned') AND NEW.amount > (
  SELECT c.opening_amount + COALESCE((SELECT SUM(CASE WHEN p.kind IN ('payment','deposit_received') THEN p.amount WHEN p.kind IN ('refund','deposit_returned') THEN -p.amount ELSE 0 END) FROM payments p WHERE p.tenant_id=c.tenant_id AND p.cash_session_id=c.id AND p.method='cash'),0)
  FROM cash_sessions c WHERE c.id=NEW.cash_session_id AND c.tenant_id=NEW.tenant_id
)
BEGIN SELECT RAISE(ABORT,'CASH_INSUFFICIENT'); END;
--> statement-breakpoint
CREATE TRIGGER payment_invoice_link BEFORE INSERT ON payments
WHEN NEW.invoice_id IS NOT NULL AND NOT EXISTS(SELECT 1 FROM invoices WHERE tenant_id=NEW.tenant_id AND id=NEW.invoice_id AND rental_id=NEW.rental_id)
BEGIN SELECT RAISE(ABORT,'INVALID_INVOICE_LINK'); END;
--> statement-breakpoint
CREATE TRIGGER payment_immutable_update BEFORE UPDATE ON payments BEGIN SELECT RAISE(ABORT,'IMMUTABLE_PAYMENT'); END;
--> statement-breakpoint
CREATE TRIGGER payment_immutable_delete BEFORE DELETE ON payments BEGIN SELECT RAISE(ABORT,'IMMUTABLE_PAYMENT'); END;
--> statement-breakpoint
CREATE TRIGGER invoice_immutable_update BEFORE UPDATE ON invoices
WHEN OLD.status IN ('issued','credited') AND NOT (
  OLD.status='issued' AND NEW.status='credited' AND NEW.id=OLD.id AND NEW.tenant_id=OLD.tenant_id AND NEW.number=OLD.number
  AND NEW.rental_id=OLD.rental_id AND NEW.customer_id=OLD.customer_id AND NEW.subtotal=OLD.subtotal AND NEW.tax=OLD.tax
  AND NEW.stamp=OLD.stamp AND NEW.daily_levy=OLD.daily_levy AND NEW.total=OLD.total AND NEW.tax_rate_bps=OLD.tax_rate_bps
  AND NEW.issued_at=OLD.issued_at AND NEW.snapshot=OLD.snapshot AND NEW.created_at=OLD.created_at
  AND EXISTS(SELECT 1 FROM credit_notes WHERE tenant_id=OLD.tenant_id AND invoice_id=OLD.id)
)
BEGIN SELECT RAISE(ABORT,'IMMUTABLE_INVOICE'); END;
--> statement-breakpoint
CREATE TRIGGER invoice_immutable_delete BEFORE DELETE ON invoices WHEN OLD.status<>'draft' BEGIN SELECT RAISE(ABORT,'IMMUTABLE_INVOICE'); END;
--> statement-breakpoint
CREATE TRIGGER credit_immutable_update BEFORE UPDATE ON credit_notes BEGIN SELECT RAISE(ABORT,'IMMUTABLE_CREDIT_NOTE'); END;
--> statement-breakpoint
CREATE TRIGGER credit_immutable_delete BEFORE DELETE ON credit_notes BEGIN SELECT RAISE(ABORT,'IMMUTABLE_CREDIT_NOTE'); END;
--> statement-breakpoint
CREATE TRIGGER audit_immutable_update BEFORE UPDATE ON audit BEGIN SELECT RAISE(ABORT,'IMMUTABLE_AUDIT'); END;
--> statement-breakpoint
CREATE TRIGGER audit_immutable_delete BEFORE DELETE ON audit BEGIN SELECT RAISE(ABORT,'IMMUTABLE_AUDIT'); END;
--> statement-breakpoint
CREATE TRIGGER document_immutable_update BEFORE UPDATE ON document_snapshots BEGIN SELECT RAISE(ABORT,'IMMUTABLE_DOCUMENT'); END;
--> statement-breakpoint
CREATE TRIGGER document_immutable_delete BEFORE DELETE ON document_snapshots BEGIN SELECT RAISE(ABORT,'IMMUTABLE_DOCUMENT'); END;
--> statement-breakpoint
CREATE TRIGGER inspection_immutable_update BEFORE UPDATE ON inspections BEGIN SELECT RAISE(ABORT,'IMMUTABLE_INSPECTION'); END;
--> statement-breakpoint
CREATE TRIGGER inspection_immutable_delete BEFORE DELETE ON inspections BEGIN SELECT RAISE(ABORT,'IMMUTABLE_INSPECTION'); END;
--> statement-breakpoint
CREATE TRIGGER odometer_monotonic BEFORE UPDATE ON vehicles WHEN NEW.odometer<OLD.odometer BEGIN SELECT RAISE(ABORT,'ODOMETER_DECREASE'); END;
--> statement-breakpoint
CREATE TRIGGER closed_cash_immutable BEFORE UPDATE ON cash_sessions WHEN OLD.closed_at IS NOT NULL BEGIN SELECT RAISE(ABORT,'CASH_CLOSED'); END;
--> statement-breakpoint
CREATE TRIGGER invoice_locks_rental BEFORE UPDATE ON rentals
WHEN (NEW.total<>OLD.total OR NEW.customer_id<>OLD.customer_id OR NEW.start_at<>OLD.start_at OR NEW.end_at<>OLD.end_at) AND EXISTS(SELECT 1 FROM invoices WHERE tenant_id=OLD.tenant_id AND rental_id=OLD.id AND status='issued')
BEGIN SELECT RAISE(ABORT,'INVOICED_RENTAL_LOCKED'); END;

--> statement-breakpoint
DROP TRIGGER payment_receipt_limit;
--> statement-breakpoint
CREATE TRIGGER payment_receipt_limit BEFORE INSERT ON payments
WHEN NEW.kind IN ('payment','deposit_applied') AND NEW.amount + COALESCE((
  SELECT SUM(CASE WHEN kind IN ('payment','deposit_applied') THEN amount WHEN kind='refund' THEN -amount ELSE 0 END)
  FROM payments WHERE tenant_id=NEW.tenant_id AND rental_id=NEW.rental_id
),0) > (
  CASE WHEN EXISTS(SELECT 1 FROM invoices WHERE tenant_id=NEW.tenant_id AND rental_id=NEW.rental_id AND status='issued')
  THEN (SELECT total FROM invoices WHERE tenant_id=NEW.tenant_id AND rental_id=NEW.rental_id AND status='issued' ORDER BY issued_at DESC LIMIT 1)
  WHEN EXISTS(SELECT 1 FROM invoices WHERE tenant_id=NEW.tenant_id AND rental_id=NEW.rental_id AND status='credited') THEN 0
  ELSE (SELECT total FROM rentals WHERE tenant_id=NEW.tenant_id AND id=NEW.rental_id) END
)
BEGIN SELECT RAISE(ABORT,'PAYMENT_EXCEEDS_BALANCE'); END;
--> statement-breakpoint
CREATE TRIGGER payment_cancelled_guard BEFORE INSERT ON payments
WHEN NEW.kind IN ('payment','deposit_received') AND EXISTS(SELECT 1 FROM rentals WHERE tenant_id=NEW.tenant_id AND id=NEW.rental_id AND status='cancelled')
BEGIN SELECT RAISE(ABORT,'RENTAL_CANCELLED'); END;
--> statement-breakpoint
CREATE TRIGGER payment_deposit_apply_status BEFORE INSERT ON payments
WHEN NEW.kind='deposit_applied' AND NOT EXISTS(SELECT 1 FROM rentals WHERE tenant_id=NEW.tenant_id AND id=NEW.rental_id AND status='returned')
BEGIN SELECT RAISE(ABORT,'RENTAL_NOT_RETURNED'); END;
