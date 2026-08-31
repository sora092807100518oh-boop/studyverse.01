CREATE TABLE `smartNotificationSettings` (
	`id` int AUTO_INCREMENT NOT NULL,
	`userId` int NOT NULL,
	`wordbookId` int NOT NULL,
	`direction` enum('question','answer') NOT NULL DEFAULT 'question',
	`enabled` boolean NOT NULL DEFAULT false,
	`scheduleCronTaskUid` varchar(65),
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	`updatedAt` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `smartNotificationSettings_id` PRIMARY KEY(`id`),
	CONSTRAINT `smartNotificationSettings_userId_unique` UNIQUE(`userId`)
);
--> statement-breakpoint
CREATE TABLE `smartNotificationSubscriptions` (
	`id` int AUTO_INCREMENT NOT NULL,
	`userId` int NOT NULL,
	`endpoint` varchar(2048) NOT NULL,
	`subscriptionJson` text NOT NULL,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	`updatedAt` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `smartNotificationSubscriptions_id` PRIMARY KEY(`id`),
	CONSTRAINT `smartNotificationSubscriptions_endpoint_unique` UNIQUE(`endpoint`)
);
