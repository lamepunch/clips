CREATE TABLE `shots` (
	`id` text PRIMARY KEY NOT NULL,
	`user_id` text NOT NULL,
	`source_hash` text NOT NULL,
	`game_id` text,
	`title` text DEFAULT '' NOT NULL,
	`description` text DEFAULT '' NOT NULL,
	`width` integer NOT NULL,
	`height` integer NOT NULL,
	`created_at` integer DEFAULT (unixepoch()) NOT NULL,
	`occurred_at` integer,
	FOREIGN KEY (`user_id`) REFERENCES `user`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`game_id`) REFERENCES `games`(`id`) ON UPDATE no action ON DELETE set null
);
--> statement-breakpoint
CREATE UNIQUE INDEX `shots_user_source_hash_unique` ON `shots` (`user_id`,`source_hash`);