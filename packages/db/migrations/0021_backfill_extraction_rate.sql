-- Migration: Backfill extraction rate for existing completed press runs
-- Calculate extraction rate as totalJuiceVolume / totalAppleWeightKg

UPDATE apple_press_runs
SET extraction_rate = total_juice_volume::decimal / total_apple_weight_kg::decimal
WHERE status = 'completed'
  AND total_juice_volume IS NOT NULL
  AND total_apple_weight_kg IS NOT NULL
  AND total_apple_weight_kg::decimal > 0
  AND extraction_rate IS NULL;
