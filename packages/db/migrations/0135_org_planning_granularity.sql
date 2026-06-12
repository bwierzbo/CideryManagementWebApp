-- Production planning time-bucket granularity (user-defined in setup).
-- 'monthly' | 'quarterly'. Controls how the annual plan aggregates batches.

ALTER TABLE organization_settings
  ADD COLUMN IF NOT EXISTS planning_granularity TEXT NOT NULL DEFAULT 'monthly';

ALTER TABLE organization_settings
  DROP CONSTRAINT IF EXISTS organization_settings_planning_granularity_valid;

ALTER TABLE organization_settings
  ADD CONSTRAINT organization_settings_planning_granularity_valid CHECK (
    planning_granularity IN ('monthly', 'quarterly')
  );
