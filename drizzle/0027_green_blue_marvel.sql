CREATE TABLE `marketTermConsents` (
	`id` int AUTO_INCREMENT NOT NULL,
	`termId` int NOT NULL,
	`userId` int NOT NULL,
	`acceptedAt` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `marketTermConsents_id` PRIMARY KEY(`id`),
	CONSTRAINT `market_term_consents_term_user_unique` UNIQUE(`termId`,`userId`)
);
--> statement-breakpoint
CREATE TABLE `marketTerms` (
	`id` int AUTO_INCREMENT NOT NULL,
	`title` varchar(160) NOT NULL,
	`fileName` varchar(255) NOT NULL,
	`fileUrl` varchar(2048) NOT NULL,
	`storageKey` varchar(512) NOT NULL,
	`mimeType` varchar(120) NOT NULL,
	`uploadedBy` int NOT NULL,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `marketTerms_id` PRIMARY KEY(`id`)
);
