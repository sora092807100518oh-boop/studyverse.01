CREATE TABLE `siteSettings` (
	`key` varchar(120) NOT NULL,
	`value` varchar(255) NOT NULL,
	`updatedAt` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `siteSettings_key` PRIMARY KEY(`key`)
);
