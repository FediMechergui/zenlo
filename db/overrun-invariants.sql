DROP TRIGGER blocks_no_overlap_insert;
--> statement-breakpoint
DROP TRIGGER blocks_no_overlap_update;
--> statement-breakpoint
CREATE TRIGGER blocks_no_overlap_insert BEFORE INSERT ON vehicle_blocks
WHEN NEW.kind <> 'cleanup' AND EXISTS (
  SELECT 1 FROM vehicle_blocks b
  LEFT JOIN rentals r ON r.id=b.rental_id AND r.tenant_id=b.tenant_id
  LEFT JOIN maintenance m ON m.id=b.maintenance_id AND m.tenant_id=b.tenant_id
  WHERE b.tenant_id=NEW.tenant_id AND b.vehicle_id=NEW.vehicle_id
    AND b.start_ms<NEW.end_ms
    AND (CASE WHEN (r.status='active' OR (m.id IS NOT NULL AND m.status<>'completed')) AND b.end_ms<CAST(strftime('%s','now') AS INTEGER)*1000 THEN 253402300799000 ELSE b.end_ms END)>NEW.start_ms
)
BEGIN SELECT RAISE(ABORT,'CAPACITY_CONFLICT'); END;
--> statement-breakpoint
CREATE TRIGGER blocks_no_overlap_update BEFORE UPDATE ON vehicle_blocks
WHEN NEW.kind <> 'cleanup' AND EXISTS (
  SELECT 1 FROM vehicle_blocks b
  LEFT JOIN rentals r ON r.id=b.rental_id AND r.tenant_id=b.tenant_id
  LEFT JOIN maintenance m ON m.id=b.maintenance_id AND m.tenant_id=b.tenant_id
  WHERE b.tenant_id=NEW.tenant_id AND b.vehicle_id=NEW.vehicle_id AND b.id<>OLD.id
    AND b.start_ms<NEW.end_ms
    AND (CASE WHEN (r.status='active' OR (m.id IS NOT NULL AND m.status<>'completed')) AND b.end_ms<CAST(strftime('%s','now') AS INTEGER)*1000 THEN 253402300799000 ELSE b.end_ms END)>NEW.start_ms
)
BEGIN SELECT RAISE(ABORT,'CAPACITY_CONFLICT'); END;
