CREATE TABLE `recommendedTests` (
	`id` int AUTO_INCREMENT NOT NULL,
	`classroomId` int NOT NULL,
	`authorUserId` int NOT NULL,
	`wordbookId` int NOT NULL,
	`rangeStart` int NOT NULL,
	`rangeEnd` int NOT NULL,
	`questionCount` int NOT NULL,
	`availableFrom` timestamp NOT NULL DEFAULT (now()),
	`availableUntil` timestamp,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `recommendedTests_id` PRIMARY KEY(`id`)
);
