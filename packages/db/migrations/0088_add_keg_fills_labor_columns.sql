-- Migration: Add labor tracking columns to keg_fills
-- Matches bottle_runs labor tracking fields

ALTER TABLE keg_fills
ADD COLUMN IF NOT EXISTS labor_hours DECIMAL(6, 2),
ADD COLUMN IF NOT EXISTS labor_cost_per_hour DECIMAL(10, 2);

COMMENT ON COLUMN keg_fills.labor_hours IS 'Hours of labor for this keg fill';
COMMENT ON COLUMN keg_fills.labor_cost_per_hour IS 'Hourly rate for labor';
