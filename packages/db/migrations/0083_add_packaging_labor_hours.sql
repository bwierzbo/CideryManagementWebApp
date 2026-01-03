-- Add labor hours tracking for pasteurization and labeling activities
-- These complement the existing labor_hours field (for bottling)

ALTER TABLE bottle_runs
ADD COLUMN pasteurization_labor_hours DECIMAL(6,2);

ALTER TABLE bottle_runs
ADD COLUMN labeling_labor_hours DECIMAL(6,2);

-- Add comments for documentation
COMMENT ON COLUMN bottle_runs.labor_hours IS 'Labor hours spent on bottling/filling';
COMMENT ON COLUMN bottle_runs.pasteurization_labor_hours IS 'Labor hours spent on pasteurization';
COMMENT ON COLUMN bottle_runs.labeling_labor_hours IS 'Labor hours spent on labeling';
