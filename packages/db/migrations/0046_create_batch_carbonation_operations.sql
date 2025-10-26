-- Migration: Create batch_carbonation_operations table
--
-- This table tracks forced carbonation operations where CO2 is added to batches
-- under pressure in sealed vessels (tanks or kegs).
--
-- Process flow:
-- 1. Start carbonation: Record batch, vessel, target CO2, pressure applied
-- 2. Monitor: Optionally track temperature/pressure during process
-- 3. Complete: Record final measurements, duration auto-calculated
-- 4. Link to packaging: bottle_runs reference this for forced carbonation
--
-- Related tables:
-- - batches: The batch being carbonated
-- - vessels: Must be a pressure vessel (is_pressure_vessel = 'yes')
-- - users: Who performed/completed the operation
-- - bottle_runs: Links to this when packaging forced-carbonated cider

BEGIN;

-- Create the main carbonation operations table
CREATE TABLE batch_carbonation_operations (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    batch_id UUID NOT NULL REFERENCES batches(id) ON DELETE CASCADE,
    vessel_id UUID NOT NULL REFERENCES vessels(id),

    -- ==========================================
    -- TIMING
    -- ==========================================
    started_at TIMESTAMP NOT NULL DEFAULT NOW(),
    completed_at TIMESTAMP,
    duration_hours NUMERIC(6,1), -- Auto-calculated on completion

    -- ==========================================
    -- STARTING CONDITIONS (when carbonation begins)
    -- ==========================================
    starting_volume NUMERIC(10,3) NOT NULL,
    starting_volume_unit unit NOT NULL DEFAULT 'L',
    starting_temperature NUMERIC(4,1), -- °C, optional
    starting_co2_volumes NUMERIC(4,2), -- Optional if known from prior measurement

    -- ==========================================
    -- TARGET CONDITIONS (what we're aiming for)
    -- ==========================================
    target_co2_volumes NUMERIC(4,2) NOT NULL, -- Required: goal volumes
    suggested_pressure NUMERIC(5,1), -- Auto-calculated from target + temp

    -- ==========================================
    -- PROCESS DETAILS
    -- ==========================================
    carbonation_process carbonation_process_type NOT NULL DEFAULT 'headspace',
    pressure_applied NUMERIC(5,1) NOT NULL, -- PSI initially applied
    gas_type TEXT DEFAULT 'CO2', -- 'CO2', 'Beer Gas 75/25', 'CO2/N2 mix', etc.

    -- ==========================================
    -- FINAL CONDITIONS (filled when completed_at is set)
    -- ==========================================
    final_pressure NUMERIC(5,1), -- PSI at end
    final_temperature NUMERIC(4,1), -- °C at end
    final_co2_volumes NUMERIC(4,2), -- Measured or calculated
    final_volume NUMERIC(10,3), -- May lose some volume
    final_volume_unit unit DEFAULT 'L',

    -- ==========================================
    -- QUALITY ASSESSMENT
    -- ==========================================
    quality_check carbonation_quality DEFAULT 'in_progress',
    quality_notes TEXT,
    notes TEXT,

    -- ==========================================
    -- TRACKING
    -- ==========================================
    performed_by UUID REFERENCES users(id), -- Who started it
    completed_by UUID REFERENCES users(id), -- Who finished/verified it

    -- ==========================================
    -- AUDIT
    -- ==========================================
    created_at TIMESTAMP NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMP NOT NULL DEFAULT NOW(),
    deleted_at TIMESTAMP,

    -- ==========================================
    -- CONSTRAINTS
    -- ==========================================

    -- Target CO2 must be realistic (0.1 to 5.0 volumes)
    CONSTRAINT valid_target_co2 CHECK (
        target_co2_volumes > 0 AND target_co2_volumes <= 5.0
    ),

    -- Pressure must be safe (1 to 50 PSI)
    CONSTRAINT valid_pressure CHECK (
        pressure_applied > 0 AND pressure_applied <= 50
    ),

    -- Temperature must be realistic (-5°C to 25°C)
    CONSTRAINT valid_temperature CHECK (
        starting_temperature IS NULL OR
        (starting_temperature >= -5 AND starting_temperature <= 25)
    ),

    -- When completed, final measurements must be provided
    CONSTRAINT completed_fields_required CHECK (
        (completed_at IS NULL) OR
        (completed_at IS NOT NULL AND
         final_pressure IS NOT NULL AND
         final_co2_volumes IS NOT NULL AND
         quality_check != 'in_progress')
    ),

    -- Volume should not increase during carbonation
    CONSTRAINT volume_not_increased CHECK (
        final_volume IS NULL OR
        final_volume <= starting_volume
    )
);

-- ==========================================
-- INDEXES FOR PERFORMANCE
-- ==========================================

-- Find all carbonations for a batch (most common query)
CREATE INDEX idx_carbonation_batch ON batch_carbonation_operations(batch_id)
    WHERE deleted_at IS NULL;

-- Find what's carbonating in a vessel
CREATE INDEX idx_carbonation_vessel ON batch_carbonation_operations(vessel_id)
    WHERE deleted_at IS NULL;

-- Dashboard: List all active carbonations
CREATE INDEX idx_carbonation_active ON batch_carbonation_operations(started_at, completed_at)
    WHERE completed_at IS NULL AND deleted_at IS NULL;

-- Reports: List completed carbonations
CREATE INDEX idx_carbonation_completed ON batch_carbonation_operations(completed_at DESC)
    WHERE completed_at IS NOT NULL AND deleted_at IS NULL;

-- ==========================================
-- TRIGGER: AUTO-CALCULATE DURATION
-- ==========================================

CREATE OR REPLACE FUNCTION calculate_carbonation_duration()
RETURNS TRIGGER AS $$
BEGIN
    -- When marking as completed, auto-calculate duration in hours
    IF NEW.completed_at IS NOT NULL AND OLD.completed_at IS NULL THEN
        NEW.duration_hours := EXTRACT(EPOCH FROM (NEW.completed_at - NEW.started_at)) / 3600.0;
    END IF;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER carbonation_duration_trigger
    BEFORE UPDATE ON batch_carbonation_operations
    FOR EACH ROW
    EXECUTE FUNCTION calculate_carbonation_duration();

-- ==========================================
-- TABLE & COLUMN COMMENTS
-- ==========================================

COMMENT ON TABLE batch_carbonation_operations IS
    'Tracks forced carbonation operations where CO2 is added to batches under pressure in sealed vessels';

COMMENT ON COLUMN batch_carbonation_operations.target_co2_volumes IS
    'Target carbonation level in volumes (1 vol = 1L CO2 per 1L liquid). Cider ranges: still <1, petillant 1-2.5, sparkling 2.5-4';

COMMENT ON COLUMN batch_carbonation_operations.suggested_pressure IS
    'System-calculated suggested pressure based on target CO2 and temperature using Henry''s Law';

COMMENT ON COLUMN batch_carbonation_operations.duration_hours IS
    'Auto-calculated duration in hours from started_at to completed_at. Typical: 24-168 hours (1-7 days)';

COMMENT ON COLUMN batch_carbonation_operations.carbonation_process IS
    'Physical method: headspace (CO2 in headspace), inline (injected during transfer), or stone (carbonation stone in tank)';

COMMENT ON COLUMN batch_carbonation_operations.gas_type IS
    'Gas used: typically pure CO2, but can be beer gas (CO2/N2 mix) for lower carbonation';

COMMENT ON COLUMN batch_carbonation_operations.quality_check IS
    'Quality assessment: pass (target achieved), fail (did not carbonate), needs_adjustment (close but off), in_progress (currently carbonating)';

-- ==========================================
-- VIEW: ACTIVE CARBONATIONS
-- ==========================================

CREATE VIEW active_carbonations AS
SELECT
    bco.id,
    bco.batch_id,
    b.name as batch_name,
    b.status as batch_status,
    b.current_volume as batch_current_volume,
    bco.vessel_id,
    v.name as vessel_name,
    v.max_pressure as vessel_max_pressure,
    bco.started_at,
    bco.target_co2_volumes,
    bco.pressure_applied,
    bco.starting_temperature,
    bco.final_temperature as current_temperature,
    bco.carbonation_process,
    bco.gas_type,
    bco.quality_check,
    -- Calculate hours elapsed
    ROUND(EXTRACT(EPOCH FROM (NOW() - bco.started_at)) / 3600.0, 1) as hours_elapsed,
    -- Estimate completion (very rough: 48 hours for typical carbonation)
    bco.started_at + INTERVAL '48 hours' as estimated_completion,
    bco.performed_by,
    u.email as performed_by_email,
    bco.notes
FROM batch_carbonation_operations bco
JOIN batches b ON b.id = bco.batch_id
JOIN vessels v ON v.id = bco.vessel_id
LEFT JOIN users u ON u.id = bco.performed_by
WHERE bco.completed_at IS NULL
  AND bco.deleted_at IS NULL
  AND b.deleted_at IS NULL
ORDER BY bco.started_at DESC;

COMMENT ON VIEW active_carbonations IS
    'Shows all in-progress carbonation operations with calculated elapsed time and vessel info. Used for dashboard monitoring.';

COMMIT;

-- Success message
DO $$
BEGIN
    RAISE NOTICE '✓ Batch carbonation operations table created successfully';
    RAISE NOTICE '  - Table: batch_carbonation_operations';
    RAISE NOTICE '  - Indexes: 4 performance indexes created';
    RAISE NOTICE '  - Trigger: Auto-duration calculation enabled';
    RAISE NOTICE '  - View: active_carbonations created';
    RAISE NOTICE '  - Constraints: 5 data validation constraints';
END
$$;
