DO $$ BEGIN
 CREATE TYPE "press_run_status" AS ENUM('draft', 'in_progress', 'completed', 'cancelled');
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "apple_press_run_loads" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"apple_press_run_id" uuid NOT NULL,
	"purchase_item_id" uuid NOT NULL,
	"apple_variety_id" uuid NOT NULL,
	"load_sequence" integer NOT NULL,
	"apple_weight_kg" numeric(10, 3) NOT NULL,
	"original_weight" numeric(10, 3),
	"original_weight_unit" text,
	"juice_volume_l" numeric(10, 3),
	"original_volume" numeric(10, 3),
	"original_volume_unit" text,
	"brix_measured" numeric(4, 2),
	"ph_measured" numeric(3, 2),
	"notes" text,
	"pressed_at" timestamp,
	"apple_condition" text,
	"defect_percentage" numeric(4, 2),
	"created_at" timestamp DEFAULT now() NOT NULL,
	"created_by" uuid,
	"updated_at" timestamp DEFAULT now() NOT NULL,
	"updated_by" uuid,
	"deleted_at" timestamp
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "apple_press_runs" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"vendor_id" uuid NOT NULL,
	"vessel_id" uuid,
	"status" "press_run_status" DEFAULT 'draft' NOT NULL,
	"start_time" timestamp,
	"end_time" timestamp,
	"scheduled_date" date,
	"total_apple_weight_kg" numeric(10, 3),
	"total_juice_volume_l" numeric(10, 3),
	"extraction_rate" numeric(5, 4),
	"labor_hours" numeric(8, 2),
	"labor_cost_per_hour" numeric(8, 2),
	"total_labor_cost" numeric(10, 2),
	"notes" text,
	"pressing_method" text,
	"weather_conditions" text,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"created_by" uuid,
	"updated_at" timestamp DEFAULT now() NOT NULL,
	"updated_by" uuid,
	"deleted_at" timestamp
);
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "apple_press_run_loads_apple_press_run_idx" ON "apple_press_run_loads" ("apple_press_run_id");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "apple_press_run_loads_purchase_item_idx" ON "apple_press_run_loads" ("purchase_item_id");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "apple_press_run_loads_variety_idx" ON "apple_press_run_loads" ("apple_variety_id");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "apple_press_run_loads_sequence_idx" ON "apple_press_run_loads" ("apple_press_run_id","load_sequence");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "apple_press_run_loads_created_by_idx" ON "apple_press_run_loads" ("created_by");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "apple_press_run_loads_updated_by_idx" ON "apple_press_run_loads" ("updated_by");--> statement-breakpoint
CREATE UNIQUE INDEX IF NOT EXISTS "apple_press_run_loads_unique_sequence" ON "apple_press_run_loads" ("apple_press_run_id","load_sequence");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "apple_press_runs_vendor_idx" ON "apple_press_runs" ("vendor_id");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "apple_press_runs_status_idx" ON "apple_press_runs" ("status");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "apple_press_runs_scheduled_date_idx" ON "apple_press_runs" ("scheduled_date");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "apple_press_runs_start_time_idx" ON "apple_press_runs" ("start_time");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "apple_press_runs_vendor_status_idx" ON "apple_press_runs" ("vendor_id","status");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "apple_press_runs_date_status_idx" ON "apple_press_runs" ("scheduled_date","status");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "apple_press_runs_created_by_idx" ON "apple_press_runs" ("created_by");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "apple_press_runs_updated_by_idx" ON "apple_press_runs" ("updated_by");--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "apple_press_run_loads" ADD CONSTRAINT "apple_press_run_loads_apple_press_run_id_apple_press_runs_id_fk" FOREIGN KEY ("apple_press_run_id") REFERENCES "apple_press_runs"("id") ON DELETE cascade ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "apple_press_run_loads" ADD CONSTRAINT "apple_press_run_loads_purchase_item_id_purchase_items_id_fk" FOREIGN KEY ("purchase_item_id") REFERENCES "purchase_items"("id") ON DELETE no action ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "apple_press_run_loads" ADD CONSTRAINT "apple_press_run_loads_apple_variety_id_apple_varieties_id_fk" FOREIGN KEY ("apple_variety_id") REFERENCES "apple_varieties"("id") ON DELETE no action ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "apple_press_run_loads" ADD CONSTRAINT "apple_press_run_loads_created_by_users_id_fk" FOREIGN KEY ("created_by") REFERENCES "users"("id") ON DELETE no action ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "apple_press_run_loads" ADD CONSTRAINT "apple_press_run_loads_updated_by_users_id_fk" FOREIGN KEY ("updated_by") REFERENCES "users"("id") ON DELETE no action ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "apple_press_runs" ADD CONSTRAINT "apple_press_runs_vendor_id_vendors_id_fk" FOREIGN KEY ("vendor_id") REFERENCES "vendors"("id") ON DELETE no action ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "apple_press_runs" ADD CONSTRAINT "apple_press_runs_vessel_id_vessels_id_fk" FOREIGN KEY ("vessel_id") REFERENCES "vessels"("id") ON DELETE no action ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "apple_press_runs" ADD CONSTRAINT "apple_press_runs_created_by_users_id_fk" FOREIGN KEY ("created_by") REFERENCES "users"("id") ON DELETE no action ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "apple_press_runs" ADD CONSTRAINT "apple_press_runs_updated_by_users_id_fk" FOREIGN KEY ("updated_by") REFERENCES "users"("id") ON DELETE no action ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
