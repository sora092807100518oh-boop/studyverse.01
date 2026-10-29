ALTER TABLE `marketItems` ADD `freeFrom` timestamp;--> statement-breakpoint
ALTER TABLE `marketItems` ADD `freeUntil` timestamp;--> statement-breakpoint
ALTER TABLE `marketItems` ADD `isOfficial` boolean DEFAULT false NOT NULL;