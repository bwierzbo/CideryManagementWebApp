-- Phase 1 of the recipe / batch planning system.
--
-- Adds:
--   1. recipes               — current/active recipe template (the "head")
--   2. recipe_inputs         — what goes IN (ingredients with rates, parent batch requirements)
--   3. recipe_steps          — what HAPPENS (ordered steps with kind-specific action_data JSONB)
--   4. recipe_versions       — full JSONB snapshot per saved version (auto-snapshot on update)
--   5. users.permission_overrides — per-user fine-grained permission flags layered over role defaults
--
-- Design notes:
--   - Hybrid normalized + JSONB: indexable common fields (kind, sequence, recipe_id) +
--     flexible kind-specific data (action_data, trigger_data) so we can add step kinds
--     without schema changes.
--   - Versions are full JSONB snapshots — recipes are read-mostly historical record
--     once committed; we rarely query inside an old version.
--   - All status / kind enums are TEXT with CHECK constraints (cheaper to evolve than pg
--     enums, which require a migration to add a value).

-- ---------------------------------------------------------------------------
-- 1. Recipes (head row — represents the current/active version)
-- ---------------------------------------------------------------------------
CREATE TABLE recipes (
  id               UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name             TEXT NOT NULL,
  description      TEXT,
  product_type     product_type NOT NULL,

  -- Top-level checklist of which sections are enabled. Drives which sections
  -- of the builder are visible. Shape is flexible — e.g.:
  --   { "nutrient_plan": true, "carbonation_plan": true, "pasteurization": false,
  --     "labeling": true, ... }
  enabled_sections JSONB NOT NULL DEFAULT '{}'::jsonb,

  -- Current version number — incremented each time the recipe is saved.
  -- Each version is also frozen as a row in recipe_versions.
  current_version  INT NOT NULL DEFAULT 1,

  -- draft | active | archived
  status           TEXT NOT NULL DEFAULT 'draft',

  notes            TEXT,

  created_by       UUID REFERENCES users(id),
  created_at       TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_by       UUID REFERENCES users(id),
  updated_at       TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  archived_at      TIMESTAMPTZ,

  CONSTRAINT recipes_status_valid CHECK (status IN ('draft', 'active', 'archived')),
  CONSTRAINT recipes_version_positive CHECK (current_version >= 1)
);

CREATE INDEX recipes_product_type_idx  ON recipes (product_type);
CREATE INDEX recipes_status_idx        ON recipes (status) WHERE archived_at IS NULL;
CREATE INDEX recipes_created_by_idx    ON recipes (created_by);
CREATE INDEX recipes_name_lower_idx    ON recipes (LOWER(name));

-- ---------------------------------------------------------------------------
-- 2. Recipe inputs — ingredients + parent batch requirements
-- ---------------------------------------------------------------------------
CREATE TABLE recipe_inputs (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  recipe_id       UUID NOT NULL REFERENCES recipes(id) ON DELETE CASCADE,

  -- "ingredient"               — a measurable additive (yeast, fruit, sugar, etc.)
  -- "parent_batch_requirement" — e.g. "60L of cider at terminal SG"
  -- "press_run_requirement"    — e.g. "120L of pressed juice with apple variety mix"
  -- "juice_purchase_requirement" — purchased juice as input
  kind            TEXT NOT NULL,

  -- Display label for the input (operator-facing). e.g. "Strawberries", "Base Cider"
  label           TEXT NOT NULL,

  -- For "ingredient" kind:
  additive_type   TEXT,    -- e.g. "Sugar & Sweeteners", "Fermentation Organisms"
  additive_name   TEXT,    -- e.g. "Honey", "AB-1"

  -- Rate is the scale-invariant amount per liter of finished batch.
  -- e.g. 75 + "g/L" means 75 grams per liter of target batch volume.
  -- For a 240L batch → 18 kg of this ingredient.
  rate_value      NUMERIC(12, 4),
  rate_unit       TEXT,    -- "g/L", "kg/L", "mL/L", "L/L", "ppm", or "%v/v"

  -- For "parent_batch_requirement" kind: what kind of source batch satisfies this input.
  source_product_type product_type,

  -- For all kinds: optional preferred density (kg/L). When set + the ingredient has a
  -- mass rate but contributes liquid volume (honey, brandy, fruit purée), the wizard
  -- can pre-compute the volume_added_l contribution for the additive.
  density_kg_per_l NUMERIC(8, 4),

  -- Display order in the recipe.
  sort_order      INT NOT NULL DEFAULT 0,

  -- Operator-facing notes (e.g. "Use cold-extracted honey only").
  notes           TEXT,

  created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),

  CONSTRAINT recipe_inputs_kind_valid CHECK (
    kind IN ('ingredient', 'parent_batch_requirement', 'press_run_requirement', 'juice_purchase_requirement')
  ),
  CONSTRAINT recipe_inputs_rate_positive CHECK (rate_value IS NULL OR rate_value >= 0),
  CONSTRAINT recipe_inputs_density_positive CHECK (density_kg_per_l IS NULL OR density_kg_per_l > 0)
);

CREATE INDEX recipe_inputs_recipe_idx       ON recipe_inputs (recipe_id, sort_order);
CREATE INDEX recipe_inputs_additive_idx     ON recipe_inputs (additive_type, additive_name)
  WHERE kind = 'ingredient';

-- ---------------------------------------------------------------------------
-- 3. Recipe steps — ordered process
-- ---------------------------------------------------------------------------
CREATE TABLE recipe_steps (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  recipe_id     UUID NOT NULL REFERENCES recipes(id) ON DELETE CASCADE,

  -- pitch_yeast | add_additive | measurement | rack | filter | transfer
  -- | carbonate | package | pasteurize | label | wait | qa_gate | note
  kind          TEXT NOT NULL,

  sequence      INT  NOT NULL,
  label         TEXT NOT NULL,
  description   TEXT,

  -- Trigger: when does this step "fire" / become ready?
  -- "date_offset_from_start"     — N days after batch start
  -- "date_offset_from_previous"  — N days after previous step completed
  -- "sg_threshold"               — when SG crosses a value (with direction)
  -- "sg_terminal_confirmed"      — when terminal SG has been confirmed (2 readings ≥48h apart)
  -- "manual"                     — operator decides; no auto-schedule
  trigger_kind  TEXT NOT NULL DEFAULT 'manual',

  -- Trigger parameters. Shape depends on trigger_kind:
  --   date_offset_*   → { "days": 14 }   or  { "hours": 48 }
  --   sg_threshold    → { "sg": 1.005, "direction": "below" }
  --   sg_terminal_confirmed → {}
  --   manual          → {}
  trigger_data  JSONB NOT NULL DEFAULT '{}'::jsonb,

  -- Action specifics (kind-dependent JSONB). Examples:
  --   add_additive  → { "input_id": "<recipe_input.id>", "rate_value": 75, "rate_unit": "g/L" }
  --   measurement   → { "types": ["sg", "ph", "temperature"] }
  --   rack          → { "from_vessel_kind": "fermenter", "to_vessel_kind": "barrel" }
  --   carbonate     → { "method": "forced", "target_co2_volumes": 2.4 }
  --   package       → { "package_type": "bottle", "size_ml": 750 }
  action_data   JSONB NOT NULL DEFAULT '{}'::jsonb,

  -- Estimated time the step takes to execute (for scheduling / labor planning).
  estimated_duration_hours NUMERIC(6, 2),

  -- Operator-facing notes (e.g. "Pitch at 18°C, stir gently for 30 sec").
  notes         TEXT,

  created_at    TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at    TIMESTAMPTZ NOT NULL DEFAULT NOW(),

  CONSTRAINT recipe_steps_kind_valid CHECK (
    kind IN ('pitch_yeast', 'add_additive', 'measurement', 'rack', 'filter', 'transfer',
             'carbonate', 'package', 'pasteurize', 'label', 'wait', 'qa_gate', 'note')
  ),
  CONSTRAINT recipe_steps_trigger_kind_valid CHECK (
    trigger_kind IN ('date_offset_from_start', 'date_offset_from_previous',
                     'sg_threshold', 'sg_terminal_confirmed', 'manual')
  ),
  CONSTRAINT recipe_steps_sequence_positive CHECK (sequence >= 0),
  CONSTRAINT recipe_steps_duration_positive CHECK (
    estimated_duration_hours IS NULL OR estimated_duration_hours >= 0
  ),

  -- Sequence must be unique within a recipe (no two steps share an order)
  UNIQUE (recipe_id, sequence)
);

CREATE INDEX recipe_steps_recipe_seq_idx ON recipe_steps (recipe_id, sequence);
CREATE INDEX recipe_steps_kind_idx       ON recipe_steps (kind);

-- ---------------------------------------------------------------------------
-- 4. Recipe versions — full JSONB snapshot per saved revision
-- ---------------------------------------------------------------------------
CREATE TABLE recipe_versions (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  recipe_id       UUID NOT NULL REFERENCES recipes(id) ON DELETE CASCADE,
  version         INT  NOT NULL,

  -- Full immutable snapshot of the recipe at this version.
  -- Shape: { recipe: {...}, inputs: [...], steps: [...] }
  -- Includes all fields needed to reconstruct the recipe exactly.
  snapshot        JSONB NOT NULL,

  -- Optional human-readable summary of what changed in this version.
  change_summary  TEXT,

  created_by      UUID REFERENCES users(id),
  created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),

  CONSTRAINT recipe_versions_version_positive CHECK (version >= 1),
  UNIQUE (recipe_id, version)
);

CREATE INDEX recipe_versions_recipe_idx ON recipe_versions (recipe_id, version DESC);

-- ---------------------------------------------------------------------------
-- 5. Per-user permission overrides
-- ---------------------------------------------------------------------------
-- Layered over the role's default permissions. Format:
--   { "recipe:author": true, "plan:edit": false, ... }
-- A flag set to true GRANTS the permission even if the role doesn't have it.
-- A flag set to false DENIES the permission even if the role does have it.
-- Admin manages this through the user-management UI.
ALTER TABLE users
  ADD COLUMN permission_overrides JSONB NOT NULL DEFAULT '{}'::jsonb;
