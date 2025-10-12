-- Migration 0027: Remove juice_lots table and juice_lot_id from batches
-- Created: 2025-01-08
-- Reason: juice_lots table is unused (0 records), batches use origin_press_run_id directly

-- Drop the foreign key constraint first
ALTER TABLE batches DROP CONSTRAINT IF EXISTS batches_juice_lot_id_juice_lots_id_fk;

-- Drop the column from batches
ALTER TABLE batches DROP COLUMN IF EXISTS juice_lot_id;

-- Drop the juice_lots table
DROP TABLE IF EXISTS juice_lots CASCADE;
