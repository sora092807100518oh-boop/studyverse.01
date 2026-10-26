CREATE TABLE `marketCoinTransactions` (
	`id` int AUTO_INCREMENT NOT NULL,
	`userId` int NOT NULL,
	`counterpartyUserId` int,
	`marketItemId` int,
	`amount` int NOT NULL,
	`type` enum('welcome','market_purchase','market_sale') NOT NULL,
	`referenceKey` varchar(160) NOT NULL,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `marketCoinTransactions_id` PRIMARY KEY(`id`),
	CONSTRAINT `marketCoinTransactions_referenceKey_unique` UNIQUE(`referenceKey`)
);
--> statement-breakpoint
ALTER TABLE `marketDownloads` ADD `sellerUserId` int;--> statement-breakpoint
ALTER TABLE `marketDownloads` ADD `pricePaid` int DEFAULT 0 NOT NULL;--> statement-breakpoint
ALTER TABLE `marketItems` ADD `price` int DEFAULT 0 NOT NULL;--> statement-breakpoint
ALTER TABLE `monsterMissionClaims` ADD `coins` int DEFAULT 0 NOT NULL;--> statement-breakpoint
ALTER TABLE `users` ADD `marketCoins` int DEFAULT 0 NOT NULL;