-- Add fruit_type enum and column to existing basefruit_varieties table
-- This assumes you have already renamed apple_varieties to basefruit_varieties

-- Create the enum type if it doesn't exist
DO $$ BEGIN
    CREATE TYPE "fruit_type" AS ENUM('apple', 'pear', 'plum');
EXCEPTION
    WHEN duplicate_object THEN null;
END $$;

-- Add the fruit_type column to the existing table
ALTER TABLE "basefruit_varieties"
ADD COLUMN IF NOT EXISTS "fruit_type" "fruit_type" DEFAULT 'apple' NOT NULL;

-- Update the foreign key constraint names if they exist
-- (These may have been updated when you renamed the table)
DO $$ BEGIN
    -- Update foreign keys that reference the varieties table
    IF EXISTS (SELECT 1 FROM information_schema.table_constraints
              WHERE constraint_name = 'purchase_items_apple_variety_id_apple_varieties_id_fk') THEN
        ALTER TABLE "purchase_items"
        RENAME CONSTRAINT "purchase_items_apple_variety_id_apple_varieties_id_fk"
        TO "purchase_items_fruit_variety_id_basefruit_varieties_id_fk";
    END IF;

    IF EXISTS (SELECT 1 FROM information_schema.table_constraints
              WHERE constraint_name = 'apple_press_run_loads_apple_variety_id_apple_varieties_id_fk') THEN
        ALTER TABLE "apple_press_run_loads"
        RENAME CONSTRAINT "apple_press_run_loads_apple_variety_id_apple_varieties_id_fk"
        TO "apple_press_run_loads_fruit_variety_id_basefruit_varieties_id_fk";
    END IF;

    IF EXISTS (SELECT 1 FROM information_schema.table_constraints
              WHERE constraint_name = 'vendor_varieties_variety_id_apple_varieties_id_fk') THEN
        ALTER TABLE "vendor_varieties"
        RENAME CONSTRAINT "vendor_varieties_variety_id_apple_varieties_id_fk"
        TO "vendor_varieties_variety_id_basefruit_varieties_id_fk";
    END IF;
EXCEPTION
    WHEN others THEN null;
END $$;