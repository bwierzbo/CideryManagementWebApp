-- Dissolved CO2 (in volumes) on batch measurements, so "Measure CO2" steps and
-- the Measurements page can record/show carbonation level universally.
ALTER TABLE batch_measurements
  ADD COLUMN IF NOT EXISTS dissolved_co2 NUMERIC(4, 2);
