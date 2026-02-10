-- Trigger to auto-sync current_volume_liters and initial_volume_liters
-- whenever current_volume or initial_volume is updated.
-- This prevents drift between the legacy volume fields and the normalized liters fields.

CREATE OR REPLACE FUNCTION sync_volume_liters()
RETURNS TRIGGER AS $$
BEGIN
  -- On INSERT: fill in liters if not explicitly provided (NULL or 0)
  IF TG_OP = 'INSERT' THEN
    IF NEW.current_volume IS NOT NULL AND
       (NEW.current_volume_liters IS NULL OR CAST(NEW.current_volume_liters AS NUMERIC) = 0) AND
       CAST(NEW.current_volume AS NUMERIC) != 0 THEN
      NEW.current_volume_liters := CASE
        WHEN NEW.current_volume_unit = 'gal' THEN CAST(NEW.current_volume AS NUMERIC) * 3.78541
        ELSE CAST(NEW.current_volume AS NUMERIC)
      END;
    END IF;

    IF NEW.initial_volume IS NOT NULL AND
       (NEW.initial_volume_liters IS NULL OR CAST(NEW.initial_volume_liters AS NUMERIC) = 0) AND
       CAST(NEW.initial_volume AS NUMERIC) != 0 THEN
      NEW.initial_volume_liters := CASE
        WHEN NEW.initial_volume_unit = 'gal' THEN CAST(NEW.initial_volume AS NUMERIC) * 3.78541
        ELSE CAST(NEW.initial_volume AS NUMERIC)
      END;
    END IF;
  END IF;

  -- On UPDATE: sync when volume changes
  IF TG_OP = 'UPDATE' THEN
    IF NEW.current_volume IS DISTINCT FROM OLD.current_volume OR
       NEW.current_volume_unit IS DISTINCT FROM OLD.current_volume_unit THEN
      NEW.current_volume_liters := CASE
        WHEN NEW.current_volume_unit = 'gal' THEN CAST(NEW.current_volume AS NUMERIC) * 3.78541
        ELSE CAST(NEW.current_volume AS NUMERIC)
      END;
    END IF;

    IF NEW.initial_volume IS DISTINCT FROM OLD.initial_volume OR
       NEW.initial_volume_unit IS DISTINCT FROM OLD.initial_volume_unit THEN
      NEW.initial_volume_liters := CASE
        WHEN NEW.initial_volume_unit = 'gal' THEN CAST(NEW.initial_volume AS NUMERIC) * 3.78541
        ELSE CAST(NEW.initial_volume AS NUMERIC)
      END;
    END IF;
  END IF;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trg_sync_volume_liters
BEFORE INSERT OR UPDATE ON batches
FOR EACH ROW
EXECUTE FUNCTION sync_volume_liters();

-- One-time sync: fix any existing batches where current_volume_liters drifted from current_volume
UPDATE batches
SET current_volume_liters = CASE
  WHEN current_volume_unit = 'gal' THEN CAST(current_volume AS NUMERIC) * 3.78541
  ELSE CAST(current_volume AS NUMERIC)
END
WHERE CAST(current_volume AS NUMERIC) != CAST(COALESCE(current_volume_liters, '0') AS NUMERIC);

-- One-time sync: fix any existing batches where initial_volume_liters drifted from initial_volume
UPDATE batches
SET initial_volume_liters = CASE
  WHEN initial_volume_unit = 'gal' THEN CAST(initial_volume AS NUMERIC) * 3.78541
  ELSE CAST(initial_volume AS NUMERIC)
END
WHERE CAST(initial_volume AS NUMERIC) != CAST(COALESCE(initial_volume_liters, '0') AS NUMERIC)
  AND CAST(initial_volume AS NUMERIC) > 0;
