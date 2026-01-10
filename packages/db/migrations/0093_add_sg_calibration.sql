-- SG Calibration System
-- Allows calibrating refractometer against hydrometer using paired readings
-- and automatically corrects future SG measurements

-- Create instrument_calibrations table for storing calibration sessions
CREATE TABLE IF NOT EXISTS instrument_calibrations (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name VARCHAR(255),

  -- Hydrometer settings
  hydrometer_calibration_temp_c DOUBLE PRECISION DEFAULT 20.0,

  -- Refractometer calibration
  refractometer_baseline_offset DOUBLE PRECISION DEFAULT 0,
  correction_formula VARCHAR(50) DEFAULT 'linear',
  linear_coefficients JSONB,

  -- Calibration metadata
  calibration_date TIMESTAMPTZ DEFAULT NOW(),
  readings_count INTEGER,
  r_squared DOUBLE PRECISION,
  max_error DOUBLE PRECISION,
  avg_error DOUBLE PRECISION,
  is_active BOOLEAN DEFAULT FALSE,
  notes TEXT,

  -- Audit fields
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  deleted_at TIMESTAMPTZ
);

-- Create calibration_readings table for storing paired readings
CREATE TABLE IF NOT EXISTS calibration_readings (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  calibration_id UUID REFERENCES instrument_calibrations(id) ON DELETE CASCADE,

  -- Input readings
  original_gravity DOUBLE PRECISION NOT NULL,
  refractometer_reading DOUBLE PRECISION NOT NULL,
  hydrometer_reading DOUBLE PRECISION NOT NULL,
  temperature_c DOUBLE PRECISION NOT NULL,
  is_fresh_juice BOOLEAN DEFAULT FALSE,

  -- Calculated fields (filled after calibration calculation)
  hydrometer_corrected DOUBLE PRECISION,
  predicted_sg DOUBLE PRECISION,
  error DOUBLE PRECISION,

  notes TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Add calibration fields to batch_measurements
ALTER TABLE batch_measurements
ADD COLUMN IF NOT EXISTS raw_reading DOUBLE PRECISION,
ADD COLUMN IF NOT EXISTS calibration_id UUID REFERENCES instrument_calibrations(id),
ADD COLUMN IF NOT EXISTS corrections_applied JSONB,
ADD COLUMN IF NOT EXISTS original_gravity_at_measurement DOUBLE PRECISION;

-- Create unique partial index to ensure only one active calibration at a time
CREATE UNIQUE INDEX IF NOT EXISTS idx_active_calibration
  ON instrument_calibrations(is_active)
  WHERE is_active = TRUE AND deleted_at IS NULL;

-- Create indexes for calibration readings
CREATE INDEX IF NOT EXISTS idx_calibration_readings_calibration_id
  ON calibration_readings(calibration_id);

-- Create index for batch_measurements calibration lookup
CREATE INDEX IF NOT EXISTS idx_batch_measurements_calibration_id
  ON batch_measurements(calibration_id);

-- Add comment for documentation
COMMENT ON TABLE instrument_calibrations IS 'Stores calibration sessions for SG measurement instruments (hydrometer/refractometer)';
COMMENT ON TABLE calibration_readings IS 'Paired readings used to calculate calibration coefficients';
COMMENT ON COLUMN batch_measurements.raw_reading IS 'Original instrument reading before any corrections applied';
COMMENT ON COLUMN batch_measurements.calibration_id IS 'Reference to the calibration used to correct this measurement';
COMMENT ON COLUMN batch_measurements.corrections_applied IS 'JSON object tracking what corrections were applied, e.g., {"temp": 0.002, "alcohol": -0.008}';
COMMENT ON COLUMN batch_measurements.original_gravity_at_measurement IS 'OG value used for refractometer alcohol correction calculation';
