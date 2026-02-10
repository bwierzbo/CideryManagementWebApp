-- Migration 0115: Add TTB Reconciliation Safeguards
-- 1. Protected field flag on batches (prevents trigger overwrites of manually corrected values)
-- 2. Reconciliation year lock on organization_settings
-- 3. Volume audit trail table + trigger

-- ============================================================
-- SAFEGUARD 1: Protected field flag
-- ============================================================
ALTER TABLE batches ADD COLUMN IF NOT EXISTS volume_manually_corrected BOOLEAN DEFAULT false;

-- Update the sync_volume_liters trigger to respect the protection flag on INSERT
CREATE OR REPLACE FUNCTION sync_volume_liters()
RETURNS TRIGGER AS $$
BEGIN
  IF TG_OP = 'INSERT' THEN
    -- Skip initial_volume_liters sync if batch is marked as manually corrected
    IF NEW.current_volume IS NOT NULL AND
       (NEW.current_volume_liters IS NULL OR CAST(NEW.current_volume_liters AS NUMERIC) = 0) AND
       CAST(NEW.current_volume AS NUMERIC) != 0 THEN
      NEW.current_volume_liters := CASE
        WHEN NEW.current_volume_unit = 'gal' THEN CAST(NEW.current_volume AS NUMERIC) * 3.78541
        ELSE CAST(NEW.current_volume AS NUMERIC)
      END;
    END IF;
    IF NOT COALESCE(NEW.volume_manually_corrected, false) THEN
      IF NEW.initial_volume IS NOT NULL AND
         (NEW.initial_volume_liters IS NULL OR CAST(NEW.initial_volume_liters AS NUMERIC) = 0) AND
         CAST(NEW.initial_volume AS NUMERIC) != 0 THEN
        NEW.initial_volume_liters := CASE
          WHEN NEW.initial_volume_unit = 'gal' THEN CAST(NEW.initial_volume AS NUMERIC) * 3.78541
          ELSE CAST(NEW.initial_volume AS NUMERIC)
        END;
      END IF;
    END IF;
  END IF;

  IF TG_OP = 'UPDATE' THEN
    -- Always sync current_volume_liters (needed for normal operations)
    IF NEW.current_volume IS DISTINCT FROM OLD.current_volume OR
       NEW.current_volume_unit IS DISTINCT FROM OLD.current_volume_unit THEN
      NEW.current_volume_liters := CASE
        WHEN NEW.current_volume_unit = 'gal' THEN CAST(NEW.current_volume AS NUMERIC) * 3.78541
        ELSE CAST(NEW.current_volume AS NUMERIC)
      END;
    END IF;
    -- Never sync initial_volume_liters on UPDATE (migration 0114 design decision)
  END IF;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Backfill: mark previously corrected batches
UPDATE batches SET volume_manually_corrected = true
WHERE name IN (
  '2024-10-20_UNKN_BLEND_A',                                    -- Raspberry Blackberry (init corrected to 120)
  '2024-11-28_120 Barrel 2_BLEND_A',                            -- Salish (init is 225, transfers soft-deleted)
  'Batch #2025-10-20_120 Barrel 4_BIPE_A-Tmjaqcjua-Tmjaqg384', -- Perry (volume set to 280, adjustment added)
  'blend-2025-07-01-1100SS1-653539',                            -- Base Cider for Brandy (parent removed)
  'blend-2024-12-20-120 Barrel 3-910854'                        -- Ginger Quince (init set to 0)
);

-- ============================================================
-- SAFEGUARD 2: Reconciliation year lock
-- ============================================================
ALTER TABLE organization_settings
  ADD COLUMN IF NOT EXISTS reconciliation_locked_years INTEGER[] DEFAULT '{}';

-- ============================================================
-- SAFEGUARD 3: Volume audit trail
-- ============================================================
CREATE TABLE IF NOT EXISTS batch_volume_audit (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  batch_id UUID NOT NULL REFERENCES batches(id) ON DELETE CASCADE,
  field_name TEXT NOT NULL,
  old_value TEXT,
  new_value TEXT,
  changed_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  change_source TEXT DEFAULT 'unknown'
);

CREATE INDEX IF NOT EXISTS idx_batch_volume_audit_batch ON batch_volume_audit(batch_id);
CREATE INDEX IF NOT EXISTS idx_batch_volume_audit_time ON batch_volume_audit(changed_at);

CREATE OR REPLACE FUNCTION audit_batch_volume_changes()
RETURNS TRIGGER AS $$
BEGIN
  IF OLD.initial_volume IS DISTINCT FROM NEW.initial_volume THEN
    INSERT INTO batch_volume_audit (batch_id, field_name, old_value, new_value)
    VALUES (NEW.id, 'initial_volume', OLD.initial_volume, NEW.initial_volume);
  END IF;
  IF OLD.initial_volume_liters IS DISTINCT FROM NEW.initial_volume_liters THEN
    INSERT INTO batch_volume_audit (batch_id, field_name, old_value, new_value)
    VALUES (NEW.id, 'initial_volume_liters', OLD.initial_volume_liters, NEW.initial_volume_liters);
  END IF;
  IF OLD.current_volume IS DISTINCT FROM NEW.current_volume THEN
    INSERT INTO batch_volume_audit (batch_id, field_name, old_value, new_value)
    VALUES (NEW.id, 'current_volume', OLD.current_volume, NEW.current_volume);
  END IF;
  IF OLD.current_volume_liters IS DISTINCT FROM NEW.current_volume_liters THEN
    INSERT INTO batch_volume_audit (batch_id, field_name, old_value, new_value)
    VALUES (NEW.id, 'current_volume_liters', OLD.current_volume_liters, NEW.current_volume_liters);
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Drop existing trigger if it exists (idempotent)
DROP TRIGGER IF EXISTS trg_audit_batch_volume ON batches;
CREATE TRIGGER trg_audit_batch_volume
  AFTER UPDATE ON batches
  FOR EACH ROW
  EXECUTE FUNCTION audit_batch_volume_changes();
