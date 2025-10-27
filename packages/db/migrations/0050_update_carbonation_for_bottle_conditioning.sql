-- Migration: Update carbonation operations to support bottle conditioning
--
-- This migration:
-- 1. Makes vessel_id nullable (not needed for bottle conditioning)
-- 2. Adds priming sugar tracking fields for bottle conditioning
-- 3. Updates carbonation_process_type enum to include 'bottle_conditioning'
--
-- Related: Previously carbonation only supported forced carbonation in pressure vessels.
-- Now it also supports bottle conditioning where priming sugar is added before bottling.

BEGIN;

-- ==========================================
-- 1. ADD BOTTLE_CONDITIONING TO ENUM
-- ==========================================

-- Add 'bottle_conditioning' to the carbonation_process_type enum
ALTER TYPE carbonation_process_type ADD VALUE IF NOT EXISTS 'bottle_conditioning';

-- ==========================================
-- 2. MAKE VESSEL_ID NULLABLE
-- ==========================================

-- Drop the NOT NULL constraint on vessel_id since bottle conditioning doesn't require a vessel
ALTER TABLE batch_carbonation_operations
    ALTER COLUMN vessel_id DROP NOT NULL;

COMMENT ON COLUMN batch_carbonation_operations.vessel_id IS
    'Vessel ID for forced carbonation operations. NULL for bottle conditioning operations.';

-- ==========================================
-- 3. ADD PRIMING SUGAR FIELDS
-- ==========================================

-- Add fields for tracking priming sugar used in bottle conditioning
ALTER TABLE batch_carbonation_operations
    ADD COLUMN IF NOT EXISTS additive_purchase_id UUID REFERENCES additive_purchases(id),
    ADD COLUMN IF NOT EXISTS priming_sugar_amount NUMERIC(10,2),
    ADD COLUMN IF NOT EXISTS priming_sugar_type TEXT;

COMMENT ON COLUMN batch_carbonation_operations.additive_purchase_id IS
    'Reference to the additive purchase used for priming sugar (bottle conditioning only)';

COMMENT ON COLUMN batch_carbonation_operations.priming_sugar_amount IS
    'Amount of priming sugar added in grams (bottle conditioning only)';

COMMENT ON COLUMN batch_carbonation_operations.priming_sugar_type IS
    'Type of sugar used for priming: sucrose, dextrose, or honey (bottle conditioning only)';

-- ==========================================
-- 4. UPDATE TABLE COMMENT
-- ==========================================

COMMENT ON TABLE batch_carbonation_operations IS
    'Tracks carbonation operations including forced carbonation (CO2 under pressure) and bottle conditioning (priming sugar before bottling)';

-- ==========================================
-- 5. UPDATE CONSTRAINTS
-- ==========================================

-- Update the completed fields constraint to account for bottle conditioning
-- Bottle conditioning doesn't necessarily need final pressure measurements
ALTER TABLE batch_carbonation_operations
    DROP CONSTRAINT IF EXISTS completed_fields_required;

ALTER TABLE batch_carbonation_operations
    ADD CONSTRAINT completed_fields_required CHECK (
        (completed_at IS NULL) OR
        (completed_at IS NOT NULL AND
         final_co2_volumes IS NOT NULL AND
         quality_check != 'in_progress')
    );

-- Add constraint: if carbonation_process is bottle_conditioning, additive_purchase_id should be set
-- (This is a soft constraint - we allow it to be null for data flexibility)

COMMIT;

-- Success message
DO $$
BEGIN
    RAISE NOTICE '✓ Carbonation operations updated for bottle conditioning';
    RAISE NOTICE '  - vessel_id is now nullable';
    RAISE NOTICE '  - Added priming sugar tracking fields';
    RAISE NOTICE '  - Added bottle_conditioning to carbonation_process_type enum';
    RAISE NOTICE '  - Updated constraints for bottle conditioning';
END
$$;
