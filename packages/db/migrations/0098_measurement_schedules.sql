-- Migration: Product-Type-Specific Measurement Schedules
-- Adds configurable measurement schedules per product type with custom product type support

-- Organization-level measurement schedule configuration per product type
-- Uses separate initialMeasurementTypes vs ongoingMeasurementTypes
ALTER TABLE "organization_settings"
ADD COLUMN IF NOT EXISTS "measurement_schedules" jsonb DEFAULT '{
  "cider": {
    "initialMeasurementTypes": ["sg", "ph", "temperature"],
    "ongoingMeasurementTypes": ["sg", "ph", "temperature"],
    "primaryMeasurement": "sg",
    "usesFermentationStages": true,
    "defaultIntervalDays": null,
    "alertType": "measurement_overdue"
  },
  "perry": {
    "initialMeasurementTypes": ["sg", "ph", "temperature"],
    "ongoingMeasurementTypes": ["sg", "ph", "temperature"],
    "primaryMeasurement": "sg",
    "usesFermentationStages": true,
    "defaultIntervalDays": null,
    "alertType": "measurement_overdue"
  },
  "brandy": {
    "initialMeasurementTypes": ["abv"],
    "ongoingMeasurementTypes": ["sensory", "volume"],
    "primaryMeasurement": "sensory",
    "usesFermentationStages": false,
    "defaultIntervalDays": 30,
    "alertType": "check_in_reminder"
  },
  "pommeau": {
    "initialMeasurementTypes": ["sg", "ph"],
    "ongoingMeasurementTypes": ["sensory", "volume"],
    "primaryMeasurement": "sensory",
    "usesFermentationStages": false,
    "defaultIntervalDays": 90,
    "alertType": "check_in_reminder"
  },
  "juice": {
    "initialMeasurementTypes": ["sg", "ph"],
    "ongoingMeasurementTypes": [],
    "primaryMeasurement": "sg",
    "usesFermentationStages": false,
    "defaultIntervalDays": null,
    "alertType": null
  }
}'::jsonb;

-- Custom product types table (user-defined)
CREATE TABLE IF NOT EXISTS "custom_product_types" (
  "id" UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  "organization_id" UUID NOT NULL REFERENCES "organizations"("id") ON DELETE CASCADE,
  "name" TEXT NOT NULL,
  "slug" TEXT NOT NULL,
  "description" TEXT,
  "initial_measurement_types" TEXT[] NOT NULL DEFAULT '{}',
  "ongoing_measurement_types" TEXT[] NOT NULL DEFAULT '{}',
  "primary_measurement" TEXT NOT NULL DEFAULT 'sg',
  "uses_fermentation_stages" BOOLEAN NOT NULL DEFAULT false,
  "default_interval_days" INTEGER,
  "alert_type" TEXT CHECK ("alert_type" IN ('check_in_reminder', 'measurement_overdue')),
  "sort_order" INTEGER DEFAULT 0,
  "is_active" BOOLEAN NOT NULL DEFAULT true,
  "created_at" TIMESTAMP NOT NULL DEFAULT NOW(),
  "updated_at" TIMESTAMP NOT NULL DEFAULT NOW(),
  UNIQUE ("organization_id", "slug")
);

CREATE INDEX IF NOT EXISTS "custom_product_types_org_idx" ON "custom_product_types" ("organization_id");

-- Batch-level schedule override
ALTER TABLE "batches" ADD COLUMN IF NOT EXISTS "measurement_schedule_override" jsonb;

-- Add sensory notes to batch measurements
ALTER TABLE "batch_measurements" ADD COLUMN IF NOT EXISTS "sensory_notes" text;

-- Index for faster schedule lookups
CREATE INDEX IF NOT EXISTS "batches_product_type_status_idx"
ON "batches" ("product_type", "status")
WHERE "deleted_at" IS NULL AND "is_archived" = false;
