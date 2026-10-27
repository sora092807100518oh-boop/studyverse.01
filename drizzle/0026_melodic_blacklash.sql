CREATE TABLE `announcementCoinClaims` (
	`id` int AUTO_INCREMENT NOT NULL,
	`announcementId` int NOT NULL,
	`userId` int NOT NULL,
	`amount` int NOT NULL,
	`claimedAt` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `announcementCoinClaims_id` PRIMARY KEY(`id`),
	CONSTRAINT `announcement_coin_claims_announcement_user_unique` UNIQUE(`announcementId`,`userId`)
);
--> statement-breakpoint
ALTER TABLE `marketCoinTransactions` MODIFY COLUMN `type` enum('welcome','market_purchase','market_sale','coin_transfer_send','coin_transfer_receive','admin_grant','announcement_grant') NOT NULL;--> statement-breakpoint
ALTER TABLE `announcements` ADD `grantCoins` int DEFAULT 0 NOT NULL;