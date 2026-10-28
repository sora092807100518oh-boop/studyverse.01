CREATE TABLE `oauthClassroomApplications` (
	`id` int AUTO_INCREMENT NOT NULL,
	`userId` int NOT NULL,
	`classroomId` int NOT NULL,
	`status` enum('pending','approved','rejected') NOT NULL DEFAULT 'pending',
	`requestedAt` timestamp NOT NULL DEFAULT (now()),
	`reviewedAt` timestamp,
	`reviewedBy` int,
	CONSTRAINT `oauthClassroomApplications_id` PRIMARY KEY(`id`),
	CONSTRAINT `oauth_classroom_applications_user_classroom_unique` UNIQUE(`userId`,`classroomId`)
);
