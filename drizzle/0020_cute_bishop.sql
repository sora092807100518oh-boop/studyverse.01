CREATE TABLE `recommendedTestClaims` (
	`id` int AUTO_INCREMENT NOT NULL,
	`recommendedTestId` int NOT NULL,
	`userId` int NOT NULL,
	`receivedWordbookId` int NOT NULL,
	`claimedAt` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `recommendedTestClaims_id` PRIMARY KEY(`id`),
	CONSTRAINT `recommended_test_claims_test_user_unique` UNIQUE(`recommendedTestId`,`userId`)
);
--> statement-breakpoint
ALTER TABLE `recommendedTests` ADD `deliveryMode` enum('normal','announcement') DEFAULT 'normal' NOT NULL;--> statement-breakpoint
ALTER TABLE `vocabularyWords` ADD `imageUrl` varchar(2048);--> statement-breakpoint
ALTER TABLE `vocabularyWords` ADD `exampleSentence` varchar(1200);--> statement-breakpoint
ALTER TABLE `vocabularyWords` ADD `exampleTranslation` varchar(1200);