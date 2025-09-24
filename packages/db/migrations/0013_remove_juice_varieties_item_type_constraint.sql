-- Remove item_type column from juice_varieties table (it's already been dropped but might have constraint issues)
ALTER TABLE "juice_varieties" DROP COLUMN IF EXISTS "item_type";