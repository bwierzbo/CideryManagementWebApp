-- Migration: Add overhead cost allocation settings to organization_settings
-- This enables per-gallon overhead tracking for COGS calculations

-- Add overhead tracking columns to organization_settings
ALTER TABLE organization_settings
ADD COLUMN IF NOT EXISTS overhead_tracking_enabled BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN IF NOT EXISTS overhead_annual_rent DECIMAL(12, 2),
ADD COLUMN IF NOT EXISTS overhead_annual_utilities DECIMAL(12, 2),
ADD COLUMN IF NOT EXISTS overhead_annual_insurance DECIMAL(12, 2),
ADD COLUMN IF NOT EXISTS overhead_annual_equipment DECIMAL(12, 2),
ADD COLUMN IF NOT EXISTS overhead_annual_licenses DECIMAL(12, 2),
ADD COLUMN IF NOT EXISTS overhead_annual_other DECIMAL(12, 2),
ADD COLUMN IF NOT EXISTS overhead_annual_budget DECIMAL(12, 2),
ADD COLUMN IF NOT EXISTS overhead_expected_annual_gallons DECIMAL(10, 2),
ADD COLUMN IF NOT EXISTS overhead_rate_per_gallon DECIMAL(10, 4),
ADD COLUMN IF NOT EXISTS overhead_budget_year INTEGER;

-- Add comments for documentation
COMMENT ON COLUMN organization_settings.overhead_tracking_enabled IS 'Whether overhead tracking is enabled for COGS calculations';
COMMENT ON COLUMN organization_settings.overhead_annual_rent IS 'Annual rent/mortgage cost';
COMMENT ON COLUMN organization_settings.overhead_annual_utilities IS 'Annual utilities cost';
COMMENT ON COLUMN organization_settings.overhead_annual_insurance IS 'Annual insurance cost';
COMMENT ON COLUMN organization_settings.overhead_annual_equipment IS 'Annual equipment depreciation';
COMMENT ON COLUMN organization_settings.overhead_annual_licenses IS 'Annual licenses and permits cost';
COMMENT ON COLUMN organization_settings.overhead_annual_other IS 'Other annual fixed costs';
COMMENT ON COLUMN organization_settings.overhead_annual_budget IS 'Total annual overhead budget';
COMMENT ON COLUMN organization_settings.overhead_expected_annual_gallons IS 'Expected annual production in gallons';
COMMENT ON COLUMN organization_settings.overhead_rate_per_gallon IS 'Calculated overhead rate per gallon (budget / expected gallons)';
COMMENT ON COLUMN organization_settings.overhead_budget_year IS 'Budget year for overhead calculations';
