-- Remove orphaned press_items that reference non-existent press_runs
DELETE FROM press_items
WHERE press_run_id NOT IN (
  SELECT id FROM apple_press_runs
);

-- Now the foreign key constraint can be safely added if it doesn't exist
-- (The constraint creation will be handled by Drizzle)