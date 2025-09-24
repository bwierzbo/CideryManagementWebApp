-- Update additive varieties to use the new enum values
UPDATE additive_varieties SET item_type = 'Enzymes' WHERE item_type = 'enzyme';
UPDATE additive_varieties SET item_type = 'Preservatives' WHERE item_type = 'preservative';
UPDATE additive_varieties SET item_type = 'Nutrients' WHERE item_type = 'nutrient';
UPDATE additive_varieties SET item_type = 'Acids' WHERE item_type = 'acid';
UPDATE additive_varieties SET item_type = 'Enzymes' WHERE item_type = 'clarifier';

-- Insert additional sample varieties with proper enum values
INSERT INTO additive_varieties (name, item_type) VALUES
('White Labs WLP775 English Cider Yeast', 'Yeasts'),
('Lallemand DistilaMax MW', 'Yeasts'),
('Malic Acid', 'Acids'),
('Tartaric Acid', 'Acids'),
('French Oak Cubes', 'Tannins & Mouthfeel'),
('Grape Tannin Powder', 'Tannins & Mouthfeel'),
('Dextrose (Corn Sugar)', 'Sweeteners & Body'),
('Lactose', 'Sweeteners & Body'),
('Vanilla Extract', 'Flavorings & Adjuncts'),
('Cinnamon Sticks', 'Flavorings & Adjuncts')
ON CONFLICT (name) DO NOTHING;