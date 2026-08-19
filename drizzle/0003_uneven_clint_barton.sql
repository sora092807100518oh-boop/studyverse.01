CREATE TABLE `pinLoginAttempts` (
	`id` int AUTO_INCREMENT NOT NULL,
	`attemptKeyHash` varchar(64) NOT NULL,
	`succeeded` boolean NOT NULL,
	`attemptedAt` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `pinLoginAttempts_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `pinSessions` (
	`id` int AUTO_INCREMENT NOT NULL,
	`tokenHash` varchar(64) NOT NULL,
	`profileId` int NOT NULL,
	`userId` int NOT NULL,
	`classroomId` int NOT NULL,
	`expiresAt` timestamp NOT NULL,
	`lastSeenAt` timestamp NOT NULL DEFAULT (now()),
	`revokedAt` timestamp,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `pinSessions_id` PRIMARY KEY(`id`),
	CONSTRAINT `pinSessions_tokenHash_unique` UNIQUE(`tokenHash`)
);
--> statement-breakpoint
ALTER TABLE `studentProfiles` DROP INDEX `studentProfiles_classroom_pin_unique`;--> statement-breakpoint
ALTER TABLE `studentProfiles` ADD `pinLookupHash` varchar(64) NOT NULL;--> statement-breakpoint
ALTER TABLE `studentProfiles` ADD CONSTRAINT `studentProfiles_classroom_pin_lookup_unique` UNIQUE(`classroomId`,`pinLookupHash`);