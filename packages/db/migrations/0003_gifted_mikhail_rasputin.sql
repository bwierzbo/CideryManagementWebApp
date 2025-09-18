-- First ensure the column is nullable (if this is a fresh migration)
-- If coming from the previous migration file, this will drop the NOT NULL constraint
ALTER TABLE "apple_press_runs" ALTER COLUMN "press_run_name" DROP NOT NULL;

-- Update existing records with press run names based on creation date
UPDATE "apple_press_runs"
SET "press_run_name" =
  TO_CHAR("created_at", 'YYYY/MM/DD') || '-' ||
  LPAD((ROW_NUMBER() OVER (PARTITION BY DATE("created_at") ORDER BY "created_at"))::text, 2, '0')
WHERE "press_run_name" IS NULL;

-- Now make the column NOT NULL after all records have values
-- ALTER TABLE "apple_press_runs" ALTER COLUMN "press_run_name" SET NOT NULL;