-- Recipe authoring: optional steps + style templates.
--
-- is_optional lets one recipe cover divergent finishes (force-carbonate vs
-- bottle-condition, optional pasteurization) by marking situational steps the
-- operator skips/includes per batch — no separate recipe variants needed.
--
-- is_template marks a recipe as a reusable style starting point (e.g. "Fruited
-- cider", "Bottle-conditioned single varietal"), cloned to make specific recipes.

ALTER TABLE recipe_steps
  ADD COLUMN IF NOT EXISTS is_optional BOOLEAN NOT NULL DEFAULT FALSE;

ALTER TABLE recipes
  ADD COLUMN IF NOT EXISTS is_template BOOLEAN NOT NULL DEFAULT FALSE;
