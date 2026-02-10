-- Fix the sync_volume_liters trigger:
-- REMOVE initial_volume_liters sync on UPDATE.
-- initial_volume_liters is maintained by application code (press run additions
-- bump it above initial_volume). Auto-syncing from initial_volume would
-- overwrite those additions — which is exactly what migration 0113 did wrong.
--
-- Keep: current_volume_liters sync on UPDATE (safe — no app code adds to it separately)
-- Keep: both fields on INSERT fallback (fill in if not explicitly provided)

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

  -- On UPDATE: only sync current_volume_liters (NOT initial_volume_liters)
  -- initial_volume_liters is maintained by app code and may include press_run additions
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
