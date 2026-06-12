-- Add "after_previous" trigger kind for recipe steps.
--
-- Fires the instant the previous step completes (no delay) — for chained
-- actions like "rack, then immediately add sugar". The CHECK constraint from
-- 0128_recipes_phase1.sql restricted trigger_kind to the original five values,
-- so inserts with the new kind violated recipe_steps_trigger_kind_valid.

ALTER TABLE recipe_steps
  DROP CONSTRAINT IF EXISTS recipe_steps_trigger_kind_valid;

ALTER TABLE recipe_steps
  ADD CONSTRAINT recipe_steps_trigger_kind_valid CHECK (
    trigger_kind IN ('date_offset_from_start', 'date_offset_from_previous',
                     'after_previous', 'sg_threshold', 'sg_terminal_confirmed',
                     'manual')
  );
