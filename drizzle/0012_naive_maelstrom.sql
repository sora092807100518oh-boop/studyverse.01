CREATE TABLE `revivalDays` (
	`id` int AUTO_INCREMENT NOT NULL,
	`userId` int NOT NULL,
	`dateKey` varchar(10) NOT NULL,
	`usedAt` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `revivalDays_id` PRIMARY KEY(`id`),
	CONSTRAINT `revival_days_user_date_unique` UNIQUE(`userId`,`dateKey`)
);
--> statement-breakpoint
CREATE TABLE `savedStudySets` (
	`id` int AUTO_INCREMENT NOT NULL,
	`userId` int NOT NULL,
	`wordbookId` int NOT NULL,
	`rangeStart` int NOT NULL,
	`rangeEnd` int NOT NULL,
	`label` varchar(160) NOT NULL,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	`updatedAt` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `savedStudySets_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
ALTER TABLE `studentProfiles` ADD `revivalTickets` int DEFAULT 2 NOT NULL;