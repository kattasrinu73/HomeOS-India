CREATE TABLE `operationsRequestAudits` (
	`id` int AUTO_INCREMENT NOT NULL,
	`serviceRequestId` int NOT NULL,
	`initiatedByUserId` int NOT NULL,
	`action` enum('cancelled') NOT NULL,
	`reason` varchar(400) NOT NULL,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `operationsRequestAudits_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE INDEX `operations_request_audit_request_idx` ON `operationsRequestAudits` (`serviceRequestId`);--> statement-breakpoint
CREATE INDEX `operations_request_audit_created_idx` ON `operationsRequestAudits` (`createdAt`);