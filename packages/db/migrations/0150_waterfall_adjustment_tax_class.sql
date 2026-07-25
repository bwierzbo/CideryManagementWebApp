-- Phase 6 (reconciliation-robustness-plan): class-scoped waterfall adjustments.
-- A waterfall adjustment may now optionally target a single TTB tax class.
--   tax_class  NULL  = aggregate-level (existing behavior; reduces only the
--                      aggregate unexplained total — preserves prior rows).
--   tax_class  value = a TTB tax class key (hardCider, wineUnder16, …). Its
--                      signed ending-effect reduces BOTH that class's per-class
--                      unexplained variance AND the aggregate, so an over-
--                      tolerance class can be accepted-with-reason and locked.
ALTER TABLE ttb_waterfall_adjustments ADD COLUMN tax_class text;
