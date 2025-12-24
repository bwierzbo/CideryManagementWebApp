-- Remove aluminum from vessel_material enum
-- All aluminum vessels have been converted to stainless_steel

-- PostgreSQL doesn't support DROP VALUE from enum directly
-- We need to recreate the enum type

-- 1. Create new enum without aluminum
CREATE TYPE vessel_material_new AS ENUM ('stainless_steel', 'plastic', 'wood');

-- 2. Update the column to use the new type
ALTER TABLE vessels
  ALTER COLUMN material TYPE vessel_material_new
  USING material::text::vessel_material_new;

-- 3. Drop the old enum
DROP TYPE vessel_material;

-- 4. Rename new enum to original name
ALTER TYPE vessel_material_new RENAME TO vessel_material;
