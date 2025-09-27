-- Migration: 0016_inventory_juice_improvements
-- Description: Add purchase date to inventory items and pH/SG columns to juice purchase items
--
-- This migration adds:
-- 1. Purchase date column to inventory_items for better traceability
-- 2. pH and specific gravity columns to juice_purchase_items instead of storing in notes
-- 3. Appropriate indexes for the new columns

-- Add purchase date to inventory items
-- This represents the weighted average purchase date of raw materials in the batch
ALTER TABLE "inventory_items"
ADD COLUMN IF NOT EXISTS "purchase_date" date;

-- Add index for purchase date queries
CREATE INDEX IF NOT EXISTS "inventory_items_purchase_date_idx"
ON "inventory_items" ("purchase_date");

-- Add pH column to juice purchase items (instead of storing in notes)
ALTER TABLE "juice_purchase_items"
ADD COLUMN IF NOT EXISTS "ph" decimal(3,2);

-- Add specific gravity column to juice purchase items
ALTER TABLE "juice_purchase_items"
ADD COLUMN IF NOT EXISTS "specific_gravity" decimal(5,4);

-- Add indexes for the new juice measurement columns
CREATE INDEX IF NOT EXISTS "juice_purchase_items_ph_idx"
ON "juice_purchase_items" ("ph");

CREATE INDEX IF NOT EXISTS "juice_purchase_items_sg_idx"
ON "juice_purchase_items" ("specific_gravity");

-- Add composite index for quality measurements
CREATE INDEX IF NOT EXISTS "juice_purchase_items_quality_idx"
ON "juice_purchase_items" ("ph", "specific_gravity", "brix");

-- Update table statistics
ANALYZE "inventory_items";
ANALYZE "juice_purchase_items";

-- Add comments for the new columns
COMMENT ON COLUMN "inventory_items"."purchase_date" IS 'Weighted average purchase date of raw materials in the batch';
COMMENT ON COLUMN "juice_purchase_items"."ph" IS 'pH measurement of the juice at time of purchase';
COMMENT ON COLUMN "juice_purchase_items"."specific_gravity" IS 'Specific gravity measurement of the juice at time of purchase';