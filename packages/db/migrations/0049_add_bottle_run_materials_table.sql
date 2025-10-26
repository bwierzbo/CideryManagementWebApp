-- Migration: Add bottle_run_materials table for tracking packaging materials used in bottle runs
-- This allows tracking multiple packaging materials (bottles, caps, labels, etc.) per bottle run

-- Create the bottle_run_materials table
CREATE TABLE IF NOT EXISTS "bottle_run_materials" (
    "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
    "bottle_run_id" uuid NOT NULL,
    "packaging_purchase_item_id" uuid NOT NULL,
    "quantity_used" integer NOT NULL,
    "material_type" text NOT NULL,
    "created_at" timestamp DEFAULT now() NOT NULL,
    "created_by" uuid NOT NULL
);

-- Create indexes for performance
CREATE INDEX IF NOT EXISTS "bottle_run_materials_bottle_run_idx" ON "bottle_run_materials" ("bottle_run_id");
CREATE INDEX IF NOT EXISTS "bottle_run_materials_packaging_item_idx" ON "bottle_run_materials" ("packaging_purchase_item_id");

-- Add foreign key constraint to bottle_runs (cascade delete)
DO $$ BEGIN
    ALTER TABLE "bottle_run_materials"
    ADD CONSTRAINT "bottle_run_materials_bottle_run_id_bottle_runs_id_fk"
    FOREIGN KEY ("bottle_run_id")
    REFERENCES "bottle_runs"("id")
    ON DELETE CASCADE
    ON UPDATE NO ACTION;
EXCEPTION
    WHEN duplicate_object THEN null;
END $$;

-- Add foreign key constraint to packaging_purchase_items
DO $$ BEGIN
    ALTER TABLE "bottle_run_materials"
    ADD CONSTRAINT "bottle_run_materials_packaging_purchase_item_id_packaging_purchase_items_id_fk"
    FOREIGN KEY ("packaging_purchase_item_id")
    REFERENCES "packaging_purchase_items"("id")
    ON DELETE NO ACTION
    ON UPDATE NO ACTION;
EXCEPTION
    WHEN duplicate_object THEN null;
END $$;

-- Add foreign key constraint to users table for created_by
DO $$ BEGIN
    ALTER TABLE "bottle_run_materials"
    ADD CONSTRAINT "bottle_run_materials_created_by_users_id_fk"
    FOREIGN KEY ("created_by")
    REFERENCES "users"("id")
    ON DELETE NO ACTION
    ON UPDATE NO ACTION;
EXCEPTION
    WHEN duplicate_object THEN null;
END $$;
