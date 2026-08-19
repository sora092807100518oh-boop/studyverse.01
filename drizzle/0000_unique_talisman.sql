CREATE TABLE `classrooms` (
	`id` int AUTO_INCREMENT NOT NULL,
	`code` varchar(32) NOT NULL,
	`name` varchar(120) NOT NULL,
	`teacherUserId` int,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	`updatedAt` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `classrooms_id` PRIMARY KEY(`id`),
	CONSTRAINT `classrooms_code_unique` UNIQUE(`code`)
);
--> statement-breakpoint
CREATE TABLE `focusSessions` (
	`id` int AUTO_INCREMENT NOT NULL,
	`userId` int NOT NULL,
	`classroomId` int NOT NULL,
	`startedAt` timestamp NOT NULL,
	`completedAt` timestamp NOT NULL,
	`focusSeconds` int NOT NULL,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `focusSessions_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `studentProfiles` (
	`id` int AUTO_INCREMENT NOT NULL,
	`userId` int NOT NULL,
	`classroomId` int NOT NULL,
	`pinHash` varchar(128) NOT NULL,
	`classroomRole` enum('student','teacher','owner') NOT NULL DEFAULT 'student',
	`displayName` varchar(80),
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	`updatedAt` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `studentProfiles_id` PRIMARY KEY(`id`),
	CONSTRAINT `studentProfiles_userId_unique` UNIQUE(`userId`)
);
--> statement-breakpoint
CREATE TABLE `studyRecords` (
	`id` int AUTO_INCREMENT NOT NULL,
	`userId` int NOT NULL,
	`classroomId` int NOT NULL,
	`wordId` int,
	`mode` enum('practice','test','journal','ai_select') NOT NULL,
	`isCorrect` boolean NOT NULL,
	`answeredAt` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `studyRecords_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `users` (
	`id` int AUTO_INCREMENT NOT NULL,
	`openId` varchar(64) NOT NULL,
	`name` text,
	`email` varchar(320),
	`loginMethod` varchar(64),
	`role` enum('user','admin') NOT NULL DEFAULT 'user',
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	`updatedAt` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	`lastSignedIn` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `users_id` PRIMARY KEY(`id`),
	CONSTRAINT `users_openId_unique` UNIQUE(`openId`)
);
--> statement-breakpoint
CREATE TABLE `vocabularyWords` (
	`id` int AUTO_INCREMENT NOT NULL,
	`wordbookId` int NOT NULL,
	`front` varchar(500) NOT NULL,
	`back` varchar(500) NOT NULL,
	`reading` varchar(500),
	`source` enum('manual','csv','admin') NOT NULL DEFAULT 'manual',
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `vocabularyWords_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `wordbooks` (
	`id` int AUTO_INCREMENT NOT NULL,
	`title` varchar(160) NOT NULL,
	`subject` enum('english','kanji') NOT NULL,
	`visibility` enum('private','classroom','global') NOT NULL DEFAULT 'private',
	`ownerUserId` int,
	`classroomId` int,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	`updatedAt` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `wordbooks_id` PRIMARY KEY(`id`)
);
