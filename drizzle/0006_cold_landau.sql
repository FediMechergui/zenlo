CREATE TABLE `vehicle_templates` (
	`id` text PRIMARY KEY NOT NULL,
	`tenant_id` text NOT NULL,
	`created_at` text NOT NULL,
	`make` text NOT NULL,
	`model` text NOT NULL,
	`body_type` text NOT NULL,
	`diagram_profile` text NOT NULL,
	`version` integer DEFAULT 1 NOT NULL,
	`updated_at` text NOT NULL,
	FOREIGN KEY (`tenant_id`) REFERENCES `workspaces`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE UNIQUE INDEX `vehicle_templates_tenant_id` ON `vehicle_templates` (`tenant_id`,`id`);--> statement-breakpoint
ALTER TABLE `vehicles` ADD `diagram_profile` text;