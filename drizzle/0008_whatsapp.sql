CREATE TYPE "public"."outbox_status" AS ENUM('pending', 'sent', 'failed', 'logged', 'skipped');--> statement-breakpoint
ALTER TABLE "outbox" ADD COLUMN "kind" text;--> statement-breakpoint
ALTER TABLE "outbox" ADD COLUMN "params" jsonb;--> statement-breakpoint
ALTER TABLE "outbox" ADD COLUMN "status" "outbox_status" DEFAULT 'logged' NOT NULL;--> statement-breakpoint
ALTER TABLE "outbox" ADD COLUMN "provider_id" text;--> statement-breakpoint
ALTER TABLE "outbox" ADD COLUMN "error" text;--> statement-breakpoint
ALTER TABLE "queue_entries" ADD COLUMN "near_alert_at" timestamp with time zone;--> statement-breakpoint
CREATE INDEX "outbox_to_created_at_index" ON "outbox" USING btree ("to","created_at");