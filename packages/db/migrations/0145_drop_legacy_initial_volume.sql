-- Migration 0145: Retire the legacy batches.initial_volume + initial_volume_unit columns.
-- initial_volume_liters is now the single authoritative initial-volume column; all
-- application code (recon engines, routers, seed) reads/writes only it.
--
-- This migration:
--   1. Safety backfill: fill initial_volume_liters from initial_volume for any row the
--      trigger somehow missed (expected 0 rows — verified before writing this).
--   2. Rewrites sync_volume_liters() to remove all initial_volume / initial_volume_unit
--      references. current_volume mirroring is kept EXACTLY as-is (trigger-maintained).
--   3. Rewrites audit_batch_volume_changes() to stop referencing the dropped columns
--      (keeps initial_volume_liters, current_volume, current_volume_liters auditing).
--   4. Drops initial_volume and initial_volume_unit.

-- 1. Safety backfill (no-op if the trigger already populated liters everywhere)
UPDATE batches
SET initial_volume_liters = initial_volume
WHERE initial_volume_liters IS NULL AND initial_volume IS NOT NULL;
--> statement-breakpoint

-- 2. sync_volume_liters: only current_volume_liters is trigger-maintained now.
-- initial_volume_liters is maintained by application code (see migration 0114/0115 notes).
CREATE OR REPLACE FUNCTION sync_volume_liters()
RETURNS TRIGGER AS $$
BEGIN
  -- On INSERT: fill in current_volume_liters if not explicitly provided (NULL or 0)
  IF TG_OP = 'INSERT' THEN
    IF NEW.current_volume IS NOT NULL AND
       (NEW.current_volume_liters IS NULL OR CAST(NEW.current_volume_liters AS NUMERIC) = 0) AND
       CAST(NEW.current_volume AS NUMERIC) != 0 THEN
      NEW.current_volume_liters := CASE
        WHEN NEW.current_volume_unit = 'gal' THEN CAST(NEW.current_volume AS NUMERIC) * 3.78541
        ELSE CAST(NEW.current_volume AS NUMERIC)
      END;
    END IF;
  END IF;

  -- On UPDATE: keep current_volume_liters in sync
  IF TG_OP = 'UPDATE' THEN
    IF NEW.current_volume IS DISTINCT FROM OLD.current_volume OR
       NEW.current_volume_unit IS DISTINCT FROM OLD.current_volume_unit THEN
      NEW.current_volume_liters := CASE
        WHEN NEW.current_volume_unit = 'gal' THEN CAST(NEW.current_volume AS NUMERIC) * 3.78541
        ELSE CAST(NEW.current_volume AS NUMERIC)
      END;
    END IF;
  END IF;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql;
--> statement-breakpoint

-- 3. audit_batch_volume_changes: drop the initial_volume block (column is going away)
CREATE OR REPLACE FUNCTION audit_batch_volume_changes()
RETURNS TRIGGER AS $$
BEGIN
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
--> statement-breakpoint

-- 4. Drop trigger_normalize_batch_volumes (migration 0039) + its function.
-- It re-derived initial_volume_liters FROM the legacy column on any update
-- touching it — the continuing-runtime twin of the 0113 clobber hazard — and
-- its current_volume mirroring is fully redundant with sync_volume_liters
-- (which fires first and computes the same value).
DROP TRIGGER IF EXISTS trigger_normalize_batch_volumes ON batches;
--> statement-breakpoint
DROP FUNCTION IF EXISTS normalize_batch_volumes();
--> statement-breakpoint

-- 5. Drop the legacy columns
ALTER TABLE batches DROP COLUMN initial_volume;
--> statement-breakpoint
ALTER TABLE batches DROP COLUMN initial_volume_unit;
