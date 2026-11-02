ALTER TABLE `rooms` ADD `question_count` integer DEFAULT 20 NOT NULL;--> statement-breakpoint
ALTER TABLE `rooms` ADD `time_limit` integer DEFAULT 0 NOT NULL;