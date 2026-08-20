CREATE TABLE `activityLogs` (
	`id` int AUTO_INCREMENT NOT NULL,
	`actorUserId` int NOT NULL,
	`classroomId` int,
	`category` enum('classroom','member','learning','journal') NOT NULL,
	`action` varchar(80) NOT NULL,
	`details` text,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `activityLogs_id` PRIMARY KEY(`id`)
);
