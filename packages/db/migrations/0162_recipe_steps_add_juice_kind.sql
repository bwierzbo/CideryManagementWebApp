-- Allow the add_juice recipe step kind (backsweetening with juice).
-- The application enum (packages/api/src/routers/recipes.ts STEP_KINDS)
-- already includes it; this brings the DB check constraint in sync.
ALTER TABLE recipe_steps DROP CONSTRAINT recipe_steps_kind_valid;
--> statement-breakpoint
ALTER TABLE recipe_steps ADD CONSTRAINT recipe_steps_kind_valid CHECK (
  kind IN (
    'pitch_yeast', 'add_additive', 'add_juice', 'measurement', 'rack',
    'filter', 'transfer', 'carbonate', 'package', 'pasteurize', 'label',
    'wait', 'qa_gate', 'note'
  )
);
