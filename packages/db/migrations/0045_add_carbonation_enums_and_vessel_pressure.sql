-- Migration: Add carbonation support infrastructure
--
-- This migration prepares the database for tracking forced carbonation operations.
-- It adds:
-- 1. max_pressure field to vessels - tracks safe pressure limits
-- 2. carbonation_method enum - natural vs forced carbonation
-- 3. carbonation_process_type enum - headspace/inline/stone processes
-- 4. carbonation_quality enum - quality assessment of carbonation
--
-- These enums and fields will be used by the batch_carbonation_operations table
-- which will be created in the next migration.
--
-- References:
-- - Henry's Law: CO2 solubility increases with pressure and decreases with temperature
-- - Typical cider CO2 ranges: still <1.0, petillant 1.0-2.5, sparkling 2.5-4.0 volumes
-- - Safe pressure limits: Most tanks rated for 30 PSI working pressure

-- Step 1: Create carbonation_method enum
DO $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'carbonation_method') THEN
        CREATE TYPE carbonation_method AS ENUM (
            'natural',     -- Bottle/keg conditioning with residual sugars
            'forced',      -- Pressurized CO2 injection
            'none'         -- No carbonation
        );
        RAISE NOTICE 'Created carbonation_method enum';
    ELSE
        RAISE NOTICE 'carbonation_method enum already exists, skipping';
    END IF;
END
$$;

COMMENT ON TYPE carbonation_method IS
'Method used to carbonate cider: natural (bottle conditioning), forced (CO2 pressure), or none';

-- Step 2: Create carbonation_process_type enum
DO $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'carbonation_process_type') THEN
        CREATE TYPE carbonation_process_type AS ENUM (
            'headspace',   -- CO2 applied to headspace (most common for tanks/kegs)
            'inline',      -- CO2 injected inline during transfer
            'stone'        -- CO2 via carbonation stone in tank
        );
        RAISE NOTICE 'Created carbonation_process_type enum';
    ELSE
        RAISE NOTICE 'carbonation_process_type enum already exists, skipping';
    END IF;
END
$$;

COMMENT ON TYPE carbonation_process_type IS
'Physical process used for forced carbonation';

-- Step 3: Create carbonation_quality enum
DO $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'carbonation_quality') THEN
        CREATE TYPE carbonation_quality AS ENUM (
            'pass',                -- Target achieved, good quality
            'fail',                -- Did not carbonate properly
            'needs_adjustment',    -- Close but needs tweaking
            'in_progress'          -- Currently carbonating
        );
        RAISE NOTICE 'Created carbonation_quality enum';
    ELSE
        RAISE NOTICE 'carbonation_quality enum already exists, skipping';
    END IF;
END
$$;

COMMENT ON TYPE carbonation_quality IS
'Quality assessment of carbonation operation';

-- Step 4: Add max_pressure column to vessels table
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1
        FROM information_schema.columns
        WHERE table_name = 'vessels'
        AND column_name = 'max_pressure'
    ) THEN
        ALTER TABLE vessels
        ADD COLUMN max_pressure NUMERIC(5,1) DEFAULT 30.0;
        RAISE NOTICE 'Added max_pressure column to vessels table';
    ELSE
        RAISE NOTICE 'max_pressure column already exists in vessels table, skipping';
    END IF;
END
$$;

COMMENT ON COLUMN vessels.max_pressure IS
'Maximum safe pressure in PSI for this vessel. Default 30 PSI for standard tanks.';

-- Step 5: Backfill max_pressure for existing vessels based on pressure capability
UPDATE vessels
SET max_pressure = CASE
    WHEN is_pressure_vessel = 'yes' THEN 30.0  -- Standard pressure rating
    ELSE 5.0  -- Low pressure only (not safe for forced carbonation)
END
WHERE max_pressure IS NULL OR max_pressure = 30.0; -- Update both NULL and default values

COMMENT ON TABLE vessels IS
'Vessels used for fermentation, conditioning, and storage. Pressure vessels (is_pressure_vessel=yes) can be used for forced carbonation up to their max_pressure rating.';

-- Migration complete
DO $$
BEGIN
    RAISE NOTICE '✓ Carbonation infrastructure migration completed successfully';
    RAISE NOTICE '  - carbonation_method enum: natural, forced, none';
    RAISE NOTICE '  - carbonation_process_type enum: headspace, inline, stone';
    RAISE NOTICE '  - carbonation_quality enum: pass, fail, needs_adjustment, in_progress';
    RAISE NOTICE '  - vessels.max_pressure: Added with intelligent defaults';
END
$$;
