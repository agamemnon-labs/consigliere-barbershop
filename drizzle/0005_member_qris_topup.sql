CREATE TABLE "topup_orders" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"member_id" uuid NOT NULL,
	"pay" integer NOT NULL,
	"get" integer NOT NULL,
	"status" "booking_status" DEFAULT 'pending' NOT NULL,
	"payment_id" text,
	"qr_string" text,
	"expires_at" timestamp with time zone NOT NULL,
	"paid_at" timestamp with time zone,
	"transaction_id" uuid,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "topup_orders_paymentId_unique" UNIQUE("payment_id")
);
--> statement-breakpoint
ALTER TABLE "topup_orders" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
ALTER TABLE "topup_orders" ADD CONSTRAINT "topup_orders_member_id_members_id_fk" FOREIGN KEY ("member_id") REFERENCES "public"."members"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "topup_orders" ADD CONSTRAINT "topup_orders_transaction_id_transactions_id_fk" FOREIGN KEY ("transaction_id") REFERENCES "public"."transactions"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "topup_orders_member_id_created_at_index" ON "topup_orders" USING btree ("member_id","created_at");