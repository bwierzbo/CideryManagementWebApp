-- Tax Reporting Preferences
-- Stores organization's state and reporting frequency preferences

-- State for tax filing (US states)
ALTER TABLE "organization_settings"
ADD COLUMN IF NOT EXISTS "tax_state" TEXT;

-- TTB Reporting Frequency
ALTER TABLE "organization_settings"
ADD COLUMN IF NOT EXISTS "ttb_reporting_frequency" TEXT DEFAULT 'quarterly';

-- State Tax Reporting Frequency (may differ from TTB)
ALTER TABLE "organization_settings"
ADD COLUMN IF NOT EXISTS "state_tax_reporting_frequency" TEXT DEFAULT 'quarterly';

-- Optional: Estimated annual tax liability for TTB frequency guidance
ALTER TABLE "organization_settings"
ADD COLUMN IF NOT EXISTS "estimated_annual_tax_liability" DECIMAL(10,2);

-- Add check constraints (separate statements for IF NOT EXISTS compatibility)
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'organization_settings_ttb_reporting_frequency_check'
  ) THEN
    ALTER TABLE "organization_settings"
    ADD CONSTRAINT "organization_settings_ttb_reporting_frequency_check"
    CHECK ("ttb_reporting_frequency" IN ('monthly', 'quarterly', 'annual'));
  END IF;
END $$;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'organization_settings_state_tax_reporting_frequency_check'
  ) THEN
    ALTER TABLE "organization_settings"
    ADD CONSTRAINT "organization_settings_state_tax_reporting_frequency_check"
    CHECK ("state_tax_reporting_frequency" IN ('monthly', 'quarterly', 'annual'));
  END IF;
END $$;
