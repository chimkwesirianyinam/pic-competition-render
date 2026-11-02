ALTER TABLE `buzzes` ADD `response_ms` integer;--> statement-breakpoint
ALTER TABLE `buzzes` ADD `verdict` integer;--> statement-breakpoint
ALTER TABLE `rooms` ADD `competition_round` integer DEFAULT 1 NOT NULL;--> statement-breakpoint
ALTER TABLE `rooms` ADD `question` integer DEFAULT 0 NOT NULL;--> statement-breakpoint
ALTER TABLE `rooms` ADD `phase` text DEFAULT 'ready' NOT NULL;--> statement-breakpoint
ALTER TABLE `rooms` ADD `round_locked` integer DEFAULT 0 NOT NULL;--> statement-breakpoint
ALTER TABLE `rooms` ADD `started_at` integer;