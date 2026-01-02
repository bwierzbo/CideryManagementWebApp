-- Add business profile fields to organization_settings
-- These fields are needed for invoices, receipts, and official business documents

ALTER TABLE "organization_settings" ADD COLUMN IF NOT EXISTS "email" text;
ALTER TABLE "organization_settings" ADD COLUMN IF NOT EXISTS "ubi_number" text;
ALTER TABLE "organization_settings" ADD COLUMN IF NOT EXISTS "ein_number" text;
