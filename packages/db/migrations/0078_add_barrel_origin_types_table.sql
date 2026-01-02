-- Create barrel_origin_types table for user-configurable barrel previous contents
CREATE TABLE barrel_origin_types (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  slug TEXT NOT NULL,
  description TEXT,
  sort_order INTEGER NOT NULL DEFAULT 0,
  is_active BOOLEAN NOT NULL DEFAULT true,
  is_system BOOLEAN NOT NULL DEFAULT false,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW()
);

-- Unique index on slug
CREATE UNIQUE INDEX barrel_origin_types_slug_unique_idx ON barrel_origin_types(slug);

-- Index for sorting
CREATE INDEX barrel_origin_types_sort_order_idx ON barrel_origin_types(sort_order);

-- Seed with default barrel origin types (matching existing enum values)
INSERT INTO barrel_origin_types (name, slug, sort_order, is_system) VALUES
  ('Bourbon', 'bourbon', 1, true),
  ('Rye Whiskey', 'rye', 2, true),
  ('Red Wine', 'wine_red', 3, true),
  ('White Wine', 'wine_white', 4, true),
  ('Brandy', 'brandy', 5, true),
  ('Calvados', 'calvados', 6, true),
  ('Rum', 'rum', 7, true),
  ('Sherry', 'sherry', 8, true),
  ('Port', 'port', 9, true),
  ('New Oak (never used)', 'new_oak', 10, true),
  ('Neutral (no flavor)', 'neutral', 11, true),
  ('Other', 'other', 100, true);

-- Change vessels.barrel_origin_contents from enum to text to allow user-defined values
ALTER TABLE vessels ALTER COLUMN barrel_origin_contents TYPE TEXT;
