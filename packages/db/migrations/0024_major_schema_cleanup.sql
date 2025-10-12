-- Migration: Major Schema Cleanup
-- This migration removes unused tables and simplifies the schema based on production needs

-- ====================
-- DROP UNUSED TABLES
-- ====================

-- Drop tank-related tables (functionality moved to batch operations)
DROP TABLE IF EXISTS "tank_measurements" CASCADE;
DROP TABLE IF EXISTS "tank_additives" CASCADE;

-- Drop old press_runs and press_items (using apple_press_runs instead)
DROP TABLE IF EXISTS "press_items" CASCADE;
DROP TABLE IF EXISTS "press_runs" CASCADE;

-- Drop packaging/inventory tables (not yet in use)
DROP TABLE IF EXISTS "packages" CASCADE;
DROP TABLE IF EXISTS "inventory" CASCADE;
DROP TABLE IF EXISTS "inventory_transactions" CASCADE;

-- Drop costing tables (not yet in use)
DROP TABLE IF EXISTS "batch_costs" CASCADE;
DROP TABLE IF EXISTS "cogs_items" CASCADE;

-- ====================
-- RENAME TABLES
-- ====================

-- Rename apple_press_runs to press_runs
ALTER TABLE "apple_press_runs" RENAME TO "press_runs";

-- Rename apple_press_run_loads to press_run_loads
ALTER TABLE "apple_press_run_loads" RENAME TO "press_run_loads";

-- Update foreign key constraint names after table rename
ALTER INDEX "apple_press_run_loads_apple_press_run_idx" RENAME TO "press_run_loads_press_run_idx";
ALTER INDEX "apple_press_run_loads_purchase_item_idx" RENAME TO "press_run_loads_purchase_item_idx";
ALTER INDEX "apple_press_run_loads_variety_idx" RENAME TO "press_run_loads_variety_idx";
ALTER INDEX "apple_press_run_loads_sequence_idx" RENAME TO "press_run_loads_sequence_idx";
ALTER INDEX "apple_press_run_loads_created_by_idx" RENAME TO "press_run_loads_created_by_idx";
ALTER INDEX "apple_press_run_loads_updated_by_idx" RENAME TO "press_run_loads_updated_by_idx";
ALTER INDEX "apple_press_run_loads_unique_sequence" RENAME TO "press_run_loads_unique_sequence";

-- ====================
-- REMOVE COLUMNS FROM VENDOR VARIETY TABLES
-- ====================

-- Remove notes from vendor varieties tables
ALTER TABLE "vendor_varieties" DROP COLUMN IF EXISTS "notes";
ALTER TABLE "vendor_additive_varieties" DROP COLUMN IF EXISTS "notes";
ALTER TABLE "vendor_juice_varieties" DROP COLUMN IF EXISTS "notes";
ALTER TABLE "vendor_packaging_varieties" DROP COLUMN IF EXISTS "notes";

-- ====================
-- UPDATE BASEFRUIT_PURCHASES
-- ====================

-- Remove invoice-related fields
ALTER TABLE "basefruit_purchases" DROP COLUMN IF EXISTS "invoice_number";
ALTER TABLE "basefruit_purchases" DROP COLUMN IF EXISTS "auto_generated_invoice";

-- Add created_by and updated_by (if they don't exist)
DO $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns
                   WHERE table_name = 'basefruit_purchases'
                   AND column_name = 'created_by') THEN
        ALTER TABLE "basefruit_purchases" ADD COLUMN "created_by" uuid REFERENCES "users"("id");
    END IF;

    IF NOT EXISTS (SELECT 1 FROM information_schema.columns
                   WHERE table_name = 'basefruit_purchases'
                   AND column_name = 'updated_by') THEN
        ALTER TABLE "basefruit_purchases" ADD COLUMN "updated_by" uuid REFERENCES "users"("id");
    END IF;
END $$;

-- ====================
-- UPDATE BASEFRUIT_PURCHASE_ITEMS
-- ====================

-- Remove quantityL (only using quantityKg for solids)
ALTER TABLE "basefruit_purchase_items" DROP COLUMN IF EXISTS "quantity_l";

-- Remove original_unit (redundant with unit column)
ALTER TABLE "basefruit_purchase_items" DROP COLUMN IF EXISTS "original_unit";

-- Rename original_quantity to quantity (if it exists)
DO $$
BEGIN
    IF EXISTS (SELECT 1 FROM information_schema.columns
               WHERE table_name = 'basefruit_purchase_items'
               AND column_name = 'original_quantity') THEN
        -- Only rename if 'quantity' column doesn't already exist
        IF NOT EXISTS (SELECT 1 FROM information_schema.columns
                       WHERE table_name = 'basefruit_purchase_items'
                       AND column_name = 'quantity') THEN
            ALTER TABLE "basefruit_purchase_items" RENAME COLUMN "original_quantity" TO "quantity";
        ELSE
            -- If both exist, drop original_quantity
            ALTER TABLE "basefruit_purchase_items" DROP COLUMN "original_quantity";
        END IF;
    END IF;
END $$;

-- ====================
-- UPDATE PRESS_RUNS (formerly apple_press_runs)
-- ====================

-- Remove scheduled_date
ALTER TABLE "press_runs" DROP COLUMN IF EXISTS "scheduled_date";

-- ====================
-- UPDATE PRESS_RUN_LOADS (formerly apple_press_run_loads)
-- ====================

-- Remove measurement fields
ALTER TABLE "press_run_loads" DROP COLUMN IF EXISTS "brix_measured";
ALTER TABLE "press_run_loads" DROP COLUMN IF EXISTS "ph_measured";
ALTER TABLE "press_run_loads" DROP COLUMN IF EXISTS "pressed_at";
ALTER TABLE "press_run_loads" DROP COLUMN IF EXISTS "apple_condition";
ALTER TABLE "press_run_loads" DROP COLUMN IF EXISTS "defect_percentage";

-- Rename foreign key column to match new table name
DO $$
BEGIN
    IF EXISTS (SELECT 1 FROM information_schema.columns
               WHERE table_name = 'press_run_loads'
               AND column_name = 'apple_press_run_id') THEN
        ALTER TABLE "press_run_loads" RENAME COLUMN "apple_press_run_id" TO "press_run_id";
    END IF;
END $$;
