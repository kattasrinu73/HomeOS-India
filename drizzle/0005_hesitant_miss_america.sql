CREATE TABLE `dispatchRoundAudits` (
	`id` int AUTO_INCREMENT NOT NULL,
	`serviceRequestId` int NOT NULL,
	`initiatedByUserId` int NOT NULL,
	`round` int NOT NULL,
	`searchRadiusKm` int NOT NULL,
	`eligibleOfferCount` int NOT NULL DEFAULT 0,
	`outcome` enum('offers_created','exhausted') NOT NULL,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `dispatchRoundAudits_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE INDEX `dispatch_round_audit_request_idx` ON `dispatchRoundAudits` (`serviceRequestId`);--> statement-breakpoint
CREATE INDEX `dispatch_round_audit_created_idx` ON `dispatchRoundAudits` (`createdAt`);