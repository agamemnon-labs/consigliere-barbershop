CREATE TYPE "public"."balance_reason" AS ENUM('topup', 'bonus', 'spend', 'refund', 'adjust');--> statement-breakpoint
CREATE TYPE "public"."booking_status" AS ENUM('pending', 'paid', 'expired', 'credited', 'refunded');--> statement-breakpoint
CREATE TYPE "public"."credit_reason" AS ENUM('cancel', 'no_show', 'spend', 'expire', 'manual');--> statement-breakpoint
CREATE TYPE "public"."member_status" AS ENUM('active', 'suspended');--> statement-breakpoint
CREATE TYPE "public"."payment_method" AS ENUM('edc_card', 'edc_qris', 'online_qris', 'balance', 'credit', 'mixed');--> statement-breakpoint
CREATE TYPE "public"."price_type" AS ENUM('fixed', 'from', 'by_level', 'variant');--> statement-breakpoint
CREATE TYPE "public"."queue_source" AS ENUM('online', 'walkin');--> statement-breakpoint
CREATE TYPE "public"."queue_status" AS ENUM('waiting', 'called', 'in_service', 'done', 'no_show', 'cancelled');--> statement-breakpoint
CREATE TYPE "public"."service_category" AS ENUM('haircut', 'chemical', 'refreshment', 'package');--> statement-breakpoint
CREATE TYPE "public"."shift_status" AS ENUM('on', 'off');--> statement-breakpoint
CREATE TYPE "public"."user_role" AS ENUM('member', 'cashier', 'admin', 'owner');--> statement-breakpoint
CREATE TABLE "accounts" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" uuid NOT NULL,
	"account_id" text NOT NULL,
	"provider_id" text NOT NULL,
	"access_token" text,
	"refresh_token" text,
	"id_token" text,
	"access_token_expires_at" timestamp with time zone,
	"refresh_token_expires_at" timestamp with time zone,
	"scope" text,
	"password" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "accounts" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
CREATE TABLE "audit_log" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"actor_id" uuid,
	"action" text NOT NULL,
	"entity" text NOT NULL,
	"before" jsonb,
	"after" jsonb,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "audit_log" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
CREATE TABLE "balance_ledger" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"member_id" uuid NOT NULL,
	"delta" integer NOT NULL,
	"reason" "balance_reason" NOT NULL,
	"ref" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "balance_ledger" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
CREATE TABLE "barber_level_history" (
	"barber_id" uuid NOT NULL,
	"level_id" uuid NOT NULL,
	"effective_from" date NOT NULL,
	CONSTRAINT "barber_level_history_barber_id_effective_from_pk" PRIMARY KEY("barber_id","effective_from")
);
--> statement-breakpoint
ALTER TABLE "barber_level_history" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
CREATE TABLE "barber_levels" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"slug" text NOT NULL,
	"name" text NOT NULL,
	"haircut_price" integer NOT NULL,
	"commission_bps" integer DEFAULT 4000 NOT NULL,
	"sort" smallint NOT NULL,
	CONSTRAINT "barber_levels_slug_unique" UNIQUE("slug")
);
--> statement-breakpoint
ALTER TABLE "barber_levels" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
CREATE TABLE "barber_shifts" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"barber_id" uuid NOT NULL,
	"branch_id" uuid,
	"date" date NOT NULL,
	"start" time,
	"end" time,
	"status" "shift_status" DEFAULT 'on' NOT NULL,
	CONSTRAINT "shift_on_needs_branch" CHECK ("barber_shifts"."status" = 'off' or "barber_shifts"."branch_id" is not null)
);
--> statement-breakpoint
ALTER TABLE "barber_shifts" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
CREATE TABLE "barbers" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"slug" text NOT NULL,
	"name" text NOT NULL,
	"photo_url" text,
	"level_id" uuid NOT NULL,
	"bio" text,
	"is_active" boolean DEFAULT true NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "barbers_slug_unique" UNIQUE("slug")
);
--> statement-breakpoint
ALTER TABLE "barbers" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
CREATE TABLE "bookings" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"customer_id" uuid NOT NULL,
	"branch_id" uuid NOT NULL,
	"barber_id" uuid,
	"services" jsonb NOT NULL,
	"amount" integer NOT NULL,
	"status" "booking_status" DEFAULT 'pending' NOT NULL,
	"payment_id" text,
	"expires_at" timestamp with time zone NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "bookings_paymentId_unique" UNIQUE("payment_id")
);
--> statement-breakpoint
ALTER TABLE "bookings" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
CREATE TABLE "branches" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"slug" text NOT NULL,
	"name" text NOT NULL,
	"address" text NOT NULL,
	"maps_url" text,
	"open_hours" jsonb NOT NULL,
	"is_active" boolean DEFAULT true NOT NULL,
	CONSTRAINT "branches_slug_unique" UNIQUE("slug")
);
--> statement-breakpoint
ALTER TABLE "branches" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
CREATE TABLE "closures" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"branch_id" uuid,
	"date" date NOT NULL,
	"reason" text NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "closures" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
CREATE TABLE "credit_ledger" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"phone" text NOT NULL,
	"delta" integer NOT NULL,
	"reason" "credit_reason" NOT NULL,
	"booking_id" uuid,
	"expires_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "credit_ledger" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
CREATE TABLE "customers" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"name" text NOT NULL,
	"phone" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "customers_phone_unique" UNIQUE("phone")
);
--> statement-breakpoint
ALTER TABLE "customers" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
CREATE TABLE "display_devices" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"branch_id" uuid NOT NULL,
	"label" text NOT NULL,
	"token_hash" text NOT NULL,
	"last_seen_at" timestamp with time zone,
	"revoked_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "display_devices_tokenHash_unique" UNIQUE("token_hash")
);
--> statement-breakpoint
ALTER TABLE "display_devices" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
CREATE TABLE "members" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"customer_id" uuid NOT NULL,
	"member_no" text NOT NULL,
	"dob" date NOT NULL,
	"user_id" uuid,
	"failed_pin_attempts" smallint DEFAULT 0 NOT NULL,
	"locked_until" timestamp with time zone,
	"joined_at" timestamp with time zone DEFAULT now() NOT NULL,
	"status" "member_status" DEFAULT 'active' NOT NULL,
	CONSTRAINT "members_customerId_unique" UNIQUE("customer_id"),
	CONSTRAINT "members_memberNo_unique" UNIQUE("member_no"),
	CONSTRAINT "members_userId_unique" UNIQUE("user_id")
);
--> statement-breakpoint
ALTER TABLE "members" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
CREATE TABLE "outbox" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"channel" text DEFAULT 'whatsapp' NOT NULL,
	"to" text NOT NULL,
	"body" text NOT NULL,
	"sent_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "outbox" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
CREATE TABLE "package_items" (
	"package_id" uuid NOT NULL,
	"service_id" uuid NOT NULL,
	CONSTRAINT "package_items_package_id_service_id_pk" PRIMARY KEY("package_id","service_id")
);
--> statement-breakpoint
ALTER TABLE "package_items" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
CREATE TABLE "point_ledger" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"member_id" uuid NOT NULL,
	"delta" integer NOT NULL,
	"reason" text NOT NULL,
	"transaction_id" uuid,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "point_ledger" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
CREATE TABLE "queue_entries" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"branch_id" uuid NOT NULL,
	"barber_id" uuid NOT NULL,
	"date" date NOT NULL,
	"position" integer NOT NULL,
	"ticket_no" integer NOT NULL,
	"customer_id" uuid,
	"display_name" text,
	"source" "queue_source" NOT NULL,
	"status" "queue_status" DEFAULT 'waiting' NOT NULL,
	"called_at" timestamp with time zone,
	"grace_until" timestamp with time zone,
	"started_at" timestamp with time zone,
	"finished_at" timestamp with time zone,
	"late_moves" smallint DEFAULT 0 NOT NULL,
	"booking_id" uuid,
	"estimated_min" smallint NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "queue_entries" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
CREATE TABLE "rate_limits" (
	"id" text PRIMARY KEY NOT NULL,
	"key" text NOT NULL,
	"count" integer NOT NULL,
	"last_request" bigint NOT NULL,
	CONSTRAINT "rate_limits_key_unique" UNIQUE("key")
);
--> statement-breakpoint
ALTER TABLE "rate_limits" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
CREATE TABLE "service_variants" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"service_id" uuid NOT NULL,
	"name" text NOT NULL,
	"price" integer NOT NULL,
	"duration_min" smallint NOT NULL,
	"sort" smallint DEFAULT 0 NOT NULL
);
--> statement-breakpoint
ALTER TABLE "service_variants" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
CREATE TABLE "services" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"slug" text NOT NULL,
	"category" "service_category" NOT NULL,
	"name" text NOT NULL,
	"description" text,
	"duration_min" smallint NOT NULL,
	"price_type" "price_type" NOT NULL,
	"price" integer,
	"price_from" integer,
	"sort" smallint DEFAULT 0 NOT NULL,
	"is_active" boolean DEFAULT true NOT NULL,
	CONSTRAINT "services_slug_unique" UNIQUE("slug")
);
--> statement-breakpoint
ALTER TABLE "services" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
CREATE TABLE "sessions" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" uuid NOT NULL,
	"token" text NOT NULL,
	"expires_at" timestamp with time zone NOT NULL,
	"ip_address" text,
	"user_agent" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "sessions_token_unique" UNIQUE("token")
);
--> statement-breakpoint
ALTER TABLE "sessions" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
CREATE TABLE "settings" (
	"key" text PRIMARY KEY NOT NULL,
	"value" jsonb NOT NULL
);
--> statement-breakpoint
ALTER TABLE "settings" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
CREATE TABLE "topup_packages" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"pay" integer NOT NULL,
	"get" integer NOT NULL,
	"is_active" boolean DEFAULT true NOT NULL
);
--> statement-breakpoint
ALTER TABLE "topup_packages" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
CREATE TABLE "transactions" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"branch_id" uuid NOT NULL,
	"barber_id" uuid,
	"customer_id" uuid,
	"member_id" uuid,
	"queue_entry_id" uuid,
	"items" jsonb NOT NULL,
	"subtotal" integer NOT NULL,
	"discounts" integer DEFAULT 0 NOT NULL,
	"total" integer NOT NULL,
	"method" "payment_method" NOT NULL,
	"cashier_id" uuid,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "transactions" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
CREATE TABLE "users" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"name" text NOT NULL,
	"email" text NOT NULL,
	"email_verified" boolean DEFAULT false NOT NULL,
	"image" text,
	"role" "user_role" DEFAULT 'member' NOT NULL,
	"branch_id" uuid,
	"is_active" boolean DEFAULT true NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "users_email_unique" UNIQUE("email")
);
--> statement-breakpoint
ALTER TABLE "users" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
CREATE TABLE "verifications" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"identifier" text NOT NULL,
	"value" text NOT NULL,
	"expires_at" timestamp with time zone NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "verifications" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
ALTER TABLE "accounts" ADD CONSTRAINT "accounts_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "audit_log" ADD CONSTRAINT "audit_log_actor_id_users_id_fk" FOREIGN KEY ("actor_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "balance_ledger" ADD CONSTRAINT "balance_ledger_member_id_members_id_fk" FOREIGN KEY ("member_id") REFERENCES "public"."members"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "barber_level_history" ADD CONSTRAINT "barber_level_history_barber_id_barbers_id_fk" FOREIGN KEY ("barber_id") REFERENCES "public"."barbers"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "barber_level_history" ADD CONSTRAINT "barber_level_history_level_id_barber_levels_id_fk" FOREIGN KEY ("level_id") REFERENCES "public"."barber_levels"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "barber_shifts" ADD CONSTRAINT "barber_shifts_barber_id_barbers_id_fk" FOREIGN KEY ("barber_id") REFERENCES "public"."barbers"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "barber_shifts" ADD CONSTRAINT "barber_shifts_branch_id_branches_id_fk" FOREIGN KEY ("branch_id") REFERENCES "public"."branches"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "barbers" ADD CONSTRAINT "barbers_level_id_barber_levels_id_fk" FOREIGN KEY ("level_id") REFERENCES "public"."barber_levels"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "bookings" ADD CONSTRAINT "bookings_customer_id_customers_id_fk" FOREIGN KEY ("customer_id") REFERENCES "public"."customers"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "bookings" ADD CONSTRAINT "bookings_branch_id_branches_id_fk" FOREIGN KEY ("branch_id") REFERENCES "public"."branches"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "bookings" ADD CONSTRAINT "bookings_barber_id_barbers_id_fk" FOREIGN KEY ("barber_id") REFERENCES "public"."barbers"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "closures" ADD CONSTRAINT "closures_branch_id_branches_id_fk" FOREIGN KEY ("branch_id") REFERENCES "public"."branches"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "credit_ledger" ADD CONSTRAINT "credit_ledger_booking_id_bookings_id_fk" FOREIGN KEY ("booking_id") REFERENCES "public"."bookings"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "display_devices" ADD CONSTRAINT "display_devices_branch_id_branches_id_fk" FOREIGN KEY ("branch_id") REFERENCES "public"."branches"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "members" ADD CONSTRAINT "members_customer_id_customers_id_fk" FOREIGN KEY ("customer_id") REFERENCES "public"."customers"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "members" ADD CONSTRAINT "members_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "package_items" ADD CONSTRAINT "package_items_package_id_services_id_fk" FOREIGN KEY ("package_id") REFERENCES "public"."services"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "package_items" ADD CONSTRAINT "package_items_service_id_services_id_fk" FOREIGN KEY ("service_id") REFERENCES "public"."services"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "point_ledger" ADD CONSTRAINT "point_ledger_member_id_members_id_fk" FOREIGN KEY ("member_id") REFERENCES "public"."members"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "point_ledger" ADD CONSTRAINT "point_ledger_transaction_id_transactions_id_fk" FOREIGN KEY ("transaction_id") REFERENCES "public"."transactions"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "queue_entries" ADD CONSTRAINT "queue_entries_branch_id_branches_id_fk" FOREIGN KEY ("branch_id") REFERENCES "public"."branches"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "queue_entries" ADD CONSTRAINT "queue_entries_barber_id_barbers_id_fk" FOREIGN KEY ("barber_id") REFERENCES "public"."barbers"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "queue_entries" ADD CONSTRAINT "queue_entries_customer_id_customers_id_fk" FOREIGN KEY ("customer_id") REFERENCES "public"."customers"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "queue_entries" ADD CONSTRAINT "queue_entries_booking_id_bookings_id_fk" FOREIGN KEY ("booking_id") REFERENCES "public"."bookings"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "service_variants" ADD CONSTRAINT "service_variants_service_id_services_id_fk" FOREIGN KEY ("service_id") REFERENCES "public"."services"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "sessions" ADD CONSTRAINT "sessions_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "transactions" ADD CONSTRAINT "transactions_branch_id_branches_id_fk" FOREIGN KEY ("branch_id") REFERENCES "public"."branches"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "transactions" ADD CONSTRAINT "transactions_barber_id_barbers_id_fk" FOREIGN KEY ("barber_id") REFERENCES "public"."barbers"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "transactions" ADD CONSTRAINT "transactions_customer_id_customers_id_fk" FOREIGN KEY ("customer_id") REFERENCES "public"."customers"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "transactions" ADD CONSTRAINT "transactions_member_id_members_id_fk" FOREIGN KEY ("member_id") REFERENCES "public"."members"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "transactions" ADD CONSTRAINT "transactions_queue_entry_id_queue_entries_id_fk" FOREIGN KEY ("queue_entry_id") REFERENCES "public"."queue_entries"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "transactions" ADD CONSTRAINT "transactions_cashier_id_users_id_fk" FOREIGN KEY ("cashier_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "users" ADD CONSTRAINT "users_branch_id_branches_id_fk" FOREIGN KEY ("branch_id") REFERENCES "public"."branches"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "accounts_user_id_index" ON "accounts" USING btree ("user_id");--> statement-breakpoint
CREATE INDEX "audit_log_entity_created_at_index" ON "audit_log" USING btree ("entity","created_at");--> statement-breakpoint
CREATE INDEX "balance_ledger_member_id_index" ON "balance_ledger" USING btree ("member_id");--> statement-breakpoint
CREATE UNIQUE INDEX "barber_shifts_barber_id_date_index" ON "barber_shifts" USING btree ("barber_id","date");--> statement-breakpoint
CREATE INDEX "barber_shifts_branch_id_date_index" ON "barber_shifts" USING btree ("branch_id","date");--> statement-breakpoint
CREATE INDEX "bookings_status_expires_at_index" ON "bookings" USING btree ("status","expires_at");--> statement-breakpoint
CREATE INDEX "closures_date_index" ON "closures" USING btree ("date");--> statement-breakpoint
CREATE INDEX "credit_ledger_phone_index" ON "credit_ledger" USING btree ("phone");--> statement-breakpoint
CREATE INDEX "point_ledger_member_id_index" ON "point_ledger" USING btree ("member_id");--> statement-breakpoint
CREATE INDEX "queue_entries_barber_id_date_position_index" ON "queue_entries" USING btree ("barber_id","date","position");--> statement-breakpoint
CREATE UNIQUE INDEX "queue_entries_branch_id_date_ticket_no_index" ON "queue_entries" USING btree ("branch_id","date","ticket_no");--> statement-breakpoint
CREATE INDEX "sessions_user_id_index" ON "sessions" USING btree ("user_id");--> statement-breakpoint
CREATE INDEX "transactions_branch_id_created_at_index" ON "transactions" USING btree ("branch_id","created_at");--> statement-breakpoint
CREATE INDEX "transactions_barber_id_created_at_index" ON "transactions" USING btree ("barber_id","created_at");--> statement-breakpoint
CREATE INDEX "verifications_identifier_index" ON "verifications" USING btree ("identifier");