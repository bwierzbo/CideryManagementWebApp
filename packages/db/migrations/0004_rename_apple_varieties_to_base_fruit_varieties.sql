-- Create fruit_type enum
CREATE TYPE "fruit_type" AS ENUM('apple', 'pear', 'plum');

-- Rename table
ALTER TABLE "apple_varieties" RENAME TO "base_fruit_varieties";

-- Add fruit_type column with default 'apple'
ALTER TABLE "base_fruit_varieties" ADD COLUMN "fruit_type" "fruit_type" DEFAULT 'apple' NOT NULL;

-- Update column names in related tables
ALTER TABLE "purchase_items" RENAME COLUMN "apple_variety_id" TO "fruit_variety_id";
ALTER TABLE "apple_press_run_loads" RENAME COLUMN "apple_variety_id" TO "fruit_variety_id";

-- Rename indexes
ALTER INDEX "apple_varieties_name_unique_idx" RENAME TO "base_fruit_varieties_name_unique_idx";