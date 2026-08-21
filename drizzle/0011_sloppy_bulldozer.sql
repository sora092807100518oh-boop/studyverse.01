CREATE TABLE `monsterEggs` (
	`id` int AUTO_INCREMENT NOT NULL,
	`userId` int NOT NULL,
	`eggNumber` enum('1','2','3') NOT NULL,
	`source` enum('starter','focus_260','focus_520','completion') NOT NULL,
	`acquiredAt` timestamp NOT NULL DEFAULT (now()),
	`consumedAt` timestamp,
	`monsterProfileId` int,
	CONSTRAINT `monsterEggs_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `monsterImageSettings` (
	`id` int AUTO_INCREMENT NOT NULL,
	`slotKey` varchar(32) NOT NULL,
	`imageType` enum('egg','evolution') NOT NULL,
	`eggNumber` int,
	`evolutionStage` int,
	`imageUrl` varchar(2048) NOT NULL,
	`updatedByUserId` int NOT NULL,
	`updatedAt` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `monsterImageSettings_id` PRIMARY KEY(`id`),
	CONSTRAINT `monster_image_settings_slot_key_unique` UNIQUE(`slotKey`)
);
--> statement-breakpoint
CREATE TABLE `monsterMissionClaims` (
	`id` int AUTO_INCREMENT NOT NULL,
	`userId` int NOT NULL,
	`missionKey` varchar(96) NOT NULL,
	`periodKey` varchar(16) NOT NULL,
	`points` int NOT NULL,
	`claimedAt` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `monsterMissionClaims_id` PRIMARY KEY(`id`),
	CONSTRAINT `monster_mission_claims_user_mission_period_unique` UNIQUE(`userId`,`missionKey`,`periodKey`)
);
--> statement-breakpoint
CREATE TABLE `monsterProfiles` (
	`id` int AUTO_INCREMENT NOT NULL,
	`userId` int NOT NULL,
	`eggNumber` enum('1','2','3') NOT NULL,
	`active` boolean NOT NULL DEFAULT true,
	`startedAt` timestamp NOT NULL DEFAULT (now()),
	`completedAt` timestamp,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `monsterProfiles_id` PRIMARY KEY(`id`)
);
