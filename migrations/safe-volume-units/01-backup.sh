#!/bin/bash

# Safe Volume/Unit Migration - Step 1: Backup
# This script creates a complete backup before any migration

echo "🔒 SAFE VOLUME/UNIT MIGRATION - BACKUP STEP"
echo "==========================================="
echo ""

# Check if .env.local exists
if [ ! -f ".env.local" ]; then
    echo "❌ Error: .env.local file not found"
    echo "Please ensure you're in the project root directory"
    exit 1
fi

# Source environment variables
source .env.local

# Create backup directory if it doesn't exist
mkdir -p database-backups

# Generate timestamp for backup
TIMESTAMP=$(date +"%Y%m%d_%H%M%S")
BACKUP_FILE="database-backups/backup_before_volume_migration_${TIMESTAMP}.sql"

echo "📦 Creating backup..."
echo "   Backup file: ${BACKUP_FILE}"
echo ""

# Create the backup
pg_dump $DATABASE_URL > "${BACKUP_FILE}"

if [ $? -eq 0 ]; then
    # Get file size
    FILESIZE=$(ls -lh "${BACKUP_FILE}" | awk '{print $5}')

    echo "✅ Backup created successfully!"
    echo "   File: ${BACKUP_FILE}"
    echo "   Size: ${FILESIZE}"
    echo ""

    # Also create a data count verification file
    echo "📊 Creating data verification snapshot..."

    psql $DATABASE_URL << EOF > "database-backups/data_counts_${TIMESTAMP}.txt"
SELECT 'Data Verification Snapshot - Before Migration' as info;
SELECT '=============================================' as separator;
SELECT '';

SELECT 'BATCHES' as table_name, COUNT(*) as total_records,
       COUNT(initial_volume_l) as with_initial_volume,
       COUNT(current_volume_l) as with_current_volume
FROM batches;

SELECT 'VESSELS' as table_name, COUNT(*) as total_records,
       COUNT(capacity_l) as with_capacity
FROM vessels;

SELECT 'BATCH_TRANSFERS' as table_name, COUNT(*) as total_records,
       COUNT(volume_transferred_l) as with_volume
FROM batch_transfers;

SELECT 'PACKAGES' as table_name, COUNT(*) as total_records,
       COUNT(volume_packaged_l) as with_volume
FROM packages;

SELECT 'JUICE_LOTS' as table_name, COUNT(*) as total_records,
       COUNT(volume_l) as with_volume
FROM juice_lots;

SELECT 'APPLE_PRESS_RUNS' as table_name, COUNT(*) as total_records,
       COUNT(total_juice_volume_l) as with_volume
FROM apple_press_runs;

-- Sample data for verification
SELECT '';
SELECT 'Sample batch data (first 3 active batches):' as info;
SELECT id, name, initial_volume_l, current_volume_l
FROM batches
WHERE status = 'active'
LIMIT 3;
EOF

    echo "✅ Data verification snapshot created!"
    echo "   File: database-backups/data_counts_${TIMESTAMP}.txt"
    echo ""
    echo "🔒 Backup complete! Safe to proceed with migration."
    echo ""
    echo "To restore from this backup if needed:"
    echo "  psql \$DATABASE_URL < ${BACKUP_FILE}"

    # Save backup filename for next steps
    echo "${BACKUP_FILE}" > database-backups/last_backup.txt
    echo "${TIMESTAMP}" > database-backups/last_timestamp.txt

else
    echo "❌ Backup failed! Do not proceed with migration."
    exit 1
fi