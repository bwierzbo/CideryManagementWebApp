-- Create keg tracking enums
CREATE TYPE "keg_type" AS ENUM (
  'cornelius_5L',
  'cornelius_9L',
  'sanke_20L',
  'sanke_30L',
  'sanke_50L',
  'other'
);

CREATE TYPE "keg_status" AS ENUM (
  'available',
  'filled',
  'distributed',
  'cleaning',
  'maintenance',
  'retired'
);

CREATE TYPE "keg_condition" AS ENUM (
  'excellent',
  'good',
  'fair',
  'needs_repair',
  'retired'
);

CREATE TYPE "keg_fill_status" AS ENUM (
  'filled',
  'distributed',
  'returned',
  'voided'
);

-- Create kegs table (asset registry)
CREATE TABLE "kegs" (
  "id" UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  "keg_number" TEXT NOT NULL UNIQUE,
  "keg_type" "keg_type" NOT NULL,
  "capacity_ml" INTEGER NOT NULL,
  "capacity_unit" "unit" NOT NULL DEFAULT 'L',
  "purchase_date" DATE,
  "purchase_cost" DECIMAL(10, 2),
  "status" "keg_status" NOT NULL DEFAULT 'available',
  "condition" "keg_condition" NOT NULL DEFAULT 'excellent',
  "current_location" TEXT DEFAULT 'cellar',
  "notes" TEXT,
  "created_at" TIMESTAMP NOT NULL DEFAULT now(),
  "updated_at" TIMESTAMP NOT NULL DEFAULT now(),
  "deleted_at" TIMESTAMP
);

-- Create indexes for kegs table
CREATE INDEX "kegs_keg_number_idx" ON "kegs" ("keg_number");
CREATE INDEX "kegs_status_idx" ON "kegs" ("status");
CREATE INDEX "kegs_keg_type_idx" ON "kegs" ("keg_type");
CREATE INDEX "kegs_current_location_idx" ON "kegs" ("current_location");

-- Create keg_fills table (fill operations)
CREATE TABLE "keg_fills" (
  "id" UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  "keg_id" UUID NOT NULL REFERENCES "kegs" ("id") ON DELETE CASCADE,
  "batch_id" UUID NOT NULL REFERENCES "batches" ("id"),
  "vessel_id" UUID NOT NULL REFERENCES "vessels" ("id"),
  "filled_at" TIMESTAMP NOT NULL,
  "volume_taken" DECIMAL(10, 2) NOT NULL,
  "volume_taken_unit" "unit" NOT NULL DEFAULT 'L',
  "loss" DECIMAL(10, 2),
  "loss_unit" "unit" NOT NULL DEFAULT 'L',

  -- QA Fields
  "abv_at_packaging" DECIMAL(5, 2),
  "carbonation_level" "carbonation_level",
  "carbonation_method" "carbonation_method" DEFAULT 'none',
  "source_carbonation_operation_id" UUID,

  -- Distribution tracking
  "status" "keg_fill_status" NOT NULL DEFAULT 'filled',
  "distributed_at" TIMESTAMP,
  "distribution_location" TEXT,
  "returned_at" TIMESTAMP,

  -- Metadata
  "production_notes" TEXT,
  "void_reason" TEXT,
  "voided_at" TIMESTAMP,
  "voided_by" UUID,

  -- Audit fields
  "created_by" UUID NOT NULL REFERENCES "users" ("id"),
  "created_at" TIMESTAMP NOT NULL DEFAULT now(),
  "updated_by" UUID REFERENCES "users" ("id"),
  "updated_at" TIMESTAMP NOT NULL DEFAULT now()
);

-- Create indexes for keg_fills table
CREATE INDEX "keg_fills_keg_idx" ON "keg_fills" ("keg_id");
CREATE INDEX "keg_fills_batch_idx" ON "keg_fills" ("batch_id");
CREATE INDEX "keg_fills_vessel_idx" ON "keg_fills" ("vessel_id");
CREATE INDEX "keg_fills_filled_at_idx" ON "keg_fills" ("filled_at");
CREATE INDEX "keg_fills_status_idx" ON "keg_fills" ("status");
CREATE INDEX "keg_fills_keg_status_idx" ON "keg_fills" ("keg_id", "status");

-- Create keg_fill_materials table (materials used in fills)
CREATE TABLE "keg_fill_materials" (
  "id" UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  "keg_fill_id" UUID NOT NULL REFERENCES "keg_fills" ("id") ON DELETE CASCADE,
  "packaging_purchase_item_id" UUID NOT NULL,
  "quantity_used" INTEGER NOT NULL,
  "material_type" TEXT NOT NULL,
  "created_at" TIMESTAMP NOT NULL DEFAULT now(),
  "created_by" UUID NOT NULL REFERENCES "users" ("id")
);

-- Create indexes for keg_fill_materials table
CREATE INDEX "keg_fill_materials_keg_fill_idx" ON "keg_fill_materials" ("keg_fill_id");
CREATE INDEX "keg_fill_materials_packaging_item_idx" ON "keg_fill_materials" ("packaging_purchase_item_id");
