-- Comparable additive dosage intensity (grams per liter of batch).
-- Derived from amount + unit + batch volume at insert time; amount/unit remain
-- the as-entered source of truth. NULL for pure liquid-volume additions.
ALTER TABLE "batch_additives" ADD COLUMN IF NOT EXISTS "rate_grams_per_l" numeric(10, 4);
