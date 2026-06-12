PRAGMA foreign_keys=OFF;--> statement-breakpoint
CREATE TABLE `__new_agents` (
	`id` text PRIMARY KEY NOT NULL,
	`name` text NOT NULL,
	`description` text,
	`system_prompt` text,
	`provider` text DEFAULT 'anthropic' NOT NULL,
	`model` text DEFAULT 'claude-opus-4-8' NOT NULL,
	`temperature` real DEFAULT 0.7,
	`max_tokens` integer DEFAULT 4096,
	`memory_type` text DEFAULT 'buffer',
	`memory_config` text,
	`tools` text,
	`created_at` integer DEFAULT (unixepoch()),
	`updated_at` integer DEFAULT (unixepoch())
);
--> statement-breakpoint
INSERT INTO `__new_agents`("id", "name", "description", "system_prompt", "provider", "model", "temperature", "max_tokens", "memory_type", "memory_config", "tools", "created_at", "updated_at") SELECT "id", "name", "description", "system_prompt", "provider", "model", "temperature", "max_tokens", "memory_type", "memory_config", "tools", "created_at", "updated_at" FROM `agents`;--> statement-breakpoint
DROP TABLE `agents`;--> statement-breakpoint
ALTER TABLE `__new_agents` RENAME TO `agents`;--> statement-breakpoint
PRAGMA foreign_keys=ON;