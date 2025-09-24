-- Create additive varieties table
CREATE TABLE additive_varieties (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL,
  item_type text NOT NULL,
  is_active boolean NOT NULL DEFAULT true,
  created_at timestamp NOT NULL DEFAULT now(),
  updated_at timestamp NOT NULL DEFAULT now(),
  deleted_at timestamp
);

-- Create unique index on additive variety name
CREATE UNIQUE INDEX additive_varieties_name_unique_idx ON additive_varieties(name);

-- Create vendor-additive variety linking table
CREATE TABLE vendor_additive_varieties (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  vendor_id uuid NOT NULL REFERENCES vendors(id) ON DELETE CASCADE,
  variety_id uuid NOT NULL REFERENCES additive_varieties(id) ON DELETE CASCADE,
  notes text,
  created_at timestamp NOT NULL DEFAULT now(),
  updated_at timestamp NOT NULL DEFAULT now(),
  deleted_at timestamp
);

-- Create indexes for vendor-additive varieties
CREATE UNIQUE INDEX vendor_additive_varieties_vendor_variety_unique_idx ON vendor_additive_varieties(vendor_id, variety_id);
CREATE INDEX vendor_additive_varieties_vendor_idx ON vendor_additive_varieties(vendor_id);
CREATE INDEX vendor_additive_varieties_variety_idx ON vendor_additive_varieties(variety_id);

-- Create juice varieties table
CREATE TABLE juice_varieties (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL,
  item_type text NOT NULL,
  is_active boolean NOT NULL DEFAULT true,
  created_at timestamp NOT NULL DEFAULT now(),
  updated_at timestamp NOT NULL DEFAULT now(),
  deleted_at timestamp
);

-- Create unique index on juice variety name
CREATE UNIQUE INDEX juice_varieties_name_unique_idx ON juice_varieties(name);

-- Create vendor-juice variety linking table
CREATE TABLE vendor_juice_varieties (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  vendor_id uuid NOT NULL REFERENCES vendors(id) ON DELETE CASCADE,
  variety_id uuid NOT NULL REFERENCES juice_varieties(id) ON DELETE CASCADE,
  notes text,
  created_at timestamp NOT NULL DEFAULT now(),
  updated_at timestamp NOT NULL DEFAULT now(),
  deleted_at timestamp
);

-- Create indexes for vendor-juice varieties
CREATE UNIQUE INDEX vendor_juice_varieties_vendor_variety_unique_idx ON vendor_juice_varieties(vendor_id, variety_id);
CREATE INDEX vendor_juice_varieties_vendor_idx ON vendor_juice_varieties(vendor_id);
CREATE INDEX vendor_juice_varieties_variety_idx ON vendor_juice_varieties(variety_id);

-- Create packaging varieties table
CREATE TABLE packaging_varieties (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL,
  item_type text NOT NULL,
  is_active boolean NOT NULL DEFAULT true,
  created_at timestamp NOT NULL DEFAULT now(),
  updated_at timestamp NOT NULL DEFAULT now(),
  deleted_at timestamp
);

-- Create unique index on packaging variety name
CREATE UNIQUE INDEX packaging_varieties_name_unique_idx ON packaging_varieties(name);

-- Create vendor-packaging variety linking table
CREATE TABLE vendor_packaging_varieties (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  vendor_id uuid NOT NULL REFERENCES vendors(id) ON DELETE CASCADE,
  variety_id uuid NOT NULL REFERENCES packaging_varieties(id) ON DELETE CASCADE,
  notes text,
  created_at timestamp NOT NULL DEFAULT now(),
  updated_at timestamp NOT NULL DEFAULT now(),
  deleted_at timestamp
);

-- Create indexes for vendor-packaging varieties
CREATE UNIQUE INDEX vendor_packaging_varieties_vendor_variety_unique_idx ON vendor_packaging_varieties(vendor_id, variety_id);
CREATE INDEX vendor_packaging_varieties_vendor_idx ON vendor_packaging_varieties(vendor_id);
CREATE INDEX vendor_packaging_varieties_variety_idx ON vendor_packaging_varieties(variety_id);

-- Add variety references to purchase items tables
ALTER TABLE additive_purchase_items
ADD COLUMN additive_variety_id uuid REFERENCES additive_varieties(id);

ALTER TABLE juice_purchase_items
ADD COLUMN juice_variety_id uuid REFERENCES juice_varieties(id);

ALTER TABLE packaging_purchase_items
ADD COLUMN packaging_variety_id uuid REFERENCES packaging_varieties(id);

-- Make legacy fields nullable for backward compatibility
ALTER TABLE additive_purchase_items
ALTER COLUMN additive_type DROP NOT NULL,
ALTER COLUMN brand_manufacturer DROP NOT NULL,
ALTER COLUMN product_name DROP NOT NULL;

ALTER TABLE juice_purchase_items
ALTER COLUMN juice_type DROP NOT NULL;

ALTER TABLE packaging_purchase_items
ALTER COLUMN package_type DROP NOT NULL;

-- Insert some sample varieties
INSERT INTO additive_varieties (name, item_type) VALUES
('Pectic Enzyme', 'enzyme'),
('Potassium Sorbate', 'preservative'),
('Campden Tablets', 'preservative'),
('Yeast Nutrient', 'nutrient'),
('Acid Blend', 'acid'),
('Calcium Chloride', 'clarifier');

INSERT INTO juice_varieties (name, item_type) VALUES
('Apple Concentrate', 'concentrate'),
('Grape Juice', 'grape'),
('Pear Juice', 'pear'),
('Apple Juice Blend', 'blend');

INSERT INTO packaging_varieties (name, item_type) VALUES
('750ml Glass Bottles', 'bottles'),
('12oz Aluminum Cans', 'cans'),
('5 Gallon Kegs', 'kegs'),
('Bottle Labels', 'labels'),
('Crown Caps', 'caps'),
('Shrink Wrap', 'shrink_wrap'),
('Case Boxes', 'cases');