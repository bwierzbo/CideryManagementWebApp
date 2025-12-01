-- TTB Reporting & Sales Channels Schema
-- Adds sales channel tracking for TTB Form 5120.17 compliance reporting

-- Create TTB-related enums
CREATE TYPE "sales_channel" AS ENUM (
  'tasting_room',
  'wholesale',
  'online_dtc',
  'events'
);

CREATE TYPE "ttb_period_type" AS ENUM (
  'monthly',
  'quarterly',
  'annual'
);

CREATE TYPE "ttb_report_status" AS ENUM (
  'draft',
  'submitted'
);

-- Create sales_channels reference table
CREATE TABLE "sales_channels" (
  "id" UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  "code" "sales_channel" NOT NULL UNIQUE,
  "name" TEXT NOT NULL,
  "ttb_category" TEXT NOT NULL DEFAULT 'tax_paid_removals',
  "is_active" BOOLEAN NOT NULL DEFAULT true,
  "sort_order" INTEGER DEFAULT 0,
  "created_at" TIMESTAMP NOT NULL DEFAULT now()
);

-- Create indexes for sales_channels
CREATE INDEX "sales_channels_sort_order_idx" ON "sales_channels" ("sort_order");
CREATE INDEX "sales_channels_active_idx" ON "sales_channels" ("is_active");

-- Create ttb_reporting_periods table for report snapshots
CREATE TABLE "ttb_reporting_periods" (
  "id" UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  "period_type" "ttb_period_type" NOT NULL,
  "period_start" DATE NOT NULL,
  "period_end" DATE NOT NULL,

  -- Part I - Beginning Inventory (wine gallons)
  "beginning_inventory_bulk_gallons" DECIMAL(12, 3),
  "beginning_inventory_bottled_gallons" DECIMAL(12, 3),
  "beginning_inventory_total_gallons" DECIMAL(12, 3),

  -- Part II - Wine Produced (wine gallons)
  "wine_produced_gallons" DECIMAL(12, 3),

  -- Part III - Tax-Paid Removals by Channel (wine gallons)
  "tax_paid_tasting_room_gallons" DECIMAL(12, 3),
  "tax_paid_wholesale_gallons" DECIMAL(12, 3),
  "tax_paid_online_dtc_gallons" DECIMAL(12, 3),
  "tax_paid_events_gallons" DECIMAL(12, 3),
  "tax_paid_removals_total_gallons" DECIMAL(12, 3),

  -- Part IV - Other Removals (wine gallons)
  "other_removals_samples_gallons" DECIMAL(12, 3),
  "other_removals_breakage_gallons" DECIMAL(12, 3),
  "other_removals_losses_gallons" DECIMAL(12, 3),
  "other_removals_total_gallons" DECIMAL(12, 3),

  -- Part V - Ending Inventory (wine gallons)
  "ending_inventory_bulk_gallons" DECIMAL(12, 3),
  "ending_inventory_bottled_gallons" DECIMAL(12, 3),
  "ending_inventory_total_gallons" DECIMAL(12, 3),

  -- Part VI - Tax Calculation
  "taxable_gallons" DECIMAL(12, 3),
  "tax_rate" DECIMAL(8, 4),
  "small_producer_credit_gallons" DECIMAL(12, 3),
  "small_producer_credit_amount" DECIMAL(10, 2),
  "tax_owed" DECIMAL(12, 2),

  -- Status and metadata
  "status" "ttb_report_status" NOT NULL DEFAULT 'draft',
  "generated_by" UUID REFERENCES "users" ("id"),
  "submitted_at" TIMESTAMP,
  "submitted_by" UUID REFERENCES "users" ("id"),
  "notes" TEXT,

  -- Audit
  "created_at" TIMESTAMP NOT NULL DEFAULT now(),
  "updated_at" TIMESTAMP NOT NULL DEFAULT now()
);

-- Create indexes for ttb_reporting_periods
CREATE INDEX "ttb_reporting_periods_period_type_idx" ON "ttb_reporting_periods" ("period_type");
CREATE INDEX "ttb_reporting_periods_period_start_idx" ON "ttb_reporting_periods" ("period_start");
CREATE INDEX "ttb_reporting_periods_status_idx" ON "ttb_reporting_periods" ("status");
CREATE UNIQUE INDEX "ttb_reporting_periods_unique_idx" ON "ttb_reporting_periods" ("period_type", "period_start", "period_end");

-- Add sales_channel_id to inventory_distributions
ALTER TABLE "inventory_distributions"
ADD COLUMN "sales_channel_id" UUID REFERENCES "sales_channels" ("id");

CREATE INDEX "inventory_distributions_sales_channel_idx" ON "inventory_distributions" ("sales_channel_id");

-- Add sales_channel_id to keg_fills
ALTER TABLE "keg_fills"
ADD COLUMN "sales_channel_id" UUID REFERENCES "sales_channels" ("id");

CREATE INDEX "keg_fills_sales_channel_idx" ON "keg_fills" ("sales_channel_id");

-- Add deleted_at column to keg_fills (was missing)
ALTER TABLE "keg_fills"
ADD COLUMN IF NOT EXISTS "deleted_at" TIMESTAMP;

-- Seed default sales channels
INSERT INTO "sales_channels" ("code", "name", "ttb_category", "sort_order") VALUES
  ('tasting_room', 'Tasting Room', 'tax_paid_removals', 1),
  ('wholesale', 'Wholesale / Distributors', 'tax_paid_removals', 2),
  ('online_dtc', 'Online / DTC Shipping', 'tax_paid_removals', 3),
  ('events', 'Events / Farmers Markets', 'tax_paid_removals', 4);
