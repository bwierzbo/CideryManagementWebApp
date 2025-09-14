DO $$ BEGIN
 CREATE TYPE "user_role" AS ENUM('admin', 'operator');
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 CREATE TYPE "audit_operation" AS ENUM('create', 'update', 'delete', 'soft_delete', 'restore');
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
ALTER TYPE "unit" ADD VALUE 'bushel';--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "users" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"email" text NOT NULL,
	"name" text NOT NULL,
	"password_hash" text NOT NULL,
	"role" "user_role" DEFAULT 'operator' NOT NULL,
	"is_active" boolean DEFAULT true NOT NULL,
	"last_login_at" timestamp,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL,
	"deleted_at" timestamp,
	CONSTRAINT "users_email_unique" UNIQUE("email")
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "audit_logs" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"table_name" text NOT NULL,
	"record_id" uuid NOT NULL,
	"operation" "audit_operation" NOT NULL,
	"old_data" jsonb,
	"new_data" jsonb,
	"diff_data" jsonb,
	"changed_by" uuid,
	"changed_by_email" text,
	"changed_at" timestamp with time zone DEFAULT now() NOT NULL,
	"reason" text,
	"ip_address" text,
	"user_agent" text,
	"session_id" text,
	"audit_version" text DEFAULT '1.0' NOT NULL,
	"checksum" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "audit_metadata" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"metadata_type" text NOT NULL,
	"table_name" text,
	"data" jsonb NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"valid_until" timestamp with time zone
);
--> statement-breakpoint
ALTER TABLE "purchase_items" ALTER COLUMN "price_per_unit" DROP NOT NULL;--> statement-breakpoint
ALTER TABLE "purchase_items" ALTER COLUMN "total_cost" DROP NOT NULL;--> statement-breakpoint
ALTER TABLE "purchase_items" ADD COLUMN "harvest_date" date;--> statement-breakpoint
ALTER TABLE "purchase_items" ADD COLUMN "original_unit" text;--> statement-breakpoint
ALTER TABLE "purchase_items" ADD COLUMN "original_quantity" numeric(10, 2);--> statement-breakpoint
ALTER TABLE "purchases" ADD COLUMN "auto_generated_invoice" boolean DEFAULT false NOT NULL;--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "audit_logs_table_name_idx" ON "audit_logs" ("table_name");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "audit_logs_record_id_idx" ON "audit_logs" ("record_id");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "audit_logs_changed_by_idx" ON "audit_logs" ("changed_by");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "audit_logs_changed_at_idx" ON "audit_logs" ("changed_at");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "audit_logs_operation_idx" ON "audit_logs" ("operation");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "audit_logs_table_record_idx" ON "audit_logs" ("table_name","record_id");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "audit_logs_user_time_idx" ON "audit_logs" ("changed_by","changed_at");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "audit_logs_table_time_idx" ON "audit_logs" ("table_name","changed_at");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "audit_metadata_type_idx" ON "audit_metadata" ("metadata_type");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "audit_metadata_table_idx" ON "audit_metadata" ("table_name");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "audit_metadata_created_at_idx" ON "audit_metadata" ("created_at");--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "audit_logs" ADD CONSTRAINT "audit_logs_changed_by_users_id_fk" FOREIGN KEY ("changed_by") REFERENCES "users"("id") ON DELETE no action ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
