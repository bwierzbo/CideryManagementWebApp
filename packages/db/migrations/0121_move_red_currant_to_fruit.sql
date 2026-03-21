-- Migration: Move Red Currant from additive tables to base fruit tables
-- Red Currant was entered as an additive but should be classified as a fruit.
-- Original purchase: 40 lb at $3.50/lb from Talequah Farm (2025-03-03)
-- Used: 26.455 lb, Remaining: 13.545 lb

-- Step 1: Add 'berry' to the fruit_type enum
ALTER TYPE "fruit_type" ADD VALUE 'berry';

-- Step 2: Create Red Currant variety in base_fruit_varieties
INSERT INTO "base_fruit_varieties" ("id", "name", "fruit_type", "is_active", "created_at", "updated_at")
VALUES (
  gen_random_uuid(),
  'Red Currant',
  'berry',
  true,
  NOW(),
  NOW()
);

-- Step 3: Create basefruit_purchases record (same vendor and date as the additive purchase)
INSERT INTO "basefruit_purchases" ("id", "vendor_id", "purchase_date", "total_cost", "notes", "created_at", "updated_at")
VALUES (
  gen_random_uuid(),
  '2ad9a018-6464-4b53-afc5-f2f238f1743c',  -- Talequah Farm
  '2025-03-03',
  47.41,  -- Remaining value: 13.545 lb * $3.50/lb
  'Migrated from additive purchase. Original: 40 lb at $3.50/lb ($140.00 total), 26.455 lb used.',
  NOW(),
  NOW()
);

-- Step 4: Create basefruit_purchase_items record with remaining quantity
INSERT INTO "basefruit_purchase_items" ("id", "purchase_id", "fruit_variety_id", "quantity", "unit", "price_per_unit", "total_cost", "is_depleted", "created_at", "updated_at")
SELECT
  gen_random_uuid(),
  bp.id,
  bfv.id,
  13.545,  -- Remaining quantity (40 - 26.455)
  'lb',
  3.5000,
  47.41,   -- 13.545 * 3.50
  false,
  NOW(),
  NOW()
FROM "basefruit_purchases" bp
CROSS JOIN "base_fruit_varieties" bfv
WHERE bp.vendor_id = '2ad9a018-6464-4b53-afc5-f2f238f1743c'
  AND bp.notes LIKE 'Migrated from additive purchase%'
  AND bfv.name = 'Red Currant'
  AND bfv.fruit_type = 'berry';

-- Step 5: Soft-delete the additive purchase item
UPDATE "additive_purchase_items"
SET "deleted_at" = NOW()
WHERE "id" = '7a302f97-797b-41cb-ba14-6b1c874ad46e';

-- Step 6: Soft-delete the additive variety (Red Currant) if no other active purchase items reference it
UPDATE "additive_varieties"
SET "deleted_at" = NOW()
WHERE "id" = '50545dda-625c-47e3-beb7-fd8f47470a87'
  AND NOT EXISTS (
    SELECT 1 FROM "additive_purchase_items"
    WHERE "additive_variety_id" = '50545dda-625c-47e3-beb7-fd8f47470a87'
      AND "deleted_at" IS NULL
      AND "id" != '7a302f97-797b-41cb-ba14-6b1c874ad46e'
  );
