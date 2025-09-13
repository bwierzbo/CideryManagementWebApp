-- Enable pgcrypto extension for UUID generation
CREATE EXTENSION IF NOT EXISTS "pgcrypto";
--> statement-breakpoint
DO $$ BEGIN
 CREATE TYPE "batch_status" AS ENUM('planned', 'active', 'completed', 'cancelled');
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
 CREATE TYPE "transaction_type" AS ENUM('purchase', 'transfer', 'adjustment', 'sale', 'waste');
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 CREATE TYPE "unit" AS ENUM('kg', 'lb', 'L', 'gal');
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
CREATE TABLE IF NOT EXISTS "apple_varieties" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"name" text NOT NULL,
	"description" text,
	"typical_brix" numeric(4, 2),
	"notes" text,
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
	"price_per_unit" numeric(8, 4) NOT NULL,
	"total_cost" numeric(10, 2) NOT NULL,
	"quantity_kg" numeric(10, 3),
	"quantity_l" numeric(10, 3),
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
	"name" text NOT NULL,
	"type" "vessel_type" NOT NULL,
	"capacity_l" numeric(10, 3) NOT NULL,
	"status" "vessel_status" DEFAULT 'available' NOT NULL,
	"location" text,
	"notes" text,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL,
	"deleted_at" timestamp
);
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
