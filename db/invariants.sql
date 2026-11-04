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
