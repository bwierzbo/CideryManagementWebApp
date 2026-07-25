-- Phase 7 C6: capture the distributor identity on a wholesale distribution.
-- Nullable — the LIQ-777 (WA distributor breakdown) deferral decision is to
-- capture the distributor name going forward now, and generate Form 777 later.
-- Existing rows keep NULL; the field is only surfaced when the sales channel is
-- wholesale.
ALTER TABLE inventory_distributions
  ADD COLUMN distributor_name text;
