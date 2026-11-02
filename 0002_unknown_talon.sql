CREATE TABLE `teams` (
	`id` text PRIMARY KEY NOT NULL,
	`room` text NOT NULL,
	`name` text NOT NULL,
	`enabled` integer DEFAULT 1 NOT NULL,
	`score` integer DEFAULT 0 NOT NULL,
	`logo` text,
	`sort` integer NOT NULL
);
--> statement-breakpoint
ALTER TABLE `players` ADD `team` text;--> statement-breakpoint
ALTER TABLE `players` ADD `seat` integer;--> statement-breakpoint
CREATE UNIQUE INDEX `one_class_seat` ON `players` (`room`,`team`,`seat`);--> statement-breakpoint
ALTER TABLE `rooms` ADD `school_logo` text;--> statement-breakpoint
ALTER TABLE `rooms` ADD `competition_logo` text;