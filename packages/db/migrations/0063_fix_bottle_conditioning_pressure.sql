-- Fix pressure constraint to allow zero for bottle conditioning
-- Bottle conditioning uses no applied pressure (carbonation from sugar fermentation)

-- Drop the old constraint
ALTER TABLE batch_carbonation_operations
DROP CONSTRAINT IF EXISTS valid_pressure;

-- Add the updated constraint that allows 0 pressure
ALTER TABLE batch_carbonation_operations
ADD CONSTRAINT valid_pressure
CHECK (pressure_applied >= 0::numeric AND pressure_applied <= 50::numeric);
