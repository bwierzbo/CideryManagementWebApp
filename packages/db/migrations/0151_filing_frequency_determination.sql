-- Phase 7 C2 (filing-frequency-determination): persist the filing-frequency
-- determination on organization_settings so an admin can confirm the computed
-- federal (27 CFR 24.271 / 24.300) and WA (LIQ-774) filing cadence and the app
-- can flag drift/staleness against the stored reporting frequencies.
--
--   ttb_frequency_determination  jsonb blob of the last computed determination
--                                (federal returnPeriod/reportFrequency + reasons,
--                                WA frequency, and the numeric inputs it derived
--                                from). Written by ttb.confirmFilingFrequency.
--   ttb_frequency_confirmed_at   when an admin last confirmed the determination;
--                                a confirmation >1 year old is treated as stale.
--   ttb_frequency_confirmed_by   the admin user who confirmed it.
--   wa_board_annual_approval     whether the WSLCB has approved annual LIQ-774
--                                filing. Annual state filing requires BOTH
--                                taxable sales <=6,000 gal/year AND this approval.
ALTER TABLE organization_settings ADD COLUMN ttb_frequency_determination jsonb;
--> statement-breakpoint
ALTER TABLE organization_settings ADD COLUMN ttb_frequency_confirmed_at timestamptz;
--> statement-breakpoint
ALTER TABLE organization_settings ADD COLUMN ttb_frequency_confirmed_by uuid REFERENCES users(id);
--> statement-breakpoint
ALTER TABLE organization_settings ADD COLUMN wa_board_annual_approval boolean NOT NULL DEFAULT false;
--> statement-breakpoint
-- The owner confirmed (2026-07-24) that WA WSLCB annual-filing approval is on
-- file, so seed the existing org-settings row(s) to reflect that. New rows keep
-- the safe default (false) until approval is confirmed.
UPDATE organization_settings SET wa_board_annual_approval = true;
