-- Migration: Unified Packaging Workflow
-- Aligns bottle and keg workflows to follow consistent pattern:
-- Package -> QA -> (Ready) -> Distribute -> Complete

-- 1. Add new status values to bottle_run_status enum
ALTER TYPE bottle_run_status ADD VALUE IF NOT EXISTS 'ready' AFTER 'active';
ALTER TYPE bottle_run_status ADD VALUE IF NOT EXISTS 'distributed' AFTER 'ready';

-- 2. Add new status value to keg_fill_status enum
ALTER TYPE keg_fill_status ADD VALUE IF NOT EXISTS 'ready' AFTER 'filled';

-- 3. Add distribution and ready columns to bottle_runs
ALTER TABLE bottle_runs ADD COLUMN IF NOT EXISTS ready_at TIMESTAMP;
ALTER TABLE bottle_runs ADD COLUMN IF NOT EXISTS ready_by UUID REFERENCES users(id);
ALTER TABLE bottle_runs ADD COLUMN IF NOT EXISTS distributed_at TIMESTAMP;
ALTER TABLE bottle_runs ADD COLUMN IF NOT EXISTS distributed_by UUID REFERENCES users(id);
ALTER TABLE bottle_runs ADD COLUMN IF NOT EXISTS distribution_location TEXT;
ALTER TABLE bottle_runs ADD COLUMN IF NOT EXISTS bottle_run_sales_channel_id UUID REFERENCES sales_channels(id);

-- 4. Add ready columns to keg_fills
ALTER TABLE keg_fills ADD COLUMN IF NOT EXISTS ready_at TIMESTAMP;
ALTER TABLE keg_fills ADD COLUMN IF NOT EXISTS ready_by UUID REFERENCES users(id);

-- 5. Add indexes for new columns
CREATE INDEX IF NOT EXISTS bottle_runs_ready_at_idx ON bottle_runs(ready_at);
CREATE INDEX IF NOT EXISTS bottle_runs_distributed_at_idx ON bottle_runs(distributed_at);
CREATE INDEX IF NOT EXISTS bottle_runs_sales_channel_idx ON bottle_runs(bottle_run_sales_channel_id);
CREATE INDEX IF NOT EXISTS keg_fills_ready_at_idx ON keg_fills(ready_at);
