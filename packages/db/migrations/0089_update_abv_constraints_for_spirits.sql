-- Update ABV constraints to allow spirits (brandy up to 100%)
-- Previously limited to 0-30% which only works for cider/perry

-- Drop old constraints
ALTER TABLE batches DROP CONSTRAINT IF EXISTS check_estimated_abv_range;
ALTER TABLE batches DROP CONSTRAINT IF EXISTS check_actual_abv_range;

-- Add new constraints allowing up to 100% for spirits
ALTER TABLE batches
    ADD CONSTRAINT check_estimated_abv_range
        CHECK (estimated_abv IS NULL OR (estimated_abv >= 0 AND estimated_abv <= 100));

ALTER TABLE batches
    ADD CONSTRAINT check_actual_abv_range
        CHECK (actual_abv IS NULL OR (actual_abv >= 0 AND actual_abv <= 100));
