-- Migration: Update Red Currant additive purchase to 48 lb at $5/lb
-- Red Currant stays in additive tables (type "Fruit / Fruit Product") since
-- the AddBatchAdditiveForm pulls from additive inventory for cellar additions.
-- Base fruit tables are only for pressing operations.

-- Add 'berry' to the fruit_type enum for future use
ALTER TYPE "fruit_type" ADD VALUE 'berry';

-- Update Red Currant purchase: 48 lb at $5/lb, reset usage
UPDATE "additive_purchase_items"
SET "quantity" = 48, "price_per_unit" = 5.0000, "total_cost" = 240.00, "quantity_used" = 0,
    "updated_at" = NOW()
WHERE "id" = '7a302f97-797b-41cb-ba14-6b1c874ad46e';
