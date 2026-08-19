CREATE TABLE `announcements` (
	`id` int AUTO_INCREMENT NOT NULL,
	`classroomId` int,
	`authorUserId` int NOT NULL,
	`visibility` enum('classroom','global') NOT NULL DEFAULT 'classroom',
	`title` varchar(160) NOT NULL,
	`body` text NOT NULL,
	`publishedAt` timestamp NOT NULL DEFAULT (now()),
	`expiresAt` timestamp,
	CONSTRAINT `announcements_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `calendarEvents` (
	`id` int AUTO_INCREMENT NOT NULL,
	`classroomId` int,
	`authorUserId` int NOT NULL,
	`visibility` enum('classroom','global') NOT NULL DEFAULT 'classroom',
	`title` varchar(160) NOT NULL,
	`startsAt` timestamp NOT NULL,
	`endsAt` timestamp,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `calendarEvents_id` PRIMARY KEY(`id`)
);
