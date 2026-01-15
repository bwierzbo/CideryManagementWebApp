-- TTB Period Snapshots and Opening Balances
-- Enables accurate beginning/ending inventory tracking for TTB reporting

-- Add opening balance fields to organization_settings
ALTER TABLE "organization_settings"
ADD COLUMN IF NOT EXISTS "ttb_opening_balance_date" DATE;

ALTER TABLE "organization_settings"
ADD COLUMN IF NOT EXISTS "ttb_opening_balances" JSONB DEFAULT '{
  "bulk": {
    "hardCider": 0,
    "wineUnder16": 0,
    "wine16To21": 0,
    "wine21To24": 0,
    "sparklingWine": 0,
    "carbonatedWine": 0
  },
  "bottled": {
    "hardCider": 0,
    "wineUnder16": 0,
    "wine16To21": 0,
    "wine21To24": 0,
    "sparklingWine": 0,
    "carbonatedWine": 0
  },
  "spirits": {
    "appleBrandy": 0,
    "grapeSpirits": 0
  }
}'::jsonb;

-- Create period snapshots table
CREATE TABLE IF NOT EXISTS "ttb_period_snapshots" (
  "id" UUID PRIMARY KEY DEFAULT gen_random_uuid(),

  -- Period identification
  "period_type" TEXT NOT NULL CHECK ("period_type" IN ('monthly', 'quarterly', 'annual')),
  "period_start" DATE NOT NULL,
  "period_end" DATE NOT NULL,
  "year" INTEGER NOT NULL,
  "period_number" INTEGER, -- Month (1-12) or Quarter (1-4), NULL for annual

  -- Bulk wines by tax class (wine gallons)
  "bulk_hard_cider" DECIMAL(10,3) NOT NULL DEFAULT 0,
  "bulk_wine_under_16" DECIMAL(10,3) NOT NULL DEFAULT 0,
  "bulk_wine_16_to_21" DECIMAL(10,3) NOT NULL DEFAULT 0,
  "bulk_wine_21_to_24" DECIMAL(10,3) NOT NULL DEFAULT 0,
  "bulk_sparkling_wine" DECIMAL(10,3) NOT NULL DEFAULT 0,
  "bulk_carbonated_wine" DECIMAL(10,3) NOT NULL DEFAULT 0,

  -- Bottled wines by tax class (wine gallons)
  "bottled_hard_cider" DECIMAL(10,3) NOT NULL DEFAULT 0,
  "bottled_wine_under_16" DECIMAL(10,3) NOT NULL DEFAULT 0,
  "bottled_wine_16_to_21" DECIMAL(10,3) NOT NULL DEFAULT 0,
  "bottled_wine_21_to_24" DECIMAL(10,3) NOT NULL DEFAULT 0,
  "bottled_sparkling_wine" DECIMAL(10,3) NOT NULL DEFAULT 0,
  "bottled_carbonated_wine" DECIMAL(10,3) NOT NULL DEFAULT 0,

  -- Spirits on hand (proof gallons)
  "spirits_apple_brandy" DECIMAL(10,3) NOT NULL DEFAULT 0,
  "spirits_grape" DECIMAL(10,3) NOT NULL DEFAULT 0,
  "spirits_other" DECIMAL(10,3) NOT NULL DEFAULT 0,

  -- Production during period (wine gallons)
  "produced_hard_cider" DECIMAL(10,3) NOT NULL DEFAULT 0,
  "produced_wine_under_16" DECIMAL(10,3) NOT NULL DEFAULT 0,
  "produced_wine_16_to_21" DECIMAL(10,3) NOT NULL DEFAULT 0,

  -- Tax-paid removals by channel (wine gallons)
  "taxpaid_tasting_room" DECIMAL(10,3) NOT NULL DEFAULT 0,
  "taxpaid_wholesale" DECIMAL(10,3) NOT NULL DEFAULT 0,
  "taxpaid_online_dtc" DECIMAL(10,3) NOT NULL DEFAULT 0,
  "taxpaid_events" DECIMAL(10,3) NOT NULL DEFAULT 0,
  "taxpaid_other" DECIMAL(10,3) NOT NULL DEFAULT 0,

  -- Other removals (wine gallons)
  "removed_samples" DECIMAL(10,3) NOT NULL DEFAULT 0,
  "removed_breakage" DECIMAL(10,3) NOT NULL DEFAULT 0,
  "removed_process_loss" DECIMAL(10,3) NOT NULL DEFAULT 0,
  "removed_distilling" DECIMAL(10,3) NOT NULL DEFAULT 0,

  -- Materials received
  "materials_apples_lbs" DECIMAL(12,2) NOT NULL DEFAULT 0,
  "materials_other_fruit_lbs" DECIMAL(12,2) NOT NULL DEFAULT 0,
  "materials_juice_gallons" DECIMAL(10,3) NOT NULL DEFAULT 0,
  "materials_sugar_lbs" DECIMAL(10,2) NOT NULL DEFAULT 0,

  -- Tax calculation
  "tax_hard_cider" DECIMAL(10,2) NOT NULL DEFAULT 0,
  "tax_wine_under_16" DECIMAL(10,2) NOT NULL DEFAULT 0,
  "tax_wine_16_to_21" DECIMAL(10,2) NOT NULL DEFAULT 0,
  "tax_small_producer_credit" DECIMAL(10,2) NOT NULL DEFAULT 0,
  "tax_total" DECIMAL(10,2) NOT NULL DEFAULT 0,

  -- Status and workflow
  "status" TEXT NOT NULL DEFAULT 'draft' CHECK ("status" IN ('draft', 'review', 'finalized')),
  "finalized_at" TIMESTAMP,
  "finalized_by" UUID REFERENCES "users"("id"),

  -- Notes and audit
  "notes" TEXT,
  "adjustments" JSONB, -- Track any manual adjustments made
  "created_at" TIMESTAMP NOT NULL DEFAULT NOW(),
  "updated_at" TIMESTAMP NOT NULL DEFAULT NOW(),
  "created_by" UUID REFERENCES "users"("id"),

  -- Unique constraint - one snapshot per period
  UNIQUE("period_type", "year", "period_number")
);

-- Indexes for common queries
CREATE INDEX IF NOT EXISTS "ttb_period_snapshots_period_end_idx"
ON "ttb_period_snapshots"("period_end");

CREATE INDEX IF NOT EXISTS "ttb_period_snapshots_status_idx"
ON "ttb_period_snapshots"("status");

CREATE INDEX IF NOT EXISTS "ttb_period_snapshots_year_idx"
ON "ttb_period_snapshots"("year");

-- Comment for documentation
COMMENT ON TABLE "ttb_period_snapshots" IS
'Stores finalized TTB reporting period data. Ending inventory from one period becomes beginning inventory for the next. Used for TTB Form 5120.17 and Form 5000.24 generation.';
