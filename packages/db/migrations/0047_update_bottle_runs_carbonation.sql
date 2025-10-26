-- Migration: Add carbonation tracking to bottle_runs
--
-- This links packaging operations to carbonation operations, allowing us to:
-- 1. Track whether cider was carbonated naturally or by force
-- 2. Link forced carbonation to the specific operation
-- 3. Auto-populate carbonation_level from CO2 measurements
-- 4. Generate accurate labels and reports

BEGIN;

-- Add carbonation method tracking
ALTER TABLE bottle_runs
ADD COLUMN carbonation_method carbonation_method DEFAULT 'none';

COMMENT ON COLUMN bottle_runs.carbonation_method IS
    'How this batch was carbonated: natural (bottle conditioning), forced (tank/keg pressure), or none (still cider)';

-- Link to source carbonation operation (if forced)
ALTER TABLE bottle_runs
ADD COLUMN source_carbonation_operation_id UUID REFERENCES batch_carbonation_operations(id);

COMMENT ON COLUMN bottle_runs.source_carbonation_operation_id IS
    'References the carbonation operation if carbonation_method is ''forced''. NULL for natural or none.';

-- Add index for quick lookups
CREATE INDEX idx_bottle_runs_carbonation_op
ON bottle_runs(source_carbonation_operation_id)
WHERE source_carbonation_operation_id IS NOT NULL;

-- Backfill existing data with sensible defaults
-- Assume if carbonation_level is not 'still', it was likely natural carbonation
UPDATE bottle_runs
SET carbonation_method = CASE
    WHEN carbonation_level = 'still' THEN 'none'::carbonation_method
    WHEN carbonation_level IS NULL THEN 'none'::carbonation_method
    ELSE 'natural'::carbonation_method -- Assume bottle conditioning before this feature existed
END
WHERE carbonation_method IS NULL OR carbonation_method = 'none';

COMMIT;

-- Helper function to determine carbonation level from CO2 volumes
-- This is used when auto-populating bottle_runs from carbonation operations

CREATE OR REPLACE FUNCTION get_carbonation_level_from_volumes(co2_volumes NUMERIC)
RETURNS carbonation_level AS $$
BEGIN
    IF co2_volumes IS NULL THEN
        RETURN NULL;
    ELSIF co2_volumes < 1.0 THEN
        RETURN 'still';
    ELSIF co2_volumes < 2.5 THEN
        RETURN 'petillant';
    ELSE
        RETURN 'sparkling';
    END IF;
END;
$$ LANGUAGE plpgsql IMMUTABLE;

COMMENT ON FUNCTION get_carbonation_level_from_volumes IS
    'Converts CO2 volumes to carbonation level classification: <1.0=still, 1.0-2.5=petillant, >2.5=sparkling. Based on typical cider carbonation ranges.';

-- Create view for bottle runs with carbonation info
CREATE VIEW bottle_runs_with_carbonation AS
SELECT
    br.id,
    br.batch_id,
    b.name as batch_name,
    br.vessel_id,
    v.name as vessel_name,
    br.package_type,
    br.package_size_ml,
    br.units_produced,
    br.carbonation_level,
    br.carbonation_method,
    br.abv_at_packaging,
    br.packaged_at,
    -- Carbonation operation details (if forced)
    bco.id as carbonation_op_id,
    bco.target_co2_volumes,
    bco.final_co2_volumes,
    bco.pressure_applied,
    bco.duration_hours as carbonation_duration_hours,
    bco.quality_check as carbonation_quality,
    -- Derived info
    CASE
        WHEN br.carbonation_method = 'forced' AND bco.id IS NOT NULL THEN
            'Forced: ' || bco.final_co2_volumes || ' vol @ ' || bco.pressure_applied || ' PSI'
        WHEN br.carbonation_method = 'natural' THEN
            'Natural (bottle conditioned)'
        ELSE
            'None'
    END as carbonation_description
FROM bottle_runs br
JOIN batches b ON b.id = br.batch_id
LEFT JOIN vessels v ON v.id = br.vessel_id
LEFT JOIN batch_carbonation_operations bco ON bco.id = br.source_carbonation_operation_id;

COMMENT ON VIEW bottle_runs_with_carbonation IS
    'Bottle runs with full carbonation details, useful for labels and reports';

-- Success message
DO $$
BEGIN
    RAISE NOTICE '✓ Bottle runs carbonation tracking migration completed successfully';
    RAISE NOTICE '  - Added carbonation_method column to bottle_runs';
    RAISE NOTICE '  - Added source_carbonation_operation_id foreign key';
    RAISE NOTICE '  - Created index for carbonation operation lookups';
    RAISE NOTICE '  - Backfilled existing bottle runs with sensible defaults';
    RAISE NOTICE '  - Created helper function: get_carbonation_level_from_volumes()';
    RAISE NOTICE '  - Created view: bottle_runs_with_carbonation';
END
$$;
