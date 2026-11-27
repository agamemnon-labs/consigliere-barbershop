CREATE TABLE "chat_messages" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"channel" text NOT NULL,
	"chat_id" text NOT NULL,
	"role" text NOT NULL,
	"body" text NOT NULL,
	"brain" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "chat_messages" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
CREATE INDEX "chat_messages_channel_chat_id_created_at_index" ON "chat_messages" USING btree ("channel","chat_id","created_at");--> statement-breakpoint
CREATE INDEX "chat_messages_created_at_index" ON "chat_messages" USING btree ("created_at");