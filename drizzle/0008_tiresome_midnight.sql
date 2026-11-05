CREATE TABLE `vehicle_diagram_assets` (
	`id` text PRIMARY KEY NOT NULL,
	`tenant_id` text NOT NULL,
	`created_at` text NOT NULL,
	`object_key` text NOT NULL,
	`mime` text NOT NULL,
	`size` integer NOT NULL,
	`hash` text NOT NULL,
	`label` text NOT NULL,
	FOREIGN KEY (`tenant_id`) REFERENCES `workspaces`(`id`) ON UPDATE no action ON DELETE no action,
	CONSTRAINT "diagram_asset_size" CHECK("vehicle_diagram_assets"."size">0 AND "vehicle_diagram_assets"."size"<=5242880)
);
--> statement-breakpoint
CREATE UNIQUE INDEX `diagram_asset_hash` ON `vehicle_diagram_assets` (`tenant_id`,`hash`);