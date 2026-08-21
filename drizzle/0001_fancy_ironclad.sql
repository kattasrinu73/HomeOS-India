CREATE TABLE `appliances` (
	`id` int AUTO_INCREMENT NOT NULL,
	`homeId` int NOT NULL,
	`category` varchar(80) NOT NULL,
	`brand` varchar(120),
	`model` varchar(160),
	`installedYear` int,
	`invoiceFileKey` varchar(512),
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `appliances_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `dispatchOffers` (
	`id` int AUTO_INCREMENT NOT NULL,
	`serviceRequestId` int NOT NULL,
	`technicianId` int NOT NULL,
	`round` int NOT NULL,
	`searchRadiusKm` int NOT NULL,
	`score` decimal(8,2) NOT NULL,
	`status` enum('offered','accepted','declined','expired') NOT NULL DEFAULT 'offered',
	`declineReason` varchar(160),
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `dispatchOffers_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `homes` (
	`id` int AUTO_INCREMENT NOT NULL,
	`ownerId` int NOT NULL,
	`label` varchar(120) NOT NULL,
	`addressLine1` varchar(255) NOT NULL,
	`locality` varchar(120) NOT NULL,
	`city` varchar(120) NOT NULL DEFAULT 'Hyderabad',
	`postalCode` varchar(20),
	`latitude` decimal(10,7),
	`longitude` decimal(10,7),
	`homeType` enum('apartment','independent_house','villa','other') NOT NULL,
	`healthScore` int NOT NULL DEFAULT 0,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	`updatedAt` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `homes_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `invoices` (
	`id` int AUTO_INCREMENT NOT NULL,
	`serviceRequestId` int NOT NULL,
	`paymentId` int NOT NULL,
	`invoiceNumber` varchar(64) NOT NULL,
	`technicianIdentity` varchar(255) NOT NULL,
	`warrantyDays` int NOT NULL DEFAULT 30,
	`warrantyEndsAt` timestamp NOT NULL,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `invoices_id` PRIMARY KEY(`id`),
	CONSTRAINT `invoices_serviceRequestId_unique` UNIQUE(`serviceRequestId`),
	CONSTRAINT `invoices_invoiceNumber_unique` UNIQUE(`invoiceNumber`)
);
--> statement-breakpoint
CREATE TABLE `jobProofs` (
	`id` int AUTO_INCREMENT NOT NULL,
	`serviceRequestId` int NOT NULL,
	`proofType` enum('before','part','after','note') NOT NULL,
	`fileKey` varchar(512),
	`fileUrl` varchar(512),
	`note` text,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `jobProofs_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `notificationRecords` (
	`id` int AUTO_INCREMENT NOT NULL,
	`userId` int NOT NULL,
	`serviceRequestId` int,
	`channel` enum('in_app','push') NOT NULL DEFAULT 'in_app',
	`event` varchar(120) NOT NULL,
	`title` varchar(200) NOT NULL,
	`body` text NOT NULL,
	`readAt` timestamp,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `notificationRecords_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `payments` (
	`id` int AUTO_INCREMENT NOT NULL,
	`serviceRequestId` int NOT NULL,
	`providerReference` varchar(160),
	`method` enum('upi','card','wallet','cash') NOT NULL,
	`status` enum('pending','confirmed','failed','refunded') NOT NULL DEFAULT 'pending',
	`visitFee` int NOT NULL DEFAULT 0,
	`labour` int NOT NULL DEFAULT 0,
	`parts` int NOT NULL DEFAULT 0,
	`taxes` int NOT NULL DEFAULT 0,
	`platformFee` int NOT NULL DEFAULT 0,
	`credits` int NOT NULL DEFAULT 0,
	`total` int NOT NULL,
	`paidAt` timestamp,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `payments_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `quoteItems` (
	`id` int AUTO_INCREMENT NOT NULL,
	`quoteId` int NOT NULL,
	`itemType` enum('visit_fee','labour','part','tax','platform_fee','discount') NOT NULL,
	`label` varchar(160) NOT NULL,
	`amount` int NOT NULL,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `quoteItems_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `quotes` (
	`id` int AUTO_INCREMENT NOT NULL,
	`serviceRequestId` int NOT NULL,
	`technicianId` int NOT NULL,
	`status` enum('draft','sent','approved','rejected','superseded') NOT NULL DEFAULT 'draft',
	`reason` text NOT NULL,
	`approvedAt` timestamp,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	`updatedAt` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `quotes_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `serviceRequests` (
	`id` int AUTO_INCREMENT NOT NULL,
	`publicId` varchar(40) NOT NULL,
	`customerId` int NOT NULL,
	`homeId` int NOT NULL,
	`status` enum('submitted','matched','assigned','en_route','arrived','diagnosing','quote_pending','quote_approved','in_progress','completion_pending','completed','paid','cancelled') NOT NULL DEFAULT 'submitted',
	`category` varchar(80) NOT NULL,
	`description` text NOT NULL,
	`attachmentUrl` varchar(512),
	`possibleDiagnosis` text,
	`urgency` enum('low','medium','high','emergency') NOT NULL DEFAULT 'medium',
	`estimateMin` int,
	`estimateMax` int,
	`assignedTechnicianId` int,
	`quoteApprovedAt` timestamp,
	`completionOtpHash` varchar(255),
	`completedAt` timestamp,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	`updatedAt` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `serviceRequests_id` PRIMARY KEY(`id`),
	CONSTRAINT `serviceRequests_publicId_unique` UNIQUE(`publicId`)
);
--> statement-breakpoint
CREATE TABLE `technicianSkills` (
	`id` int AUTO_INCREMENT NOT NULL,
	`technicianId` int NOT NULL,
	`category` varchar(80) NOT NULL,
	`verified` boolean NOT NULL DEFAULT false,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `technicianSkills_id` PRIMARY KEY(`id`),
	CONSTRAINT `tech_skill_unique` UNIQUE(`technicianId`,`category`)
);
--> statement-breakpoint
CREATE TABLE `technicians` (
	`id` int AUTO_INCREMENT NOT NULL,
	`userId` int NOT NULL,
	`displayName` varchar(160) NOT NULL,
	`photoUrl` varchar(512),
	`verificationStatus` enum('pending','verified','suspended') NOT NULL DEFAULT 'pending',
	`availability` enum('offline','available','busy') NOT NULL DEFAULT 'offline',
	`serviceRadiusKm` int NOT NULL DEFAULT 5,
	`completionRate` decimal(5,2) NOT NULL DEFAULT '0',
	`onTimeRate` decimal(5,2) NOT NULL DEFAULT '0',
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	`updatedAt` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `technicians_id` PRIMARY KEY(`id`),
	CONSTRAINT `technicians_userId_unique` UNIQUE(`userId`)
);
--> statement-breakpoint
CREATE TABLE `warranties` (
	`id` int AUTO_INCREMENT NOT NULL,
	`serviceRequestId` int NOT NULL,
	`invoiceId` int NOT NULL,
	`startsAt` timestamp NOT NULL,
	`endsAt` timestamp NOT NULL,
	`status` enum('active','claimed','expired','void') NOT NULL DEFAULT 'active',
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `warranties_id` PRIMARY KEY(`id`),
	CONSTRAINT `warranties_serviceRequestId_unique` UNIQUE(`serviceRequestId`)
);
--> statement-breakpoint
CREATE INDEX `appliances_home_idx` ON `appliances` (`homeId`);--> statement-breakpoint
CREATE INDEX `dispatch_request_idx` ON `dispatchOffers` (`serviceRequestId`);--> statement-breakpoint
CREATE INDEX `dispatch_technician_idx` ON `dispatchOffers` (`technicianId`);--> statement-breakpoint
CREATE INDEX `homes_owner_idx` ON `homes` (`ownerId`);--> statement-breakpoint
CREATE INDEX `proofs_request_idx` ON `jobProofs` (`serviceRequestId`);--> statement-breakpoint
CREATE INDEX `notifications_user_idx` ON `notificationRecords` (`userId`);--> statement-breakpoint
CREATE INDEX `payments_request_idx` ON `payments` (`serviceRequestId`);--> statement-breakpoint
CREATE INDEX `quote_items_quote_idx` ON `quoteItems` (`quoteId`);--> statement-breakpoint
CREATE INDEX `quotes_request_idx` ON `quotes` (`serviceRequestId`);--> statement-breakpoint
CREATE INDEX `service_requests_customer_idx` ON `serviceRequests` (`customerId`);--> statement-breakpoint
CREATE INDEX `service_requests_home_idx` ON `serviceRequests` (`homeId`);--> statement-breakpoint
CREATE INDEX `service_requests_status_idx` ON `serviceRequests` (`status`);