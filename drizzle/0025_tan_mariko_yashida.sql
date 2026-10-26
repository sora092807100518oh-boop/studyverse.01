CREATE TABLE `marketCoinTransfers` (
	`id` int AUTO_INCREMENT NOT NULL,
	`token` varchar(80) NOT NULL,
	`senderUserId` int NOT NULL,
	`recipientUserId` int,
	`status` enum('pending','recipient_confirmed','completed','cancelled','expired') NOT NULL DEFAULT 'pending',
	`expiresAt` timestamp NOT NULL,
	`completedAt` timestamp,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `marketCoinTransfers_id` PRIMARY KEY(`id`),
	CONSTRAINT `marketCoinTransfers_token_unique` UNIQUE(`token`)
);
--> statement-breakpoint
ALTER TABLE `marketCoinTransactions` MODIFY COLUMN `type` enum('welcome','market_purchase','market_sale','coin_transfer_send','coin_transfer_receive') NOT NULL;