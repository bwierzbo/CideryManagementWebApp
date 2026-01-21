-- Add TTB onboarding completion tracking
-- Tracks when a user has completed the initial TTB reconciliation wizard

ALTER TABLE organization_settings
ADD COLUMN ttb_onboarding_completed_at TIMESTAMPTZ;

COMMENT ON COLUMN organization_settings.ttb_onboarding_completed_at IS 'Timestamp when TTB onboarding wizard was completed. NULL means not yet completed.';
