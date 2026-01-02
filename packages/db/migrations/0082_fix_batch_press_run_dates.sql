-- Migration: Fix batch and press run names to use correct press dates
-- Issue: Batch names were generated using data entry date instead of actual pressing date
-- This migration updates batch names to use the correct date from their origin press run

-- First, update press run names where the name date doesn't match date_completed
-- Press run names follow format: YYYY-MM-DD-## where ## is sequence number

-- Step 1: Fix press run names
-- We need to update press_run_name to use date_completed instead of the incorrect date
-- This is complex because we need to maintain the sequence number

-- Create a temporary function to extract sequence from press run name
CREATE OR REPLACE FUNCTION extract_press_run_sequence(name TEXT) RETURNS TEXT AS $$
BEGIN
  -- Extract the sequence part (last 2 digits after the date)
  IF name ~ '^\d{4}-\d{2}-\d{2}-\d{2}$' THEN
    RETURN SUBSTRING(name FROM 12 FOR 2);
  ELSIF name ~ '^\d{4}/\d{2}/\d{2}-\d+$' THEN
    -- Handle old format with slashes
    RETURN REGEXP_REPLACE(name, '^.+-', '');
  ELSE
    RETURN '01';
  END IF;
END;
$$ LANGUAGE plpgsql;

-- Step 2: Update press run names to use correct date_completed
UPDATE press_runs
SET press_run_name = date_completed::TEXT || '-' || LPAD(extract_press_run_sequence(press_run_name), 2, '0')
WHERE
  deleted_at IS NULL
  AND date_completed IS NOT NULL
  AND press_run_name IS NOT NULL
  AND SUBSTRING(press_run_name FROM 1 FOR 10) != date_completed::TEXT;

-- Step 3: Fix batch names
-- Batch names follow formats:
--   Batch #YYYY-MM-DD_VESSEL_VARIETY_SEQ-suffixes
--   YYYY-MM-DD_VESSEL_VARIETY_SEQ-suffixes
-- We need to replace the YYYY-MM-DD portion with the correct press run date

-- Update batches that have "Batch #" prefix (format: Batch #YYYY-MM-DD_...)
-- The date starts at position 8 and is 10 characters long
UPDATE batches b
SET name = 'Batch #' || pr.date_completed::TEXT || SUBSTRING(b.name FROM 18)
FROM press_runs pr
WHERE
  b.origin_press_run_id = pr.id
  AND b.deleted_at IS NULL
  AND pr.date_completed IS NOT NULL
  AND b.name LIKE 'Batch #____-__-__%'
  AND SUBSTRING(b.name FROM 8 FOR 10) != pr.date_completed::TEXT;

-- Update batches without "Batch #" prefix (format: YYYY-MM-DD_...)
-- The date starts at position 1 and is 10 characters long
UPDATE batches b
SET name = pr.date_completed::TEXT || SUBSTRING(b.name FROM 11)
FROM press_runs pr
WHERE
  b.origin_press_run_id = pr.id
  AND b.deleted_at IS NULL
  AND pr.date_completed IS NOT NULL
  AND b.name NOT LIKE 'Batch #%'
  AND b.name ~ '^\d{4}-\d{2}-\d{2}_'
  AND SUBSTRING(b.name FROM 1 FOR 10) != pr.date_completed::TEXT;

-- Step 4: Update batch start_date to match press run date
UPDATE batches b
SET start_date = pr.date_completed::TIMESTAMP WITH TIME ZONE
FROM press_runs pr
WHERE
  b.origin_press_run_id = pr.id
  AND b.deleted_at IS NULL
  AND pr.date_completed IS NOT NULL
  AND b.start_date::DATE != pr.date_completed;

-- Clean up the temporary function
DROP FUNCTION IF EXISTS extract_press_run_sequence(TEXT);
