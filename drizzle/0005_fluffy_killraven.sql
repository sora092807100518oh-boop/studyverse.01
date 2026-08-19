CREATE TABLE `siteAdminSessions` (
	`id` int AUTO_INCREMENT NOT NULL,
	`tokenHash` varchar(64) NOT NULL,
	`userId` int NOT NULL,
	`expiresAt` timestamp NOT NULL,
	`lastSeenAt` timestamp NOT NULL DEFAULT (now()),
	`revokedAt` timestamp,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `siteAdminSessions_id` PRIMARY KEY(`id`),
	CONSTRAINT `siteAdminSessions_tokenHash_unique` UNIQUE(`tokenHash`)
);
