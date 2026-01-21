-- TTB Reconciliation Notes
-- Add notes field for documenting discrepancies between TTB and system inventory

ALTER TABLE "organization_settings"
ADD COLUMN IF NOT EXISTS "ttb_reconciliation_notes" TEXT;
