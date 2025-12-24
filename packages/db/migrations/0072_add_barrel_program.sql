-- Barrel Program Migration
-- Extends vessels table with barrel-specific tracking for wood type, origin, flavor contribution, and usage history

-- 1. Create new enums for barrel attributes

-- Wood type
DO $$ BEGIN
  CREATE TYPE barrel_wood_type AS ENUM ('french_oak', 'american_oak', 'hungarian_oak', 'chestnut', 'other');
EXCEPTION
  WHEN duplicate_object THEN null;
END $$;

-- Original contents (what was in barrel before acquisition)
DO $$ BEGIN
  CREATE TYPE barrel_origin_contents AS ENUM ('bourbon', 'rye', 'wine_red', 'wine_white', 'brandy', 'rum', 'sherry', 'port', 'new_oak', 'neutral', 'other');
EXCEPTION
  WHEN duplicate_object THEN null;
END $$;

-- Toast level
DO $$ BEGIN
  CREATE TYPE barrel_toast_level AS ENUM ('light', 'medium', 'medium_plus', 'heavy', 'char');
EXCEPTION
  WHEN duplicate_object THEN null;
END $$;

-- Current flavor contribution level (lifecycle: high → medium → low → neutral)
DO $$ BEGIN
  CREATE TYPE barrel_flavor_level AS ENUM ('high', 'medium', 'low', 'neutral');
EXCEPTION
  WHEN duplicate_object THEN null;
END $$;

-- 2. Extend vessels table with barrel-specific columns
ALTER TABLE vessels ADD COLUMN IF NOT EXISTS is_barrel BOOLEAN DEFAULT false;
ALTER TABLE vessels ADD COLUMN IF NOT EXISTS barrel_wood_type barrel_wood_type;
ALTER TABLE vessels ADD COLUMN IF NOT EXISTS barrel_origin_contents barrel_origin_contents;
ALTER TABLE vessels ADD COLUMN IF NOT EXISTS barrel_origin_notes TEXT;
ALTER TABLE vessels ADD COLUMN IF NOT EXISTS barrel_toast_level barrel_toast_level;
ALTER TABLE vessels ADD COLUMN IF NOT EXISTS barrel_year_acquired INTEGER;
ALTER TABLE vessels ADD COLUMN IF NOT EXISTS barrel_age_years INTEGER;
ALTER TABLE vessels ADD COLUMN IF NOT EXISTS barrel_cost DECIMAL(10,2);
ALTER TABLE vessels ADD COLUMN IF NOT EXISTS barrel_flavor_level barrel_flavor_level DEFAULT 'high';
ALTER TABLE vessels ADD COLUMN IF NOT EXISTS barrel_use_count INTEGER DEFAULT 0;
ALTER TABLE vessels ADD COLUMN IF NOT EXISTS barrel_last_prepared_at TIMESTAMP WITH TIME ZONE;
ALTER TABLE vessels ADD COLUMN IF NOT EXISTS barrel_retired_at TIMESTAMP WITH TIME ZONE;
ALTER TABLE vessels ADD COLUMN IF NOT EXISTS barrel_retired_reason TEXT;

-- 3. Create barrel usage history table
CREATE TABLE IF NOT EXISTS barrel_usage_history (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  vessel_id UUID NOT NULL REFERENCES vessels(id),
  batch_id UUID NOT NULL REFERENCES batches(id),
  started_at TIMESTAMP WITH TIME ZONE NOT NULL,
  ended_at TIMESTAMP WITH TIME ZONE,
  duration_days INTEGER,
  flavor_level_at_start barrel_flavor_level,
  tasting_notes TEXT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Create indexes for barrel usage history
CREATE INDEX IF NOT EXISTS barrel_usage_vessel_idx ON barrel_usage_history(vessel_id);
CREATE INDEX IF NOT EXISTS barrel_usage_batch_idx ON barrel_usage_history(batch_id);

-- Create index for filtering vessels by material and barrel status
CREATE INDEX IF NOT EXISTS vessels_material_idx ON vessels(material);
CREATE INDEX IF NOT EXISTS vessels_is_barrel_idx ON vessels(is_barrel);

-- 4. Mark existing oak vessels as barrels
UPDATE vessels
SET is_barrel = true
WHERE material = 'oak' AND is_barrel IS NULL OR is_barrel = false;

-- 5. Create trigger to calculate duration_days when ended_at is set
CREATE OR REPLACE FUNCTION calculate_barrel_usage_duration()
RETURNS TRIGGER AS $$
BEGIN
  IF NEW.ended_at IS NOT NULL AND NEW.started_at IS NOT NULL THEN
    NEW.duration_days := EXTRACT(DAY FROM NEW.ended_at - NEW.started_at)::INTEGER;
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS barrel_usage_duration_trigger ON barrel_usage_history;
CREATE TRIGGER barrel_usage_duration_trigger
  BEFORE INSERT OR UPDATE ON barrel_usage_history
  FOR EACH ROW
  EXECUTE FUNCTION calculate_barrel_usage_duration();
