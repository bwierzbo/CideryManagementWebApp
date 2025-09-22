-- Step 1: Rename existing purchases tables to basefruit_purchases
ALTER TABLE purchases RENAME TO basefruit_purchases;
ALTER TABLE purchase_items RENAME TO basefruit_purchase_items;

-- Step 2: Update foreign key constraint names
ALTER TABLE basefruit_purchase_items RENAME CONSTRAINT purchase_items_purchase_id_purchases_id_fk TO basefruit_purchase_items_purchase_id_basefruit_purchases_id_fk;
ALTER TABLE basefruit_purchase_items RENAME CONSTRAINT purchase_items_apple_variety_id_apple_varieties_id_fk TO basefruit_purchase_items_fruit_variety_id_base_fruit_varieties_id_fk;

-- Step 3: Update index names
ALTER INDEX purchase_items_purchase_id_index RENAME TO basefruit_purchase_items_purchase_id_index;
ALTER INDEX purchase_items_apple_variety_id_index RENAME TO basefruit_purchase_items_fruit_variety_id_index;

-- Step 4: Create additive_purchases table
CREATE TABLE additive_purchases (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    vendor_id uuid NOT NULL REFERENCES vendors(id),
    purchase_date timestamp NOT NULL,
    total_cost numeric(10,2) NOT NULL,
    invoice_number text,
    auto_generated_invoice boolean NOT NULL DEFAULT false,
    notes text,
    created_at timestamp NOT NULL DEFAULT now(),
    updated_at timestamp NOT NULL DEFAULT now(),
    deleted_at timestamp
);

-- Step 5: Create additive_purchase_items table
CREATE TABLE additive_purchase_items (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    purchase_id uuid NOT NULL REFERENCES additive_purchases(id),
    additive_type text NOT NULL,
    brand_manufacturer text NOT NULL,
    product_name text NOT NULL,
    quantity numeric(10,3) NOT NULL,
    unit text NOT NULL,
    lot_batch_number text,
    expiration_date date,
    storage_requirements text,
    price_per_unit numeric(8,4),
    total_cost numeric(10,2),
    notes text,
    created_at timestamp NOT NULL DEFAULT now(),
    updated_at timestamp NOT NULL DEFAULT now(),
    deleted_at timestamp
);

-- Step 6: Create juice_purchases table
CREATE TABLE juice_purchases (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    vendor_id uuid NOT NULL REFERENCES vendors(id),
    purchase_date timestamp NOT NULL,
    total_cost numeric(10,2) NOT NULL,
    invoice_number text,
    auto_generated_invoice boolean NOT NULL DEFAULT false,
    notes text,
    created_at timestamp NOT NULL DEFAULT now(),
    updated_at timestamp NOT NULL DEFAULT now(),
    deleted_at timestamp
);

-- Step 7: Create juice_purchase_items table
CREATE TABLE juice_purchase_items (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    purchase_id uuid NOT NULL REFERENCES juice_purchases(id),
    juice_type text NOT NULL,
    variety_name text,
    volume_l numeric(10,3) NOT NULL,
    brix numeric(5,2),
    container_type text,
    price_per_liter numeric(8,4),
    total_cost numeric(10,2),
    notes text,
    created_at timestamp NOT NULL DEFAULT now(),
    updated_at timestamp NOT NULL DEFAULT now(),
    deleted_at timestamp
);

-- Step 8: Create packaging_purchases table
CREATE TABLE packaging_purchases (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    vendor_id uuid NOT NULL REFERENCES vendors(id),
    purchase_date timestamp NOT NULL,
    total_cost numeric(10,2) NOT NULL,
    invoice_number text,
    auto_generated_invoice boolean NOT NULL DEFAULT false,
    notes text,
    created_at timestamp NOT NULL DEFAULT now(),
    updated_at timestamp NOT NULL DEFAULT now(),
    deleted_at timestamp
);

-- Step 9: Create packaging_purchase_items table
CREATE TABLE packaging_purchase_items (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    purchase_id uuid NOT NULL REFERENCES packaging_purchases(id),
    package_type text NOT NULL,
    material_type text,
    size text NOT NULL,
    quantity integer NOT NULL,
    price_per_unit numeric(8,4),
    total_cost numeric(10,2),
    notes text,
    created_at timestamp NOT NULL DEFAULT now(),
    updated_at timestamp NOT NULL DEFAULT now(),
    deleted_at timestamp
);

-- Step 10: Create indexes for new tables
CREATE INDEX additive_purchase_items_purchase_id_index ON additive_purchase_items(purchase_id);
CREATE INDEX juice_purchase_items_purchase_id_index ON juice_purchase_items(purchase_id);
CREATE INDEX packaging_purchase_items_purchase_id_index ON packaging_purchase_items(purchase_id);