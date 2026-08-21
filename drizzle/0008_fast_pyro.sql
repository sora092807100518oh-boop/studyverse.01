CREATE TABLE `teacherAdminSessions` (
	`id` int AUTO_INCREMENT NOT NULL,
	`tokenHash` varchar(64) NOT NULL,
	`userId` int NOT NULL,
	`classroomId` int NOT NULL,
	`teacherId` int NOT NULL,
	`expiresAt` timestamp NOT NULL,
	`lastSeenAt` timestamp NOT NULL DEFAULT (now()),
	`revokedAt` timestamp,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `teacherAdminSessions_id` PRIMARY KEY(`id`),
	CONSTRAINT `teacherAdminSessions_tokenHash_unique` UNIQUE(`tokenHash`)
);
--> statement-breakpoint
ALTER TABLE `classrooms` ADD CONSTRAINT `classrooms_teacher_user_id_unique` UNIQUE(`teacherUserId`);