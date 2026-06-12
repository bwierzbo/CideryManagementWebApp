-- Add per-step packaging path to recipe steps.
--
-- Lets one recipe carry both the bottle and keg packaging tails. Shared steps
-- stay 'all'; bottle-only steps (e.g. Pasteurize, Label, the bottle Package
-- step) are 'bottle'; keg-only steps are 'keg'. A batch can be split across
-- formats (e.g. 600 L kegged, 400 L bottled), so both tails can run on one
-- batch on their respective volume portions.

ALTER TABLE recipe_steps
  ADD COLUMN IF NOT EXISTS packaging_path TEXT NOT NULL DEFAULT 'all';

ALTER TABLE recipe_steps
  DROP CONSTRAINT IF EXISTS recipe_steps_packaging_path_valid;

ALTER TABLE recipe_steps
  ADD CONSTRAINT recipe_steps_packaging_path_valid CHECK (
    packaging_path IN ('all', 'bottle', 'keg')
  );
