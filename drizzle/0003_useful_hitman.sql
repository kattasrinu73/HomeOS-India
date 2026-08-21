CREATE TABLE `passportDocuments` (
	`id` int AUTO_INCREMENT NOT NULL,
	`homeId` int NOT NULL,
	`ownerId` int NOT NULL,
	`documentType` enum('appliance_invoice','warranty_paper','installation_record','service_document','other') NOT NULL,
	`label` varchar(180) NOT NULL,
	`fileKey` varchar(512) NOT NULL,
	`fileUrl` varchar(512) NOT NULL,
	`mimeType` varchar(100) NOT NULL,
	`fileSize` int NOT NULL,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `passportDocuments_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE INDEX `passport_documents_home_idx` ON `passportDocuments` (`homeId`);--> statement-breakpoint
CREATE INDEX `passport_documents_owner_idx` ON `passportDocuments` (`ownerId`);