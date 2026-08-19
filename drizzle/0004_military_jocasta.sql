CREATE TABLE `journalEntries` (
	`id` int AUTO_INCREMENT NOT NULL,
	`userId` int NOT NULL,
	`classroomId` int NOT NULL,
	`subject` enum('english','kanji') NOT NULL,
	`difficulty` varchar(40) NOT NULL,
	`sourceType` enum('ai','news') NOT NULL,
	`sourceTitle` varchar(500),
	`sourceUrl` varchar(2048),
	`articleTitle` varchar(240) NOT NULL,
	`articleBody` text NOT NULL,
	`questionsJson` text NOT NULL,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `journalEntries_id` PRIMARY KEY(`id`)
);
