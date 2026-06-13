-- Production planning: named plans (scenarios) + planned batches.
--
-- A planned batch is a recipe × target volume × period × bottle/keg split.
-- The planner sums each batch's bill-of-materials into per-period inventory
-- requirements. Plans are scenarios: an org saves several, marks one
-- operational (enforced in the mutation layer, not here).

CREATE TABLE IF NOT EXISTS production_plans (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  name            TEXT NOT NULL,
  year            INTEGER,
  is_operational  BOOLEAN NOT NULL DEFAULT FALSE,
  notes           TEXT,
  created_by      UUID REFERENCES users(id),
  created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_by      UUID REFERENCES users(id),
  updated_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  deleted_at      TIMESTAMPTZ
);

CREATE INDEX IF NOT EXISTS production_plans_org_idx
  ON production_plans (organization_id);

CREATE TABLE IF NOT EXISTS planned_batches (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  plan_id         UUID NOT NULL REFERENCES production_plans(id) ON DELETE CASCADE,
  recipe_id       UUID NOT NULL REFERENCES recipes(id) ON DELETE CASCADE,
  label           TEXT,
  target_volume_l NUMERIC(12, 3) NOT NULL,
  bottle_volume_l NUMERIC(12, 3),
  keg_volume_l    NUMERIC(12, 3),
  period          TEXT NOT NULL,
  sort_order      INTEGER NOT NULL DEFAULT 0,
  notes           TEXT,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS planned_batches_plan_idx
  ON planned_batches (plan_id, sort_order);

CREATE INDEX IF NOT EXISTS planned_batches_recipe_idx
  ON planned_batches (recipe_id);
