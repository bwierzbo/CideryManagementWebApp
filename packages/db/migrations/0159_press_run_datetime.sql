-- Press run completion becomes a full datetime (was DATE).
-- Existing rows back-fill to noon Pacific (19:00 UTC) on their recorded date
-- so no row shifts to a different local calendar day.
ALTER TABLE press_runs
  ALTER COLUMN date_completed TYPE timestamp
  USING (date_completed::timestamp + interval '19 hours');
