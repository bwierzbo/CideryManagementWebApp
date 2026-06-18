-- Captured actuals on a recipe-execution task: what the operator actually did
-- (amount, destination vessel, readings, …) vs the plan. Capture-first; real
-- operations wired in later.
ALTER TABLE batch_step_tasks
  ADD COLUMN IF NOT EXISTS actual_data JSONB;
