-- Recipe execution (Phase 5 — work queue).
--
-- batch_recipe_executions: links a batch to the recipe version it runs. One
-- active execution per batch (unique batch_id). mode = 'new' | 'attach'.
-- batch_step_tasks: a snapshot of each recipe step at instantiation, so editing
-- the recipe template never disrupts an in-flight batch. Drives the work queue.

CREATE TABLE IF NOT EXISTS batch_recipe_executions (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  batch_id        UUID NOT NULL REFERENCES batches(id) ON DELETE CASCADE,
  recipe_id       UUID NOT NULL REFERENCES recipes(id),
  recipe_version  INTEGER NOT NULL,
  mode            TEXT NOT NULL,
  start_date      TIMESTAMPTZ NOT NULL,
  bottle_volume_l NUMERIC(12, 3),
  keg_volume_l    NUMERIC(12, 3),
  status          TEXT NOT NULL DEFAULT 'active',
  created_by      UUID REFERENCES users(id),
  created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE UNIQUE INDEX IF NOT EXISTS batch_recipe_executions_batch_unique
  ON batch_recipe_executions (batch_id);

CREATE TABLE IF NOT EXISTS batch_step_tasks (
  id                 UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  execution_id       UUID NOT NULL REFERENCES batch_recipe_executions(id) ON DELETE CASCADE,
  batch_id           UUID NOT NULL REFERENCES batches(id) ON DELETE CASCADE,
  sequence           INTEGER NOT NULL,
  kind               TEXT NOT NULL,
  label              TEXT NOT NULL,
  description        TEXT,
  packaging_path     TEXT NOT NULL DEFAULT 'all',
  is_optional        BOOLEAN NOT NULL DEFAULT FALSE,
  trigger_kind       TEXT NOT NULL DEFAULT 'manual',
  trigger_data       JSONB NOT NULL DEFAULT '{}'::jsonb,
  action_data        JSONB NOT NULL DEFAULT '{}'::jsonb,
  scheduled_date     TIMESTAMPTZ,
  status             TEXT NOT NULL DEFAULT 'pending',
  completed_at       TIMESTAMPTZ,
  assigned_worker_id UUID REFERENCES workers(id),
  result_ref         JSONB,
  estimated_hours    NUMERIC(6, 2),
  actual_hours       NUMERIC(6, 2),
  notes              TEXT,
  created_at         TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at         TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS batch_step_tasks_exec_seq_idx
  ON batch_step_tasks (execution_id, sequence);
CREATE INDEX IF NOT EXISTS batch_step_tasks_batch_idx
  ON batch_step_tasks (batch_id);
CREATE INDEX IF NOT EXISTS batch_step_tasks_status_sched_idx
  ON batch_step_tasks (status, scheduled_date);
