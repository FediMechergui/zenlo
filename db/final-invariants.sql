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
