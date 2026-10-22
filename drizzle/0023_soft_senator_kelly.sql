CREATE TABLE `marketDownloads` (
	`id` int AUTO_INCREMENT NOT NULL,
	`marketItemId` int NOT NULL,
	`userId` int NOT NULL,
	`downloadedWordbookId` int NOT NULL,
	`downloadedAt` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `marketDownloads_id` PRIMARY KEY(`id`),
	CONSTRAINT `market_downloads_item_user_unique` UNIQUE(`marketItemId`,`userId`)
);
--> statement-breakpoint
CREATE TABLE `marketItems` (
	`id` int AUTO_INCREMENT NOT NULL,
	`ownerUserId` int NOT NULL,
	`wordbookId` int NOT NULL,
	`name` varchar(160) NOT NULL,
	`imageUrl` varchar(2048) NOT NULL,
	`status` enum('pending','approved','rejected') NOT NULL DEFAULT 'pending',
	`reviewNote` varchar(500),
	`reviewedAt` timestamp,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	`updatedAt` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `marketItems_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `marketReviews` (
	`id` int AUTO_INCREMENT NOT NULL,
	`marketItemId` int NOT NULL,
	`userId` int NOT NULL,
	`stars` int NOT NULL,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	`updatedAt` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `marketReviews_id` PRIMARY KEY(`id`),
	CONSTRAINT `market_reviews_item_user_unique` UNIQUE(`marketItemId`,`userId`)
);
