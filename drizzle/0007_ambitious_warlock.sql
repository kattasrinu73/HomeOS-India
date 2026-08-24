CREATE TABLE `maintenanceReminders` (
	`id` int AUTO_INCREMENT NOT NULL,
	`homeId` int NOT NULL,
	`ownerId` int NOT NULL,
	`applianceId` int,
	`title` varchar(180) NOT NULL,
	`dueAt` timestamp NOT NULL,
	`status` enum('open','done') NOT NULL DEFAULT 'open',
	`completedAt` timestamp,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `maintenanceReminders_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE INDEX `maintenance_reminder_home_idx` ON `maintenanceReminders` (`homeId`);--> statement-breakpoint
CREATE INDEX `maintenance_reminder_owner_status_idx` ON `maintenanceReminders` (`ownerId`,`status`);--> statement-breakpoint
CREATE INDEX `maintenance_reminder_due_idx` ON `maintenanceReminders` (`dueAt`);