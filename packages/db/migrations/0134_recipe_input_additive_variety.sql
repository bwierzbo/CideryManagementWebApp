-- Link recipe ingredients to real inventory additive varieties.
--
-- Lets the recipe bill-of-materials resolve additive consumption to actual
-- stock. Nullable + ON DELETE SET NULL: free-text ingredients (no inventory
-- link) remain valid, and deleting a variety just unlinks it.

ALTER TABLE recipe_inputs
  ADD COLUMN IF NOT EXISTS additive_variety_id UUID
    REFERENCES additive_varieties(id) ON DELETE SET NULL;
