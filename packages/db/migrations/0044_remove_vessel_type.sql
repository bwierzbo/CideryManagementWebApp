-- Migration: Remove vessel_type enum and type column from vessels
--
-- RATIONALE:
-- The vessel_type enum is too restrictive for real-world cidery operations.
-- Vessels should be identified by their capabilities (is_pressure_vessel, jacketed)
-- and properties (capacity, material) rather than rigid type categories.
--
-- After this migration, vessels will be identified by:
-- - is_pressure_vessel (can handle carbonation)
-- - jacketed (has temperature control)
-- - capacity & capacity_unit (size)
-- - material (construction)
-- - name (descriptive, e.g., "Fermentation Tank 1", "Bright Tank A")
--
-- This provides more flexibility and better reflects actual cidery operations.

-- Step 1: Check if the column exists before attempting to drop it
DO $$
BEGIN
    -- Drop the type column from vessels table if it exists
    IF EXISTS (
        SELECT 1
        FROM information_schema.columns
        WHERE table_name = 'vessels'
        AND column_name = 'type'
    ) THEN
        ALTER TABLE vessels DROP COLUMN type;
        RAISE NOTICE 'Dropped type column from vessels table';
    ELSE
        RAISE NOTICE 'Column type does not exist in vessels table, skipping';
    END IF;
END
$$;

-- Step 2: Drop the vessel_type enum type if it exists
DO $$
BEGIN
    IF EXISTS (
        SELECT 1
        FROM pg_type
        WHERE typname = 'vessel_type'
    ) THEN
        DROP TYPE vessel_type;
        RAISE NOTICE 'Dropped vessel_type enum';
    ELSE
        RAISE NOTICE 'Type vessel_type does not exist, skipping';
    END IF;
END
$$;

-- Migration is complete
--
-- ROLLBACK STRATEGY:
-- This migration is intentionally one-way. If you need to revert:
-- 1. Recreate the enum: CREATE TYPE vessel_type AS ENUM ('fermenter', 'conditioning_tank', 'bright_tank', 'storage');
-- 2. Add the column back: ALTER TABLE vessels ADD COLUMN type vessel_type;
-- 3. Backfill type values based on vessel names or manual classification
--
-- However, we do NOT recommend reverting this migration as the new approach is more flexible.
