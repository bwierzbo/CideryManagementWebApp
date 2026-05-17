-- Per-additive volume contribution support.
--
-- Most additives (yeast, nutrients, acids) have negligible volume and don't
-- affect batch volume. But honey, fruit purée, juice concentrate, sugar
-- syrup, and brandy/spirits add material liquid volume that must be tracked
-- — especially for cyser, mead, fortified ciders, and fruit wines.
--
-- Two pieces:
--   1. batch_additives.volume_added_l: per-addition liters contributed.
--      NULL when negligible (the default for most additives).
--   2. additive_volume_defaults: user-managed table of (type + optional
--      name pattern → density). Used by the form to suggest a sensible
--      default volume contribution when the operator records an addition.

ALTER TABLE batch_additives
  ADD COLUMN volume_added_l DECIMAL(10, 3);

CREATE TABLE additive_volume_defaults (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  -- Matches batch_additives.additive_type values
  -- (e.g., "Sugar & Sweeteners", "Fruit/Fruit Product", "Flavorings & Adjuncts")
  additive_type TEXT NOT NULL,
  -- Optional case-insensitive substring to match against additive_name.
  -- NULL means it applies to every additive of this type.
  name_pattern TEXT,
  -- Density in kg per liter. volume_l = mass_kg / density_kg_per_l.
  density_kg_per_l DECIMAL(6, 3) NOT NULL,
  -- Friendly label shown in the settings UI.
  display_label TEXT NOT NULL,
  -- Optional explanation visible to operators.
  notes TEXT,
  -- Lower = matched first when multiple rules apply.
  sort_order INT NOT NULL DEFAULT 0,
  is_active BOOLEAN NOT NULL DEFAULT TRUE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  created_by UUID REFERENCES users(id),
  updated_by UUID REFERENCES users(id),
  deleted_at TIMESTAMPTZ,

  CONSTRAINT additive_volume_defaults_density_positive CHECK (density_kg_per_l > 0)
);

CREATE INDEX additive_volume_defaults_active_type_idx
  ON additive_volume_defaults (additive_type, sort_order)
  WHERE deleted_at IS NULL AND is_active = TRUE;
