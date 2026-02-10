-- Add TTB classification config column to organization_settings
-- Stores configurable TTB classification thresholds, tax rates, and CBMA credits as JSONB
-- NULL means use application defaults (DEFAULT_TTB_CLASSIFICATION_CONFIG)
ALTER TABLE "organization_settings" ADD COLUMN "ttb_classification_config" jsonb;
