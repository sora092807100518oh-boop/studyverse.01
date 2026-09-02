CREATE TABLE `vocabularyWordNotes` (
	`id` int AUTO_INCREMENT NOT NULL,
	`userId` int NOT NULL,
	`wordId` int NOT NULL,
	`note` varchar(500) NOT NULL,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	`updatedAt` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `vocabularyWordNotes_id` PRIMARY KEY(`id`),
	CONSTRAINT `vocabulary_word_notes_user_word_unique` UNIQUE(`userId`,`wordId`)
);
--> statement-breakpoint
ALTER TABLE `studentProfiles` ADD `avatarUrl` varchar(2048);