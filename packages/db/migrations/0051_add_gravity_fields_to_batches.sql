-- Migration: Add gravity fields for ABV tracking
--
-- This migration adds:
-- 1. originalGravity - Specific gravity reading when batch starts
-- 2. finalGravity - Specific gravity reading when fermentation completes
-- 3. estimatedAbv - Calculated ABV assuming complete fermentation (OG to 1.000)
-- 4. actualAbv - Calculated ABV from OG and FG readings
--
-- ABV Formula: ABV% = (OG - FG) × 131.25

BEGIN;

-- ==========================================
-- 1. ADD GRAVITY MEASUREMENT FIELDS
-- ==========================================

ALTER TABLE batches
    ADD COLUMN IF NOT EXISTS original_gravity NUMERIC(5,3),
    ADD COLUMN IF NOT EXISTS final_gravity NUMERIC(5,3);

COMMENT ON COLUMN batches.original_gravity IS
    'Original specific gravity reading at start of fermentation (e.g., 1.050). Used to calculate potential and actual ABV.';

COMMENT ON COLUMN batches.final_gravity IS
    'Final specific gravity reading after fermentation completes (e.g., 1.000). Used with OG to calculate actual ABV.';

-- ==========================================
-- 2. ADD CALCULATED ABV FIELDS
-- ==========================================

ALTER TABLE batches
    ADD COLUMN IF NOT EXISTS estimated_abv NUMERIC(4,2),
    ADD COLUMN IF NOT EXISTS actual_abv NUMERIC(4,2);

COMMENT ON COLUMN batches.estimated_abv IS
    'Estimated ABV assuming complete fermentation to 1.000 SG. Calculated as: (original_gravity - 1.000) × 131.25. Shows potential alcohol content.';

COMMENT ON COLUMN batches.actual_abv IS
    'Actual ABV calculated from OG and FG readings. Formula: (original_gravity - final_gravity) × 131.25. NULL until final gravity is recorded.';

-- ==========================================
-- 3. ADD CONSTRAINTS
-- ==========================================

-- Gravity readings must be in realistic fermentation range (0.980 to 1.200)
ALTER TABLE batches
    ADD CONSTRAINT check_original_gravity_range
        CHECK (original_gravity IS NULL OR (original_gravity >= 0.980 AND original_gravity <= 1.200));

ALTER TABLE batches
    ADD CONSTRAINT check_final_gravity_range
        CHECK (final_gravity IS NULL OR (final_gravity >= 0.980 AND final_gravity <= 1.200));

-- Final gravity cannot exceed original gravity
ALTER TABLE batches
    ADD CONSTRAINT check_gravity_order
        CHECK (original_gravity IS NULL OR final_gravity IS NULL OR final_gravity <= original_gravity);

-- ABV values must be realistic (0 to 30%)
ALTER TABLE batches
    ADD CONSTRAINT check_estimated_abv_range
        CHECK (estimated_abv IS NULL OR (estimated_abv >= 0 AND estimated_abv <= 30));

ALTER TABLE batches
    ADD CONSTRAINT check_actual_abv_range
        CHECK (actual_abv IS NULL OR (actual_abv >= 0 AND actual_abv <= 30));

-- ==========================================
-- 4. CREATE TRIGGER TO AUTO-CALCULATE ABV
-- ==========================================

CREATE OR REPLACE FUNCTION calculate_batch_abv()
RETURNS TRIGGER AS $$
BEGIN
    -- Calculate estimated ABV if original gravity is set
    -- Formula: (OG - 1.000) × 131.25
    IF NEW.original_gravity IS NOT NULL THEN
        NEW.estimated_abv := ROUND((NEW.original_gravity - 1.000) * 131.25, 2);
    ELSE
        NEW.estimated_abv := NULL;
    END IF;

    -- Calculate actual ABV if both OG and FG are set
    -- Formula: (OG - FG) × 131.25
    IF NEW.original_gravity IS NOT NULL AND NEW.final_gravity IS NOT NULL THEN
        NEW.actual_abv := ROUND((NEW.original_gravity - NEW.final_gravity) * 131.25, 2);
    ELSE
        NEW.actual_abv := NULL;
    END IF;

    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Drop trigger if exists (for idempotency)
DROP TRIGGER IF EXISTS trigger_calculate_batch_abv ON batches;

-- Create trigger to auto-calculate ABV on insert/update
CREATE TRIGGER trigger_calculate_batch_abv
    BEFORE INSERT OR UPDATE OF original_gravity, final_gravity
    ON batches
    FOR EACH ROW
    EXECUTE FUNCTION calculate_batch_abv();

COMMIT;

-- Success message
DO $$
BEGIN
    RAISE NOTICE '✓ Gravity fields and ABV calculations added to batches table';
    RAISE NOTICE '  - original_gravity: Starting specific gravity (e.g., 1.050)';
    RAISE NOTICE '  - final_gravity: Final specific gravity (e.g., 1.000)';
    RAISE NOTICE '  - estimated_abv: Potential ABV if fermented to dryness';
    RAISE NOTICE '  - actual_abv: Calculated ABV from OG and FG';
    RAISE NOTICE '  - Auto-calculation trigger installed';
END
$$;
