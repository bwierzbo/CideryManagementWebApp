-- Migration: Add cost tracking columns to keg_fills
-- Adds overhead_cost_allocated and retail_price for COGS calculations

ALTER TABLE keg_fills
ADD COLUMN IF NOT EXISTS overhead_cost_allocated DECIMAL(10, 2),
ADD COLUMN IF NOT EXISTS retail_price DECIMAL(10, 2);

COMMENT ON COLUMN keg_fills.overhead_cost_allocated IS 'Allocated overhead cost based on volume and rate per gallon';
COMMENT ON COLUMN keg_fills.retail_price IS 'Retail/wholesale price per keg';
