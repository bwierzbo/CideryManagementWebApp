-- Create the packaging item type enum
CREATE TYPE "packaging_item_type" AS ENUM('Primary Packaging', 'Closures', 'Secondary Packaging', 'Tertiary Packaging');

-- Add a temporary column with the new enum type
ALTER TABLE "packaging_varieties" ADD COLUMN "item_type_enum" "packaging_item_type";

-- Update the new column based on existing values
-- Map existing free-text values to closest enum equivalents
UPDATE "packaging_varieties" SET "item_type_enum" =
  CASE
    WHEN "item_type" ILIKE '%bottle%' OR "item_type" ILIKE '%can%' OR "item_type" ILIKE '%keg%' OR "item_type" ILIKE '%pouch%' THEN 'Primary Packaging'
    WHEN "item_type" ILIKE '%cap%' OR "item_type" ILIKE '%cork%' OR "item_type" ILIKE '%lid%' OR "item_type" ILIKE '%closure%' THEN 'Closures'
    WHEN "item_type" ILIKE '%label%' OR "item_type" ILIKE '%shrink%' OR "item_type" ILIKE '%wrap%' OR "item_type" ILIKE '%sleeve%' THEN 'Secondary Packaging'
    WHEN "item_type" ILIKE '%case%' OR "item_type" ILIKE '%box%' OR "item_type" ILIKE '%carton%' OR "item_type" ILIKE '%pallet%' THEN 'Tertiary Packaging'
    ELSE 'Primary Packaging' -- Default for any unmapped values
  END;

-- Make the new column NOT NULL now that all rows have values
ALTER TABLE "packaging_varieties" ALTER COLUMN "item_type_enum" SET NOT NULL;

-- Drop the old column
ALTER TABLE "packaging_varieties" DROP COLUMN "item_type";

-- Rename the new column to replace the old one
ALTER TABLE "packaging_varieties" RENAME COLUMN "item_type_enum" TO "item_type";