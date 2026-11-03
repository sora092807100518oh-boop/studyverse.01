CREATE TABLE `googleSessions` (
	`id` int AUTO_INCREMENT NOT NULL,
	`tokenHash` varchar(64) NOT NULL,
	`userId` int NOT NULL,
	`expiresAt` timestamp NOT NULL,
	`revokedAt` timestamp,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `googleSessions_id` PRIMARY KEY(`id`),
	CONSTRAINT `googleSessions_tokenHash_unique` UNIQUE(`tokenHash`)
);
