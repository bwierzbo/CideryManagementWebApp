-- Migration 0025: Drop orphaned tables and create missing purchase tables
-- Created: 2025-01-08

-- ============================================================================
-- PART 1: Drop orphaned tables that are not in schema.ts
-- ============================================================================

DROP TABLE IF EXISTS "package_sizes" CASCADE;
DROP TABLE IF EXISTS "packaging_run_photos" CASCADE;
DROP TABLE IF EXISTS "packaging_runs" CASCADE;

-- ============================================================================
-- PART 2: Create additive purchase tables
-- ============================================================================

CREATE TABLE IF NOT EXISTS "additive_purchases" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  "vendor_id" uuid NOT NULL REFERENCES "vendors"("id"),
  "purchase_date" timestamp NOT NULL,
  "total_cost" numeric(10, 2) NOT NULL,
  "notes" text,
  "created_at" timestamp NOT NULL DEFAULT now(),
  "created_by" uuid REFERENCES "users"("id"),
  "updated_at" timestamp NOT NULL DEFAULT now(),
  "updated_by" uuid REFERENCES "users"("id"),
  "deleted_at" timestamp
);

CREATE TABLE IF NOT EXISTS "additive_purchase_items" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  "purchase_id" uuid NOT NULL REFERENCES "additive_purchases"("id"),
  "additive_variety_id" uuid REFERENCES "additive_varieties"("id"),
  "additive_type" text,
  "brand_manufacturer" text,
  "product_name" text,
  "quantity" numeric(10, 3) NOT NULL,
  "unit" text NOT NULL,
  "lot_batch_number" text,
  "expiration_date" date,
  "storage_requirements" text,
  "price_per_unit" numeric(8, 4),
  "total_cost" numeric(10, 2),
  "notes" text,
  "created_at" timestamp NOT NULL DEFAULT now(),
  "updated_at" timestamp NOT NULL DEFAULT now(),
  "deleted_at" timestamp
);

-- ============================================================================
-- PART 3: Create juice purchase tables
-- ============================================================================

CREATE TABLE IF NOT EXISTS "juice_purchases" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  "vendor_id" uuid NOT NULL REFERENCES "vendors"("id"),
  "purchase_date" timestamp NOT NULL,
  "total_cost" numeric(10, 2) NOT NULL,
  "notes" text,
  "created_at" timestamp NOT NULL DEFAULT now(),
  "created_by" uuid REFERENCES "users"("id"),
  "updated_at" timestamp NOT NULL DEFAULT now(),
  "updated_by" uuid REFERENCES "users"("id"),
  "deleted_at" timestamp
);

CREATE TABLE IF NOT EXISTS "juice_purchase_items" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  "purchase_id" uuid NOT NULL REFERENCES "juice_purchases"("id"),
  "juice_variety_id" uuid REFERENCES "juice_varieties"("id"),
  "juice_type" text,
  "variety_name" text,
  "volume" numeric(10, 3) NOT NULL,
  "volume_unit" text NOT NULL DEFAULT 'L',
  "brix" numeric(5, 2),
  "ph" numeric(3, 2),
  "specific_gravity" numeric(5, 4),
  "container_type" text,
  "price_per_liter" numeric(8, 4),
  "total_cost" numeric(10, 2),
  "notes" text,
  "created_at" timestamp NOT NULL DEFAULT now(),
  "updated_at" timestamp NOT NULL DEFAULT now(),
  "deleted_at" timestamp
);

-- ============================================================================
-- PART 4: Create packaging purchase tables
-- ============================================================================

CREATE TABLE IF NOT EXISTS "packaging_purchases" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  "vendor_id" uuid NOT NULL REFERENCES "vendors"("id"),
  "purchase_date" timestamp NOT NULL,
  "total_cost" numeric(10, 2) NOT NULL,
  "notes" text,
  "created_at" timestamp NOT NULL DEFAULT now(),
  "created_by" uuid REFERENCES "users"("id"),
  "updated_at" timestamp NOT NULL DEFAULT now(),
  "updated_by" uuid REFERENCES "users"("id"),
  "deleted_at" timestamp
);

CREATE TABLE IF NOT EXISTS "packaging_purchase_items" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  "purchase_id" uuid NOT NULL REFERENCES "packaging_purchases"("id"),
  "packaging_variety_id" uuid REFERENCES "packaging_varieties"("id"),
  "package_type" text,
  "material_type" text,
  "size" text NOT NULL,
  "quantity" integer NOT NULL,
  "price_per_unit" numeric(8, 4),
  "total_cost" numeric(10, 2),
  "notes" text,
  "created_at" timestamp NOT NULL DEFAULT now(),
  "updated_at" timestamp NOT NULL DEFAULT now(),
  "deleted_at" timestamp
);

-- ============================================================================
-- PART 5: Create indexes for better query performance
-- ============================================================================

-- Additive purchase indexes
CREATE INDEX IF NOT EXISTS "idx_additive_purchases_vendor_id" ON "additive_purchases"("vendor_id");
CREATE INDEX IF NOT EXISTS "idx_additive_purchases_purchase_date" ON "additive_purchases"("purchase_date");
CREATE INDEX IF NOT EXISTS "idx_additive_purchases_deleted_at" ON "additive_purchases"("deleted_at");
CREATE INDEX IF NOT EXISTS "idx_additive_purchase_items_purchase_id" ON "additive_purchase_items"("purchase_id");
CREATE INDEX IF NOT EXISTS "idx_additive_purchase_items_variety_id" ON "additive_purchase_items"("additive_variety_id");
CREATE INDEX IF NOT EXISTS "idx_additive_purchase_items_deleted_at" ON "additive_purchase_items"("deleted_at");

-- Juice purchase indexes
CREATE INDEX IF NOT EXISTS "idx_juice_purchases_vendor_id" ON "juice_purchases"("vendor_id");
CREATE INDEX IF NOT EXISTS "idx_juice_purchases_purchase_date" ON "juice_purchases"("purchase_date");
CREATE INDEX IF NOT EXISTS "idx_juice_purchases_deleted_at" ON "juice_purchases"("deleted_at");
CREATE INDEX IF NOT EXISTS "idx_juice_purchase_items_purchase_id" ON "juice_purchase_items"("purchase_id");
CREATE INDEX IF NOT EXISTS "idx_juice_purchase_items_variety_id" ON "juice_purchase_items"("juice_variety_id");
CREATE INDEX IF NOT EXISTS "idx_juice_purchase_items_deleted_at" ON "juice_purchase_items"("deleted_at");

-- Packaging purchase indexes
CREATE INDEX IF NOT EXISTS "idx_packaging_purchases_vendor_id" ON "packaging_purchases"("vendor_id");
CREATE INDEX IF NOT EXISTS "idx_packaging_purchases_purchase_date" ON "packaging_purchases"("purchase_date");
CREATE INDEX IF NOT EXISTS "idx_packaging_purchases_deleted_at" ON "packaging_purchases"("deleted_at");
CREATE INDEX IF NOT EXISTS "idx_packaging_purchase_items_purchase_id" ON "packaging_purchase_items"("purchase_id");
CREATE INDEX IF NOT EXISTS "idx_packaging_purchase_items_variety_id" ON "packaging_purchase_items"("packaging_variety_id");
CREATE INDEX IF NOT EXISTS "idx_packaging_purchase_items_deleted_at" ON "packaging_purchase_items"("deleted_at");
