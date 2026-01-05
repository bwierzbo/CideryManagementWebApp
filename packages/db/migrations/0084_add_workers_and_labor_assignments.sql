-- Migration: Add workers table and activity labor assignments
-- Enables worker-based labor tracking with individual hourly rates

-- Create workers table
CREATE TABLE IF NOT EXISTS workers (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  hourly_rate DECIMAL(10, 2) NOT NULL DEFAULT '20.00',
  email TEXT,
  phone TEXT,
  is_active BOOLEAN NOT NULL DEFAULT true,
  sort_order INTEGER NOT NULL DEFAULT 0,
  notes TEXT,
  created_at TIMESTAMP NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMP NOT NULL DEFAULT NOW(),
  deleted_at TIMESTAMP
);

CREATE INDEX IF NOT EXISTS workers_name_idx ON workers(name);
CREATE INDEX IF NOT EXISTS workers_is_active_idx ON workers(is_active);
CREATE INDEX IF NOT EXISTS workers_sort_order_idx ON workers(sort_order);

-- Create activity labor type enum
DO $$ BEGIN
  CREATE TYPE activity_labor_type AS ENUM (
    'press_run',
    'bottle_run',
    'pasteurization',
    'labeling',
    'keg_fill',
    'racking',
    'filtering',
    'cleaning'
  );
EXCEPTION
  WHEN duplicate_object THEN null;
END $$;

-- Create activity labor assignments table (polymorphic design)
CREATE TABLE IF NOT EXISTS activity_labor_assignments (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  activity_type activity_labor_type NOT NULL,
  -- Polymorphic activity references (only one populated based on activity_type)
  press_run_id UUID REFERENCES press_runs(id) ON DELETE CASCADE,
  bottle_run_id UUID REFERENCES bottle_runs(id) ON DELETE CASCADE,
  keg_fill_id UUID REFERENCES keg_fills(id) ON DELETE CASCADE,
  -- Worker assignment
  worker_id UUID NOT NULL REFERENCES workers(id),
  -- Hours worked by this specific worker
  hours_worked DECIMAL(6, 2) NOT NULL,
  -- Snapshot of hourly rate at time of assignment (for accurate COGS)
  hourly_rate_snapshot DECIMAL(10, 2) NOT NULL,
  -- Computed labor cost (hours_worked * hourly_rate_snapshot)
  labor_cost DECIMAL(10, 2) NOT NULL,
  -- Optional notes
  notes TEXT,
  -- Audit fields
  created_at TIMESTAMP NOT NULL DEFAULT NOW(),
  created_by UUID REFERENCES users(id),
  updated_at TIMESTAMP NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS activity_labor_assignments_worker_idx ON activity_labor_assignments(worker_id);
CREATE INDEX IF NOT EXISTS activity_labor_assignments_press_run_idx ON activity_labor_assignments(press_run_id);
CREATE INDEX IF NOT EXISTS activity_labor_assignments_bottle_run_idx ON activity_labor_assignments(bottle_run_id);
CREATE INDEX IF NOT EXISTS activity_labor_assignments_keg_fill_idx ON activity_labor_assignments(keg_fill_id);
CREATE INDEX IF NOT EXISTS activity_labor_assignments_activity_type_idx ON activity_labor_assignments(activity_type);

-- Create a default worker for migration of existing labor data
INSERT INTO workers (id, name, hourly_rate, notes, is_active)
VALUES (
  '00000000-0000-0000-0000-000000000001',
  'Default Worker (Migrated)',
  '20.00',
  'Auto-created for migration of existing labor data. Update or replace as needed.',
  true
) ON CONFLICT (id) DO NOTHING;

-- Migrate existing press_runs labor data to new system
INSERT INTO activity_labor_assignments (
  activity_type, press_run_id, worker_id, hours_worked, hourly_rate_snapshot, labor_cost
)
SELECT
  'press_run'::activity_labor_type,
  id,
  '00000000-0000-0000-0000-000000000001',
  COALESCE(labor_hours, 0),
  COALESCE(labor_cost_per_hour, 20.00),
  COALESCE(total_labor_cost, COALESCE(labor_hours, 0) * COALESCE(labor_cost_per_hour, 20.00))
FROM press_runs
WHERE labor_hours IS NOT NULL AND labor_hours > 0
ON CONFLICT DO NOTHING;

-- Migrate existing bottle_runs labor data (bottling)
INSERT INTO activity_labor_assignments (
  activity_type, bottle_run_id, worker_id, hours_worked, hourly_rate_snapshot, labor_cost
)
SELECT
  'bottle_run'::activity_labor_type,
  id,
  '00000000-0000-0000-0000-000000000001',
  COALESCE(labor_hours, 0),
  COALESCE(labor_cost_per_hour, 20.00),
  COALESCE(labor_hours, 0) * COALESCE(labor_cost_per_hour, 20.00)
FROM bottle_runs
WHERE labor_hours IS NOT NULL AND labor_hours > 0
ON CONFLICT DO NOTHING;

-- Migrate existing bottle_runs pasteurization labor
INSERT INTO activity_labor_assignments (
  activity_type, bottle_run_id, worker_id, hours_worked, hourly_rate_snapshot, labor_cost
)
SELECT
  'pasteurization'::activity_labor_type,
  id,
  '00000000-0000-0000-0000-000000000001',
  COALESCE(pasteurization_labor_hours, 0),
  COALESCE(labor_cost_per_hour, 20.00),
  COALESCE(pasteurization_labor_hours, 0) * COALESCE(labor_cost_per_hour, 20.00)
FROM bottle_runs
WHERE pasteurization_labor_hours IS NOT NULL AND pasteurization_labor_hours > 0
ON CONFLICT DO NOTHING;

-- Migrate existing bottle_runs labeling labor
INSERT INTO activity_labor_assignments (
  activity_type, bottle_run_id, worker_id, hours_worked, hourly_rate_snapshot, labor_cost
)
SELECT
  'labeling'::activity_labor_type,
  id,
  '00000000-0000-0000-0000-000000000001',
  COALESCE(labeling_labor_hours, 0),
  COALESCE(labor_cost_per_hour, 20.00),
  COALESCE(labeling_labor_hours, 0) * COALESCE(labor_cost_per_hour, 20.00)
FROM bottle_runs
WHERE labeling_labor_hours IS NOT NULL AND labeling_labor_hours > 0
ON CONFLICT DO NOTHING;

-- Note: Old fields (labor_hours, labor_cost_per_hour, total_labor_cost) are NOT dropped
-- They will be deprecated but kept for backward compatibility during transition
-- A future migration can drop them after verifying data integrity
