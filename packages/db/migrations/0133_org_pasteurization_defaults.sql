-- Default pasteurization assumptions on organization settings.
--
-- These pre-fill the Pasteurize recipe step (editable per step). PU =
-- pasteurization units (Craft Metrics formula, 60°C reference). Sensible
-- starting defaults: 20 PU, 64°C, 20 min.

ALTER TABLE organization_settings
  ADD COLUMN IF NOT EXISTS default_pasteurization_target_pu    NUMERIC(5,1) NOT NULL DEFAULT 20.0,
  ADD COLUMN IF NOT EXISTS default_pasteurization_temp_c       NUMERIC(4,1) NOT NULL DEFAULT 64.0,
  ADD COLUMN IF NOT EXISTS default_pasteurization_time_minutes NUMERIC(5,1) NOT NULL DEFAULT 20.0;
