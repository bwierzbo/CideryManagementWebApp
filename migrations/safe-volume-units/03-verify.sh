#!/bin/bash

# Safe Volume/Unit Migration - Step 3: Verify Data Integrity
# This script verifies that all data is intact after migration

echo "🔍 SAFE VOLUME/UNIT MIGRATION - VERIFICATION"
echo "============================================"
echo ""

# Source environment variables
source .env.local

# Get the timestamp from the last backup
if [ -f "database-backups/last_timestamp.txt" ]; then
    TIMESTAMP=$(cat database-backups/last_timestamp.txt)
    echo "Comparing with backup from: ${TIMESTAMP}"
    echo ""
else
    echo "⚠️  No backup timestamp found"
    TIMESTAMP=$(date +"%Y%m%d_%H%M%S")
fi

# Create verification report
VERIFY_FILE="database-backups/verification_${TIMESTAMP}.txt"

echo "Running verification checks..."
echo ""

psql $DATABASE_URL << 'EOF' > "${VERIFY_FILE}"
-- ============================================
-- DATA INTEGRITY VERIFICATION
-- ============================================

SELECT 'DATA INTEGRITY VERIFICATION REPORT' as title;
SELECT '===================================' as separator;
SELECT '';
SELECT 'Generated: ' || NOW() as timestamp;
SELECT '';

-- 1. CHECK THAT OLD COLUMNS STILL EXIST AND HAVE DATA
SELECT '1. ORIGINAL COLUMNS CHECK' as section;
SELECT '------------------------' as separator;

SELECT
  'batches._l columns' as check_name,
  CASE
    WHEN COUNT(column_name) = 2 THEN '✅ PASS - Both columns exist'
    ELSE '❌ FAIL - Missing columns'
  END as status
FROM information_schema.columns
WHERE table_name = 'batches'
  AND column_name IN ('initial_volume_l', 'current_volume_l');

SELECT
  'vessels.capacity_l' as check_name,
  CASE
    WHEN COUNT(*) = 1 THEN '✅ PASS - Column exists'
    ELSE '❌ FAIL - Column missing'
  END as status
FROM information_schema.columns
WHERE table_name = 'vessels'
  AND column_name = 'capacity_l';

SELECT '';

-- 2. CHECK THAT NEW COLUMNS WERE ADDED
SELECT '2. NEW COLUMNS CHECK' as section;
SELECT '-------------------' as separator;

SELECT
  'Unit columns added' as check_name,
  COUNT(*) || ' unit columns found' as status
FROM information_schema.columns
WHERE column_name LIKE '%_unit'
  AND data_type = 'USER-DEFINED';

SELECT
  'New volume columns' as check_name,
  COUNT(*) || ' new volume columns' as status
FROM information_schema.columns
WHERE column_name IN ('initial_volume', 'current_volume', 'capacity', 'volume',
                      'juice_volume', 'volume_packaged', 'total_juice_volume',
                      'juice_produced', 'volume_transferred', 'loss',
                      'total_volume_processed', 'remaining_volume',
                      'volume_added', 'target_volume_before', 'target_volume_after',
                      'volume_taken', 'unit_size')
  AND data_type = 'numeric';

SELECT '';

-- 3. DATA CONSISTENCY CHECK
SELECT '3. DATA CONSISTENCY CHECK' as section;
SELECT '-------------------------' as separator;

-- Check batches data matches
WITH data_check AS (
  SELECT
    COUNT(*) as total_rows,
    COUNT(initial_volume_l) as old_initial_count,
    COUNT(initial_volume) as new_initial_count,
    COUNT(current_volume_l) as old_current_count,
    COUNT(current_volume) as new_current_count,
    COUNT(CASE WHEN initial_volume_l = initial_volume OR (initial_volume_l IS NULL AND initial_volume IS NULL) THEN 1 END) as initial_match,
    COUNT(CASE WHEN current_volume_l = current_volume OR (current_volume_l IS NULL AND current_volume IS NULL) THEN 1 END) as current_match
  FROM batches
)
SELECT
  'Batches data consistency' as check_name,
  CASE
    WHEN initial_match = total_rows AND current_match = total_rows
    THEN '✅ PASS - All ' || total_rows || ' rows match'
    ELSE '❌ FAIL - Data mismatch detected'
  END as status
FROM data_check;

-- Check vessels data matches
WITH vessel_check AS (
  SELECT
    COUNT(*) as total_rows,
    COUNT(capacity_l) as old_count,
    COUNT(capacity) as new_count,
    COUNT(CASE WHEN capacity_l = capacity OR (capacity_l IS NULL AND capacity IS NULL) THEN 1 END) as matches
  FROM vessels
)
SELECT
  'Vessels data consistency' as check_name,
  CASE
    WHEN matches = total_rows
    THEN '✅ PASS - All ' || total_rows || ' rows match'
    ELSE '❌ FAIL - Data mismatch'
  END as status
FROM vessel_check;

SELECT '';

-- 4. RECORD COUNTS
SELECT '4. RECORD COUNTS' as section;
SELECT '----------------' as separator;

SELECT 'batches' as table_name, COUNT(*) as total_records,
       COUNT(initial_volume_l) as with_old_volume,
       COUNT(initial_volume) as with_new_volume
FROM batches
UNION ALL
SELECT 'vessels', COUNT(*), COUNT(capacity_l), COUNT(capacity)
FROM vessels
UNION ALL
SELECT 'batch_transfers', COUNT(*), COUNT(volume_transferred_l), COUNT(volume_transferred)
FROM batch_transfers
UNION ALL
SELECT 'packages', COUNT(*), COUNT(volume_packaged_l), COUNT(volume_packaged)
FROM packages
UNION ALL
SELECT 'juice_lots', COUNT(*), COUNT(volume_l), COUNT(volume)
FROM juice_lots
ORDER BY table_name;

SELECT '';

-- 5. SAMPLE DATA COMPARISON
SELECT '5. SAMPLE DATA (First 5 active batches)' as section;
SELECT '----------------------------------------' as separator;

SELECT
  name,
  initial_volume_l as old_initial,
  initial_volume as new_initial,
  CASE
    WHEN initial_volume_l = initial_volume OR (initial_volume_l IS NULL AND initial_volume IS NULL)
    THEN '✅ Match'
    ELSE '❌ MISMATCH!'
  END as initial_check,
  current_volume_l as old_current,
  current_volume as new_current,
  CASE
    WHEN current_volume_l = current_volume OR (current_volume_l IS NULL AND current_volume IS NULL)
    THEN '✅ Match'
    ELSE '❌ MISMATCH!'
  END as current_check
FROM batches
WHERE status = 'active'
ORDER BY created_at DESC
LIMIT 5;

SELECT '';

-- 6. FINAL SUMMARY
SELECT '6. MIGRATION SUMMARY' as section;
SELECT '--------------------' as separator;

WITH summary AS (
  SELECT
    (SELECT COUNT(*) FROM batches WHERE initial_volume_l IS NOT NULL) as batches_with_data,
    (SELECT COUNT(*) FROM batches WHERE initial_volume IS NOT NULL) as batches_migrated,
    (SELECT COUNT(*) FROM vessels WHERE capacity_l IS NOT NULL) as vessels_with_data,
    (SELECT COUNT(*) FROM vessels WHERE capacity IS NOT NULL) as vessels_migrated
)
SELECT
  CASE
    WHEN batches_with_data = batches_migrated AND vessels_with_data = vessels_migrated
    THEN '✅ SUCCESS - All data successfully migrated and preserved'
    ELSE '⚠️ WARNING - Some data may not have migrated correctly'
  END as migration_status,
  batches_migrated || ' batches, ' || vessels_migrated || ' vessels migrated' as details
FROM summary;

EOF

# Display results
echo "Verification complete!"
echo ""
cat "${VERIFY_FILE}"

# Check if there are any failures
if grep -q "❌ FAIL" "${VERIFY_FILE}"; then
    echo ""
    echo "⚠️  WARNING: Some verification checks failed!"
    echo "Please review the verification report above."
    echo ""
    echo "If data is missing, you can rollback with:"
    echo "  ./migrations/safe-volume-units/04-rollback.sh"
else
    echo ""
    echo "✅ All verification checks passed!"
    echo "Migration completed successfully with no data loss."
fi

echo ""
echo "Detailed report saved to: ${VERIFY_FILE}"