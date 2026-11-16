CREATE TABLE `dossiers` (
	`id` text PRIMARY KEY NOT NULL,
	`tenant_id` text NOT NULL,
	`created_at` text NOT NULL,
	`kind` text NOT NULL,
	`rental_id` text,
	`vehicle_id` text,
	`data` text NOT NULL,
	`status` text NOT NULL,
	`version` integer DEFAULT 1 NOT NULL,
	`updated_at` text NOT NULL,
	FOREIGN KEY (`tenant_id`) REFERENCES `workspaces`(`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`tenant_id`,`rental_id`) REFERENCES `rentals`(`tenant_id`,`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`tenant_id`,`vehicle_id`) REFERENCES `vehicles`(`tenant_id`,`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE UNIQUE INDEX `dossiers_tenant_id` ON `dossiers` (`tenant_id`,`id`);--> statement-breakpoint
CREATE INDEX `dossiers_kind` ON `dossiers` (`tenant_id`,`kind`,`status`);--> statement-breakpoint
ALTER TABLE `agency_files` ADD `dossier_id` text;--> statement-breakpoint
ALTER TABLE `agency_files` ADD `deleted_at` text;--> statement-breakpoint
ALTER TABLE `customers` ADD `identity_type` text DEFAULT 'cin' NOT NULL;--> statement-breakpoint
ALTER TABLE `customers` ADD `identity_number` text DEFAULT '' NOT NULL;--> statement-breakpoint
ALTER TABLE `customers` ADD `identity_until` text DEFAULT '' NOT NULL;--> statement-breakpoint
ALTER TABLE `customers` ADD `issuing_country` text DEFAULT '' NOT NULL;--> statement-breakpoint
ALTER TABLE `customers` ADD `license_country` text DEFAULT '' NOT NULL;--> statement-breakpoint
ALTER TABLE `customers` ADD `birth_date` text DEFAULT '' NOT NULL;--> statement-breakpoint
ALTER TABLE `customers` ADD `license_issued_at` text DEFAULT '' NOT NULL;--> statement-breakpoint
ALTER TABLE `rentals` ADD `parties` text;--> statement-breakpoint
ALTER TABLE `rentals` ADD `commercial_policy` text;--> statement-breakpoint
ALTER TABLE `rentals` ADD `document_language` text DEFAULT 'fr' NOT NULL;
--> statement-breakpoint
DROP INDEX agency_files_active_hash;
--> statement-breakpoint
CREATE UNIQUE INDEX agency_files_active_hash ON agency_files(tenant_id,COALESCE(customer_id,''),COALESCE(expense_id,''),COALESCE(dossier_id,''),kind,hash) WHERE revoked_at IS NULL;
--> statement-breakpoint
DROP TRIGGER file_kind_scope;
--> statement-breakpoint
CREATE TRIGGER file_kind_scope BEFORE INSERT ON agency_files
WHEN NOT ((NEW.kind='logo' AND NEW.customer_id IS NULL AND NEW.expense_id IS NULL AND NEW.dossier_id IS NULL)
 OR (NEW.kind IN ('identity_front','identity_back','license_front','license_back') AND NEW.customer_id IS NOT NULL AND NEW.expense_id IS NULL AND NEW.dossier_id IS NULL)
 OR (NEW.kind='expense_receipt' AND NEW.customer_id IS NULL AND NEW.expense_id IS NOT NULL AND NEW.dossier_id IS NULL)
 OR (NEW.kind='dossier_document' AND NEW.customer_id IS NULL AND NEW.expense_id IS NULL AND EXISTS(SELECT 1 FROM dossiers d WHERE d.tenant_id=NEW.tenant_id AND d.id=NEW.dossier_id)))
BEGIN SELECT RAISE(ABORT,'INVALID_FILE_SCOPE'); END;
--> statement-breakpoint
DROP TRIGGER file_content_immutable;
--> statement-breakpoint
CREATE TRIGGER file_content_immutable BEFORE UPDATE ON agency_files
WHEN NEW.id<>OLD.id OR NEW.tenant_id<>OLD.tenant_id OR NEW.customer_id IS NOT OLD.customer_id OR NEW.expense_id IS NOT OLD.expense_id OR NEW.dossier_id IS NOT OLD.dossier_id
 OR NEW.kind<>OLD.kind OR NEW.object_key<>OLD.object_key OR NEW.mime<>OLD.mime OR NEW.size<>OLD.size OR NEW.hash<>OLD.hash OR NEW.created_at<>OLD.created_at
 OR (OLD.revoked_at IS NOT NULL AND NOT (OLD.deleted_at IS NULL AND NEW.deleted_at='pending' AND NEW.revoked_at IS NOT NULL) AND NOT (OLD.deleted_at='pending' AND NEW.deleted_at IS NOT NULL AND NEW.revoked_at IS NOT NULL))
 OR (OLD.deleted_at IS NOT NULL AND OLD.deleted_at<>'pending')
 OR (NEW.deleted_at IS NOT OLD.deleted_at AND NOT (OLD.deleted_at IS NULL AND NEW.deleted_at='pending' AND NEW.kind IN ('identity_front','identity_back','license_front','license_back')) AND NOT (OLD.deleted_at='pending' AND NEW.deleted_at IS NOT NULL))
BEGIN SELECT RAISE(ABORT,'IMMUTABLE_FILE'); END;
--> statement-breakpoint
CREATE TRIGGER dossier_json_valid BEFORE INSERT ON dossiers WHEN NOT json_valid(NEW.data) BEGIN SELECT RAISE(ABORT,'INVALID_DOSSIER_DATA'); END;
--> statement-breakpoint
CREATE TRIGGER dossier_identity_immutable BEFORE UPDATE ON dossiers WHEN NEW.id<>OLD.id OR NEW.tenant_id<>OLD.tenant_id OR NEW.kind<>OLD.kind OR NEW.rental_id IS NOT OLD.rental_id OR NEW.vehicle_id IS NOT OLD.vehicle_id OR NEW.created_at<>OLD.created_at OR NOT json_valid(NEW.data) BEGIN SELECT RAISE(ABORT,'IMMUTABLE_DOSSIER'); END;
--> statement-breakpoint
CREATE UNIQUE INDEX bank_reconciliation_payment ON dossiers(tenant_id,json_extract(data,'$.paymentId')) WHERE kind='bank' AND status='matched';
--> statement-breakpoint
CREATE UNIQUE INDEX bank_reconciliation_line ON dossiers(tenant_id,json_extract(data,'$.account'),json_extract(data,'$.statementReference')) WHERE kind='bank' AND status='matched';
--> statement-breakpoint
CREATE UNIQUE INDEX withholding_certificate ON dossiers(tenant_id,json_extract(data,'$.certificate')) WHERE kind='withholding' AND status='certified';

--> statement-breakpoint
CREATE UNIQUE INDEX instrument_reference ON dossiers(tenant_id,json_extract(data,'$.instrumentType'),COALESCE(json_extract(data,'$.bank'),''),json_extract(data,'$.reference')) WHERE kind='instrument';
--> statement-breakpoint
CREATE UNIQUE INDEX compliance_singleton ON dossiers(tenant_id,kind,COALESCE(vehicle_id,'')) WHERE kind IN ('agency','vehicle','privacy','asset');
