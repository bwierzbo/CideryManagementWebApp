-- Add label impact and allergens/vegan fields to additive_varieties table
ALTER TABLE additive_varieties
ADD COLUMN label_impact BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN label_impact_notes TEXT,
ADD COLUMN allergens_vegan BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN allergens_vegan_notes TEXT;