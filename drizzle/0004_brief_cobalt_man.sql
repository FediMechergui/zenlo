CREATE TABLE `client_acknowledgments` (
	`id` text PRIMARY KEY NOT NULL,
	`tenant_id` text NOT NULL,
	`created_at` text NOT NULL,
	`rental_id` text NOT NULL,
	`user_id` text NOT NULL,
	`email` text NOT NULL,
	`inspection_hash` text NOT NULL,
	FOREIGN KEY (`tenant_id`,`rental_id`) REFERENCES `rentals`(`tenant_id`,`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE UNIQUE INDEX `client_acknowledgment_current` ON `client_acknowledgments` (`tenant_id`,`rental_id`,`user_id`,`inspection_hash`);
--> statement-breakpoint
CREATE UNIQUE INDEX agency_files_active_hash ON agency_files (tenant_id,COALESCE(customer_id,''),COALESCE(expense_id,''),kind,hash) WHERE revoked_at IS NULL;
--> statement-breakpoint
CREATE UNIQUE INDEX agency_files_object_key ON agency_files(object_key);
--> statement-breakpoint
CREATE TRIGGER expense_link_scope BEFORE INSERT ON expenses
WHEN (NEW.supplier_id IS NOT NULL AND NOT EXISTS(SELECT 1 FROM suppliers WHERE tenant_id=NEW.tenant_id AND id=NEW.supplier_id))
 OR (NEW.maintenance_id IS NOT NULL AND NOT EXISTS(SELECT 1 FROM maintenance WHERE tenant_id=NEW.tenant_id AND id=NEW.maintenance_id AND vehicle_id=NEW.vehicle_id))
 OR (NEW.obligation_id IS NOT NULL AND NOT EXISTS(SELECT 1 FROM obligations WHERE tenant_id=NEW.tenant_id AND id=NEW.obligation_id AND vehicle_id=NEW.vehicle_id))
BEGIN SELECT RAISE(ABORT,'INVALID_EXPENSE_LINK'); END;
--> statement-breakpoint
CREATE TRIGGER expense_immutable_update BEFORE UPDATE ON expenses BEGIN SELECT RAISE(ABORT,'IMMUTABLE_EXPENSE'); END;
--> statement-breakpoint
CREATE TRIGGER expense_immutable_delete BEFORE DELETE ON expenses BEGIN SELECT RAISE(ABORT,'IMMUTABLE_EXPENSE'); END;
--> statement-breakpoint
CREATE TRIGGER expense_payment_limit BEFORE INSERT ON expense_payments
WHEN NEW.amount+COALESCE((SELECT SUM(amount) FROM expense_payments WHERE tenant_id=NEW.tenant_id AND expense_id=NEW.expense_id),0)>(SELECT amount FROM expenses WHERE tenant_id=NEW.tenant_id AND id=NEW.expense_id)
BEGIN SELECT RAISE(ABORT,'EXPENSE_OVERPAYMENT'); END;
--> statement-breakpoint
CREATE TRIGGER expense_payment_immutable_update BEFORE UPDATE ON expense_payments BEGIN SELECT RAISE(ABORT,'IMMUTABLE_EXPENSE_PAYMENT'); END;
--> statement-breakpoint
CREATE TRIGGER expense_payment_immutable_delete BEFORE DELETE ON expense_payments BEGIN SELECT RAISE(ABORT,'IMMUTABLE_EXPENSE_PAYMENT'); END;
--> statement-breakpoint
CREATE TRIGGER quote_immutable_payload BEFORE UPDATE ON quotes
WHEN NEW.id<>OLD.id OR NEW.tenant_id<>OLD.tenant_id OR NEW.rental_id<>OLD.rental_id OR NEW.customer_id<>OLD.customer_id OR NEW.number<>OLD.number OR NEW.valid_until<>OLD.valid_until OR NEW.total<>OLD.total OR NEW.notes<>OLD.notes OR NEW.snapshot<>OLD.snapshot OR NEW.created_at<>OLD.created_at OR NEW.version<>OLD.version+1 OR NEW.decided_at IS NULL OR NOT ((OLD.status='issued' AND NEW.status IN ('accepted','declined','cancelled')) OR (OLD.status='accepted' AND NEW.status='cancelled'))
BEGIN SELECT RAISE(ABORT,'IMMUTABLE_QUOTE'); END;
--> statement-breakpoint
CREATE TRIGGER quote_immutable_delete BEFORE DELETE ON quotes BEGIN SELECT RAISE(ABORT,'IMMUTABLE_QUOTE'); END;
--> statement-breakpoint
CREATE TRIGGER obligation_completed_immutable BEFORE UPDATE ON obligations WHEN OLD.status='completed' BEGIN SELECT RAISE(ABORT,'IMMUTABLE_OBLIGATION'); END;
--> statement-breakpoint
CREATE TRIGGER file_kind_scope BEFORE INSERT ON agency_files
WHEN NOT ((NEW.kind='logo' AND NEW.customer_id IS NULL AND NEW.expense_id IS NULL) OR (NEW.kind IN ('identity_front','identity_back','license_front','license_back') AND NEW.customer_id IS NOT NULL AND NEW.expense_id IS NULL) OR (NEW.kind='expense_receipt' AND NEW.customer_id IS NULL AND NEW.expense_id IS NOT NULL))
BEGIN SELECT RAISE(ABORT,'INVALID_FILE_SCOPE'); END;
--> statement-breakpoint
CREATE TRIGGER file_content_immutable BEFORE UPDATE ON agency_files
WHEN NEW.id<>OLD.id OR NEW.tenant_id<>OLD.tenant_id OR NEW.customer_id IS NOT OLD.customer_id OR NEW.expense_id IS NOT OLD.expense_id OR NEW.kind<>OLD.kind OR NEW.object_key<>OLD.object_key OR NEW.mime<>OLD.mime OR NEW.size<>OLD.size OR NEW.hash<>OLD.hash OR NEW.created_at<>OLD.created_at OR OLD.revoked_at IS NOT NULL
BEGIN SELECT RAISE(ABORT,'IMMUTABLE_FILE'); END;
--> statement-breakpoint
CREATE TRIGGER client_access_immutable BEFORE UPDATE ON client_access
WHEN NEW.id<>OLD.id OR NEW.tenant_id<>OLD.tenant_id OR NEW.rental_id<>OLD.rental_id OR NEW.email<>OLD.email OR NEW.name<>OLD.name OR NEW.expires_at<>OLD.expires_at OR NEW.created_at<>OLD.created_at OR OLD.revoked_at IS NOT NULL
BEGIN SELECT RAISE(ABORT,'IMMUTABLE_CLIENT_ACCESS'); END;
--> statement-breakpoint
CREATE TRIGGER acknowledgment_immutable_update BEFORE UPDATE ON client_acknowledgments BEGIN SELECT RAISE(ABORT,'IMMUTABLE_ACKNOWLEDGMENT'); END;
--> statement-breakpoint
CREATE TRIGGER acknowledgment_immutable_delete BEFORE DELETE ON client_acknowledgments BEGIN SELECT RAISE(ABORT,'IMMUTABLE_ACKNOWLEDGMENT'); END;
--> statement-breakpoint
INSERT INTO expenses (id,tenant_id,created_at,vehicle_id,category,supplier,amount,date,note,supplier_id,reference,due_date,maintenance_id,obligation_id)
SELECT 'expense_legacy_'||m.id,m.tenant_id,m.created_at,m.vehicle_id,'Maintenance',m.supplier,m.cost,substr(datetime(m.end_at,'+1 hour'),1,10),'Reprise du coût de maintenance déjà terminé ; règlement à rapprocher.',NULL,'',substr(datetime(m.end_at,'+1 hour'),1,10),m.id,NULL FROM maintenance m WHERE m.status='completed' AND m.cost>0 AND NOT EXISTS(SELECT 1 FROM expenses e WHERE e.tenant_id=m.tenant_id AND e.maintenance_id=m.id);
