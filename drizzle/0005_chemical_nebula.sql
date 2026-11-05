CREATE INDEX `workspaces_owner` ON `workspaces` (`owner_id`);
--> statement-breakpoint
UPDATE vehicles SET body_type=CASE
 WHEN lower(category) LIKE '%suv%' OR lower(category) LIKE '%crossover%' THEN 'suv'
 WHEN lower(category) LIKE '%berline%' THEN 'sedan'
 WHEN lower(category) LIKE '%utilitaire%' OR lower(category) LIKE '%monospace%' OR lower(category) LIKE '%minibus%' THEN 'van'
 WHEN lower(category) LIKE '%pick%' THEN 'pickup'
 WHEN lower(category) LIKE '%cabrio%' THEN 'convertible'
 ELSE body_type END WHERE body_type='hatchback';
