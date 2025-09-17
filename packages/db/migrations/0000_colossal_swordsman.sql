DO $$ BEGIN
 CREATE TYPE "batch_status" AS ENUM('planned', 'active', 'completed', 'cancelled');
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 CREATE TYPE "cider_category_enum" AS ENUM('sweet', 'bittersweet', 'sharp', 'bittersharp');
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 CREATE TYPE "cogs_item_type" AS ENUM('apple_cost', 'labor', 'overhead', 'packaging');
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 CREATE TYPE "harvest_window_enum" AS ENUM('Late', 'Mid-Late', 'Mid', 'Early-Mid', 'Early');
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 CREATE TYPE "intensity_enum" AS ENUM('high', 'medium-high', 'medium', 'low-medium', 'low');
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 CREATE TYPE "press_run_status" AS ENUM('draft', 'in_progress', 'completed', 'cancelled');
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 CREATE TYPE "transaction_type" AS ENUM('purchase', 'transfer', 'adjustment', 'sale', 'waste');
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 CREATE TYPE "unit" AS ENUM('kg', 'lb', 'L', 'gal', 'bushel');
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 CREATE TYPE "user_role" AS ENUM('admin', 'operator');
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 CREATE TYPE "vessel_jacketed" AS ENUM('yes', 'no');
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 CREATE TYPE "vessel_material" AS ENUM('stainless_steel', 'plastic');
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 CREATE TYPE "vessel_status" AS ENUM('available', 'in_use', 'cleaning', 'maintenance');
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 CREATE TYPE "vessel_type" AS ENUM('fermenter', 'conditioning_tank', 'bright_tank', 'storage');
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
	"vendor_id" uuid,
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
CREATE TABLE IF NOT EXISTS "apple_varieties" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"name" text NOT NULL,
	"cider_category" "cider_category_enum",
	"tannin" "intensity_enum",
	"acid" "intensity_enum",
	"sugar_brix" "intensity_enum",
	"harvest_window" "harvest_window_enum",
	"variety_notes" text,
	"is_active" boolean DEFAULT true NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL,
	"deleted_at" timestamp
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "audit_log" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"table_name" text NOT NULL,
	"record_id" uuid NOT NULL,
	"operation" text NOT NULL,
	"old_data" jsonb,
	"new_data" jsonb,
	"changed_by" text,
	"changed_at" timestamp DEFAULT now() NOT NULL,
	"reason" text
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "batch_costs" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"batch_id" uuid NOT NULL,
	"total_apple_cost" numeric(10, 2) NOT NULL,
	"labor_cost" numeric(10, 2) DEFAULT '0.00' NOT NULL,
	"overhead_cost" numeric(10, 2) DEFAULT '0.00' NOT NULL,
	"packaging_cost" numeric(10, 2) DEFAULT '0.00' NOT NULL,
	"total_cost" numeric(10, 2) NOT NULL,
	"cost_per_bottle" numeric(8, 4),
	"cost_per_l" numeric(8, 4),
	"calculated_at" timestamp NOT NULL,
	"notes" text,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL,
	"deleted_at" timestamp
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "batch_ingredients" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"batch_id" uuid NOT NULL,
	"press_item_id" uuid NOT NULL,
	"volume_used_l" numeric(10, 3) NOT NULL,
	"brix_at_use" numeric(4, 2),
	"notes" text,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL,
	"deleted_at" timestamp
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "batch_measurements" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"batch_id" uuid NOT NULL,
	"measurement_date" timestamp NOT NULL,
	"specific_gravity" numeric(5, 4),
	"abv" numeric(4, 2),
	"ph" numeric(3, 2),
	"total_acidity" numeric(4, 2),
	"temperature" numeric(4, 1),
	"volume_l" numeric(10, 3),
	"notes" text,
	"taken_by" text,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL,
	"deleted_at" timestamp
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "batches" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"batch_number" text NOT NULL,
	"status" "batch_status" DEFAULT 'planned' NOT NULL,
	"vessel_id" uuid,
	"start_date" timestamp NOT NULL,
	"target_completion_date" timestamp,
	"actual_completion_date" timestamp,
	"initial_volume_l" numeric(10, 3) NOT NULL,
	"current_volume_l" numeric(10, 3) NOT NULL,
	"target_abv" numeric(4, 2),
	"actual_abv" numeric(4, 2),
	"notes" text,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL,
	"deleted_at" timestamp,
	CONSTRAINT "batches_batch_number_unique" UNIQUE("batch_number")
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "cogs_items" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"batch_id" uuid NOT NULL,
	"item_type" "cogs_item_type" NOT NULL,
	"description" text NOT NULL,
	"cost" numeric(10, 2) NOT NULL,
	"quantity" numeric(10, 3),
	"unit" "unit",
	"applied_at" timestamp NOT NULL,
	"notes" text,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL,
	"deleted_at" timestamp
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "inventory" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"package_id" uuid NOT NULL,
	"current_bottle_count" integer NOT NULL,
	"reserved_bottle_count" integer DEFAULT 0 NOT NULL,
	"location" text,
	"notes" text,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL,
	"deleted_at" timestamp
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "inventory_transactions" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"inventory_id" uuid NOT NULL,
	"transaction_type" "transaction_type" NOT NULL,
	"quantity_change" integer NOT NULL,
	"transaction_date" timestamp NOT NULL,
	"reason" text,
	"notes" text,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL,
	"deleted_at" timestamp
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "packages" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"batch_id" uuid NOT NULL,
	"package_date" timestamp NOT NULL,
	"volume_packaged_l" numeric(10, 3) NOT NULL,
	"bottle_size" text NOT NULL,
	"bottle_count" integer NOT NULL,
	"abv_at_packaging" numeric(4, 2),
	"notes" text,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL,
	"deleted_at" timestamp
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "press_items" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"press_run_id" uuid NOT NULL,
	"purchase_item_id" uuid NOT NULL,
	"quantity_used_kg" numeric(10, 3) NOT NULL,
	"juice_produced_l" numeric(10, 3) NOT NULL,
	"brix_measured" numeric(4, 2),
	"notes" text,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL,
	"deleted_at" timestamp
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "press_runs" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"run_date" timestamp NOT NULL,
	"notes" text,
	"total_apple_processed_kg" numeric(10, 3) NOT NULL,
	"total_juice_produced_l" numeric(10, 3) NOT NULL,
	"extraction_rate" numeric(5, 4),
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL,
	"deleted_at" timestamp
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "purchase_items" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"purchase_id" uuid NOT NULL,
	"apple_variety_id" uuid NOT NULL,
	"quantity" numeric(10, 3) NOT NULL,
	"unit" "unit" NOT NULL,
	"price_per_unit" numeric(8, 4),
	"total_cost" numeric(10, 2),
	"quantity_kg" numeric(10, 3),
	"quantity_l" numeric(10, 3),
	"harvest_date" date,
	"original_unit" text,
	"original_quantity" numeric(10, 2),
	"notes" text,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL,
	"deleted_at" timestamp
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "purchases" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"vendor_id" uuid NOT NULL,
	"purchase_date" timestamp NOT NULL,
	"total_cost" numeric(10, 2) NOT NULL,
	"invoice_number" text,
	"auto_generated_invoice" boolean DEFAULT false NOT NULL,
	"notes" text,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL,
	"deleted_at" timestamp
);
--> statement-breakpoint
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
CREATE TABLE IF NOT EXISTS "vendor_varieties" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"vendor_id" uuid NOT NULL,
	"variety_id" uuid NOT NULL,
	"notes" text,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL,
	"deleted_at" timestamp
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "vendors" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"name" text NOT NULL,
	"contact_info" jsonb,
	"is_active" boolean DEFAULT true NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL,
	"deleted_at" timestamp
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "vessels" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"name" text,
	"type" "vessel_type",
	"capacity_l" numeric(10, 3) NOT NULL,
	"capacity_unit" "unit" DEFAULT 'L' NOT NULL,
	"material" "vessel_material",
	"jacketed" "vessel_jacketed",
	"status" "vessel_status" DEFAULT 'available' NOT NULL,
	"location" text,
	"notes" text,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL,
	"deleted_at" timestamp
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
CREATE UNIQUE INDEX IF NOT EXISTS "apple_varieties_name_unique_idx" ON "apple_varieties" ("name");--> statement-breakpoint
CREATE UNIQUE INDEX IF NOT EXISTS "vendor_varieties_vendor_variety_unique_idx" ON "vendor_varieties" ("vendor_id","variety_id");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "vendor_varieties_vendor_idx" ON "vendor_varieties" ("vendor_id");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "vendor_varieties_variety_idx" ON "vendor_varieties" ("variety_id");--> statement-breakpoint
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
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "batch_costs" ADD CONSTRAINT "batch_costs_batch_id_batches_id_fk" FOREIGN KEY ("batch_id") REFERENCES "batches"("id") ON DELETE no action ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "batch_ingredients" ADD CONSTRAINT "batch_ingredients_batch_id_batches_id_fk" FOREIGN KEY ("batch_id") REFERENCES "batches"("id") ON DELETE no action ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "batch_ingredients" ADD CONSTRAINT "batch_ingredients_press_item_id_press_items_id_fk" FOREIGN KEY ("press_item_id") REFERENCES "press_items"("id") ON DELETE no action ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "batch_measurements" ADD CONSTRAINT "batch_measurements_batch_id_batches_id_fk" FOREIGN KEY ("batch_id") REFERENCES "batches"("id") ON DELETE no action ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "batches" ADD CONSTRAINT "batches_vessel_id_vessels_id_fk" FOREIGN KEY ("vessel_id") REFERENCES "vessels"("id") ON DELETE no action ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "cogs_items" ADD CONSTRAINT "cogs_items_batch_id_batches_id_fk" FOREIGN KEY ("batch_id") REFERENCES "batches"("id") ON DELETE no action ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "inventory" ADD CONSTRAINT "inventory_package_id_packages_id_fk" FOREIGN KEY ("package_id") REFERENCES "packages"("id") ON DELETE no action ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "inventory_transactions" ADD CONSTRAINT "inventory_transactions_inventory_id_inventory_id_fk" FOREIGN KEY ("inventory_id") REFERENCES "inventory"("id") ON DELETE no action ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "packages" ADD CONSTRAINT "packages_batch_id_batches_id_fk" FOREIGN KEY ("batch_id") REFERENCES "batches"("id") ON DELETE no action ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "press_items" ADD CONSTRAINT "press_items_press_run_id_press_runs_id_fk" FOREIGN KEY ("press_run_id") REFERENCES "press_runs"("id") ON DELETE no action ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "press_items" ADD CONSTRAINT "press_items_purchase_item_id_purchase_items_id_fk" FOREIGN KEY ("purchase_item_id") REFERENCES "purchase_items"("id") ON DELETE no action ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "purchase_items" ADD CONSTRAINT "purchase_items_purchase_id_purchases_id_fk" FOREIGN KEY ("purchase_id") REFERENCES "purchases"("id") ON DELETE no action ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "purchase_items" ADD CONSTRAINT "purchase_items_apple_variety_id_apple_varieties_id_fk" FOREIGN KEY ("apple_variety_id") REFERENCES "apple_varieties"("id") ON DELETE no action ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "purchases" ADD CONSTRAINT "purchases_vendor_id_vendors_id_fk" FOREIGN KEY ("vendor_id") REFERENCES "vendors"("id") ON DELETE no action ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "vendor_varieties" ADD CONSTRAINT "vendor_varieties_vendor_id_vendors_id_fk" FOREIGN KEY ("vendor_id") REFERENCES "vendors"("id") ON DELETE cascade ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "vendor_varieties" ADD CONSTRAINT "vendor_varieties_variety_id_apple_varieties_id_fk" FOREIGN KEY ("variety_id") REFERENCES "apple_varieties"("id") ON DELETE cascade ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "audit_logs" ADD CONSTRAINT "audit_logs_changed_by_users_id_fk" FOREIGN KEY ("changed_by") REFERENCES "users"("id") ON DELETE no action ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
