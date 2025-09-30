#!/bin/bash

# Safe Volume/Unit Migration - Step 4: Rollback (if needed)
# This script removes the new columns if something went wrong

echo "⚠️  SAFE VOLUME/UNIT MIGRATION - ROLLBACK"
echo "========================================="
echo ""
echo "This will remove the newly added columns and keep original data intact."
echo ""

# Confirmation prompt
read -p "Are you sure you want to rollback? (yes/no): " confirm

if [ "$confirm" != "yes" ]; then
    echo "Rollback cancelled."
    exit 0
fi

# Source environment variables
source .env.local

echo ""
echo "🔄 Rolling back migration..."
echo ""

psql $DATABASE_URL << 'EOF'
BEGIN; -- Start transaction

-- ============================================
-- REMOVE NEWLY ADDED COLUMNS
-- ============================================

-- Remove unit columns
ALTER TABLE batches
  DROP COLUMN IF EXISTS initial_volume_unit,
  DROP COLUMN IF EXISTS current_volume_unit,
  DROP COLUMN IF EXISTS initial_volume,
  DROP COLUMN IF EXISTS current_volume;

ALTER TABLE vessels
  DROP COLUMN IF EXISTS capacity_unit,
  DROP COLUMN IF EXISTS capacity;

ALTER TABLE juice_purchase_items
  DROP COLUMN IF EXISTS volume_unit,
  DROP COLUMN IF EXISTS volume;

ALTER TABLE juice_lots
  DROP COLUMN IF EXISTS volume_unit,
  DROP COLUMN IF EXISTS volume;

ALTER TABLE batch_compositions
  DROP COLUMN IF EXISTS juice_volume_unit,
  DROP COLUMN IF EXISTS juice_volume;

ALTER TABLE batch_measurements
  DROP COLUMN IF EXISTS volume_unit,
  DROP COLUMN IF EXISTS volume;

ALTER TABLE packages
  DROP COLUMN IF EXISTS volume_packaged_unit,
  DROP COLUMN IF EXISTS volume_packaged;

ALTER TABLE apple_press_runs
  DROP COLUMN IF EXISTS total_juice_volume_unit,
  DROP COLUMN IF EXISTS total_juice_volume;

ALTER TABLE apple_press_run_loads
  DROP COLUMN IF EXISTS juice_volume_unit,
  DROP COLUMN IF EXISTS juice_volume;

ALTER TABLE press_items
  DROP COLUMN IF EXISTS juice_produced_unit,
  DROP COLUMN IF EXISTS juice_produced;

ALTER TABLE batch_transfers
  DROP COLUMN IF EXISTS volume_transferred_unit,
  DROP COLUMN IF EXISTS loss_unit,
  DROP COLUMN IF EXISTS total_volume_processed_unit,
  DROP COLUMN IF EXISTS remaining_volume_unit,
  DROP COLUMN IF EXISTS volume_transferred,
  DROP COLUMN IF EXISTS loss,
  DROP COLUMN IF EXISTS total_volume_processed,
  DROP COLUMN IF EXISTS remaining_volume;

ALTER TABLE batch_merge_history
  DROP COLUMN IF EXISTS volume_added_unit,
  DROP COLUMN IF EXISTS target_volume_before_unit,
  DROP COLUMN IF EXISTS target_volume_after_unit,
  DROP COLUMN IF EXISTS volume_added,
  DROP COLUMN IF EXISTS target_volume_before,
  DROP COLUMN IF EXISTS target_volume_after;

ALTER TABLE packaging_runs
  DROP COLUMN IF EXISTS volume_taken_unit,
  DROP COLUMN IF EXISTS loss_unit,
  DROP COLUMN IF EXISTS unit_size_unit,
  DROP COLUMN IF EXISTS volume_taken,
  DROP COLUMN IF EXISTS loss,
  DROP COLUMN IF EXISTS unit_size;

-- Drop indexes
DROP INDEX IF EXISTS idx_vessels_capacity_unit;
DROP INDEX IF EXISTS idx_batches_volume_units;
DROP INDEX IF EXISTS idx_batch_transfers_volume_units;

-- Verify original columns still exist
DO $$
DECLARE
  original_columns INTEGER;
BEGIN
  SELECT COUNT(*) INTO original_columns
  FROM information_schema.columns
  WHERE table_name = 'batches'
    AND column_name IN ('initial_volume_l', 'current_volume_l');

  IF original_columns != 2 THEN
    RAISE EXCEPTION 'Original columns missing! Rollback failed.';
  END IF;

  RAISE NOTICE 'Rollback verification passed: Original columns intact';
END $$;

COMMIT; -- Commit the rollback

-- Show status
SELECT 'Rollback Complete' as status;
SELECT 'Original _l columns remain intact' as info;

SELECT
  table_name,
  column_name,
  data_type
FROM information_schema.columns
WHERE table_name IN ('batches', 'vessels')
  AND column_name LIKE '%volume%' OR column_name LIKE '%capacity%'
ORDER BY table_name, column_name;

EOF

if [ $? -eq 0 ]; then
    echo ""
    echo "✅ Rollback completed successfully!"
    echo "Original database structure restored."
    echo ""
    echo "You can re-run the migration later with:"
    echo "  psql \$DATABASE_URL < migrations/safe-volume-units/02-add-unit-columns.sql"
else
    echo ""
    echo "❌ Rollback failed!"
    echo "You may need to restore from backup."

    if [ -f "database-backups/last_backup.txt" ]; then
        BACKUP_FILE=$(cat database-backups/last_backup.txt)
        echo ""
        echo "To restore from backup:"
        echo "  psql \$DATABASE_URL < ${BACKUP_FILE}"
    fi
fi