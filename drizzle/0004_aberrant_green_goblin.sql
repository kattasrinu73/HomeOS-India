CREATE TABLE `accountProfiles` (
	`id` int AUTO_INCREMENT NOT NULL,
	`userId` int NOT NULL,
	`serviceIntent` enum('customer','technician') NOT NULL DEFAULT 'customer',
	`onboardingCompletedAt` timestamp,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	`updatedAt` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `accountProfiles_id` PRIMARY KEY(`id`),
	CONSTRAINT `accountProfiles_userId_unique` UNIQUE(`userId`)
);
