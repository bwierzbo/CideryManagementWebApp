-- Migration: Batch Schema with Provenance Tracking
-- Replace old batch tables with new schema that includes complete provenance

-- Update batch_status enum
ALTER TYPE "batch_status" RENAME TO "batch_status_old";
CREATE TYPE "batch_status" AS ENUM('planned', 'active', 'packaged');

-- Create juice_lots table
CREATE TABLE IF NOT EXISTS "juice_lots" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"press_run_id" uuid NOT NULL,
	"volume_l" numeric(10,3) NOT NULL,
	"brix" numeric(5,2),
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL,
	"deleted_at" timestamp
);

-- Create new batches table (backup old data first)
CREATE TABLE IF NOT EXISTS "batches_backup" AS SELECT * FROM "batches";

-- Drop old batch-related tables
DROP TABLE IF EXISTS "batch_ingredients" CASCADE;
DROP TABLE IF EXISTS "batch_measurements" CASCADE; -- We'll recreate this with proper relations
DROP TABLE IF EXISTS "batch_costs" CASCADE; -- We'll recreate this with proper relations
DROP TABLE IF EXISTS "batches" CASCADE;

-- Create new batches table
CREATE TABLE IF NOT EXISTS "batches" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"juice_lot_id" uuid,
	"vessel_id" uuid,
	"name" text NOT NULL,
	"status" "batch_status" DEFAULT 'active' NOT NULL,
	"start_date" timestamp with time zone DEFAULT now() NOT NULL,
	"end_date" timestamp with time zone,
	"origin_press_run_id" uuid,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL,
	"deleted_at" timestamp,
	CONSTRAINT "batches_name_unique" UNIQUE("name")
);

-- Create batch_compositions table
CREATE TABLE IF NOT EXISTS "batch_compositions" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"batch_id" uuid NOT NULL,
	"purchase_item_id" uuid NOT NULL,
	"vendor_id" uuid NOT NULL,
	"variety_id" uuid NOT NULL,
	"lot_code" text,
	"input_weight_kg" numeric(12,3) NOT NULL,
	"juice_volume_l" numeric(12,3) NOT NULL,
	"fraction_of_batch" numeric(8,6) NOT NULL,
	"material_cost" numeric(12,2) NOT NULL,
	"avg_brix" numeric(5,2),
	"est_sugar_kg" numeric(12,3),
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL,
	"deleted_at" timestamp,
	CONSTRAINT "batch_compositions_batch_purchase_item_unique_idx" UNIQUE("batch_id","purchase_item_id"),
	CONSTRAINT "batch_compositions_input_weight_kg_check" CHECK (input_weight_kg >= 0),
	CONSTRAINT "batch_compositions_juice_volume_l_check" CHECK (juice_volume_l >= 0),
	CONSTRAINT "batch_compositions_fraction_of_batch_check" CHECK (fraction_of_batch >= 0 AND fraction_of_batch <= 1),
	CONSTRAINT "batch_compositions_material_cost_check" CHECK (material_cost >= 0)
);

-- Recreate batch_measurements table with proper relations
CREATE TABLE IF NOT EXISTS "batch_measurements" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"batch_id" uuid NOT NULL,
	"measurement_date" timestamp NOT NULL,
	"specific_gravity" numeric(6,4),
	"ph" numeric(4,2),
	"temperature_c" numeric(5,2),
	"abv" numeric(4,2),
	"notes" text,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL,
	"deleted_at" timestamp
);

-- Recreate batch_costs table with proper relations
CREATE TABLE IF NOT EXISTS "batch_costs" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"batch_id" uuid NOT NULL,
	"cost_type" text NOT NULL,
	"amount" numeric(12,2) NOT NULL,
	"description" text,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL,
	"deleted_at" timestamp
);

-- Add foreign key constraints
DO $$ BEGIN
 ALTER TABLE "juice_lots" ADD CONSTRAINT "juice_lots_press_run_id_press_runs_id_fk" FOREIGN KEY ("press_run_id") REFERENCES "press_runs"("id") ON DELETE no action ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;

DO $$ BEGIN
 ALTER TABLE "batches" ADD CONSTRAINT "batches_juice_lot_id_juice_lots_id_fk" FOREIGN KEY ("juice_lot_id") REFERENCES "juice_lots"("id") ON DELETE no action ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;

DO $$ BEGIN
 ALTER TABLE "batches" ADD CONSTRAINT "batches_vessel_id_vessels_id_fk" FOREIGN KEY ("vessel_id") REFERENCES "vessels"("id") ON DELETE no action ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;

DO $$ BEGIN
 ALTER TABLE "batches" ADD CONSTRAINT "batches_origin_press_run_id_press_runs_id_fk" FOREIGN KEY ("origin_press_run_id") REFERENCES "press_runs"("id") ON DELETE no action ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;

DO $$ BEGIN
 ALTER TABLE "batch_compositions" ADD CONSTRAINT "batch_compositions_batch_id_batches_id_fk" FOREIGN KEY ("batch_id") REFERENCES "batches"("id") ON DELETE cascade ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;

DO $$ BEGIN
 ALTER TABLE "batch_compositions" ADD CONSTRAINT "batch_compositions_purchase_item_id_purchase_items_id_fk" FOREIGN KEY ("purchase_item_id") REFERENCES "purchase_items"("id") ON DELETE no action ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;

DO $$ BEGIN
 ALTER TABLE "batch_compositions" ADD CONSTRAINT "batch_compositions_vendor_id_vendors_id_fk" FOREIGN KEY ("vendor_id") REFERENCES "vendors"("id") ON DELETE no action ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;

DO $$ BEGIN
 ALTER TABLE "batch_compositions" ADD CONSTRAINT "batch_compositions_variety_id_base_fruit_varieties_id_fk" FOREIGN KEY ("variety_id") REFERENCES "base_fruit_varieties"("id") ON DELETE no action ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;

DO $$ BEGIN
 ALTER TABLE "batch_measurements" ADD CONSTRAINT "batch_measurements_batch_id_batches_id_fk" FOREIGN KEY ("batch_id") REFERENCES "batches"("id") ON DELETE no action ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;

DO $$ BEGIN
 ALTER TABLE "batch_costs" ADD CONSTRAINT "batch_costs_batch_id_batches_id_fk" FOREIGN KEY ("batch_id") REFERENCES "batches"("id") ON DELETE no action ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;

-- Create indexes
CREATE INDEX IF NOT EXISTS "juice_lots_press_run_idx" ON "juice_lots" ("press_run_id");
CREATE INDEX IF NOT EXISTS "batches_vessel_idx" ON "batches" ("vessel_id");
CREATE INDEX IF NOT EXISTS "batches_status_idx" ON "batches" ("status");
CREATE INDEX IF NOT EXISTS "batches_origin_press_run_idx" ON "batches" ("origin_press_run_id");
CREATE INDEX IF NOT EXISTS "batch_compositions_batch_idx" ON "batch_compositions" ("batch_id");
CREATE INDEX IF NOT EXISTS "batch_compositions_purchase_item_idx" ON "batch_compositions" ("purchase_item_id");

-- Clean up old enum
DROP TYPE "batch_status_old";