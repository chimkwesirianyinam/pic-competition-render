CREATE TABLE `buzzes` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`room` text NOT NULL,
	`round` integer NOT NULL,
	`player` text NOT NULL,
	`at` integer NOT NULL
);
--> statement-breakpoint
CREATE UNIQUE INDEX `one_buzz` ON `buzzes` (`room`,`round`,`player`);--> statement-breakpoint
CREATE TABLE `players` (
	`id` text PRIMARY KEY NOT NULL,
	`room` text NOT NULL,
	`name` text NOT NULL,
	`score` integer DEFAULT 0 NOT NULL
);
--> statement-breakpoint
CREATE TABLE `rooms` (
	`code` text PRIMARY KEY NOT NULL,
	`secret` text NOT NULL,
	`title` text NOT NULL,
	`round` integer DEFAULT 0 NOT NULL,
	`armed` integer DEFAULT 0 NOT NULL,
	`created` integer NOT NULL
);
