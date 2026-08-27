ALTER TABLE `focusSessions` ADD `clientSessionId` varchar(96);--> statement-breakpoint
ALTER TABLE `focusSessions` ADD CONSTRAINT `focus_sessions_client_session_id_unique` UNIQUE(`clientSessionId`);