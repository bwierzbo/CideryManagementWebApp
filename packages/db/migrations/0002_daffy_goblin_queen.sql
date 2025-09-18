-- Add press_run_name column with default values for existing records
ALTER TABLE "apple_press_runs" ADD COLUMN "press_run_name" text;

-- Update existing records with a default naming pattern based on creation date
UPDATE "apple_press_runs"
SET "press_run_name" =
  TO_CHAR("created_at", 'YYYY/MM/DD') || '-' ||
  LPAD((ROW_NUMBER() OVER (PARTITION BY DATE("created_at") ORDER BY "created_at"))::text, 2, '0')
WHERE "press_run_name" IS NULL;

-- Make the column NOT NULL after setting default values
ALTER TABLE "apple_press_runs" ALTER COLUMN "press_run_name" SET NOT NULL;