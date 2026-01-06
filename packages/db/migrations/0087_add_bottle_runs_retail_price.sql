-- Migration: Add retail_price column to bottle_runs
-- Tracks the retail price per unit for COGS/margin calculations

ALTER TABLE bottle_runs
ADD COLUMN IF NOT EXISTS retail_price DECIMAL(10, 2);

COMMENT ON COLUMN bottle_runs.retail_price IS 'Retail price per unit (bottle/can)';
