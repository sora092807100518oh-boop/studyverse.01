CREATE TABLE `practiceResumes` (
	`id` int AUTO_INCREMENT NOT NULL,
	`userId` int NOT NULL,
	`classroomId` int NOT NULL,
	`subject` enum('english','kanji') NOT NULL,
	`wordIdsJson` text NOT NULL,
	`currentIndex` int NOT NULL,
	`knownCount` int NOT NULL DEFAULT 0,
	`reviewCount` int NOT NULL DEFAULT 0,
	`missedWordIdsJson` text NOT NULL,
	`cardOrder` enum('normal','reverse','random') NOT NULL DEFAULT 'normal',
	`wordPool` enum('normal','mistakes') NOT NULL DEFAULT 'normal',
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	`updatedAt` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `practiceResumes_id` PRIMARY KEY(`id`),
	CONSTRAINT `practice_resumes_user_id_unique` UNIQUE(`userId`)
);
