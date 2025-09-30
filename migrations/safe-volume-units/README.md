# Safe Volume/Unit Migration Guide

## Overview

This migration adds unit tracking to all volume fields in the database **without removing or modifying existing data**. It follows a safe, non-destructive approach that preserves all existing data.

## Migration Strategy

1. **Backup First** - Creates complete database backup
2. **Add New Columns** - Adds unit columns and duplicate volume columns
3. **Copy Data** - Copies existing data to new columns
4. **Verify** - Checks data integrity
5. **Keep Both** - Old and new columns coexist

## Files

- `01-backup.sh` - Creates backup before migration
- `02-add-unit-columns.sql` - Adds new columns (non-destructive)
- `03-verify.sh` - Verifies data integrity
- `04-rollback.sh` - Removes new columns if needed
- `05-remove-old-columns.sql` - (Future) Removes old columns after app is updated

## How to Run

### Step 1: Backup
```bash
chmod +x migrations/safe-volume-units/01-backup.sh
./migrations/safe-volume-units/01-backup.sh
```

This creates:
- Full database backup in `database-backups/`
- Data count snapshot for verification

### Step 2: Run Migration
```bash
source .env.local
psql $DATABASE_URL < migrations/safe-volume-units/02-add-unit-columns.sql
```

This migration:
- ✅ Adds `*_unit` columns (e.g., `initial_volume_unit`)
- ✅ Adds new volume columns without `_l` suffix
- ✅ Copies all data from old to new columns
- ✅ Keeps original `_l` columns intact

### Step 3: Verify
```bash
chmod +x migrations/safe-volume-units/03-verify.sh
./migrations/safe-volume-units/03-verify.sh
```

This checks:
- Original columns still exist with data
- New columns were created
- Data matches between old and new columns
- No records were lost

### Step 4: Update Application

Update your application to use the new columns:

```typescript
// Old way (still works)
const volume = batch.initial_volume_l;

// New way (with units)
const volume = batch.initial_volume;
const unit = batch.initial_volume_unit; // 'L' or 'gal'

// Or use helper functions
import { getVolumeWithUnit } from 'db/schema-dual-support';
const { value, unit } = getVolumeWithUnit(batch, 'initial');
```

### Step 5: (Optional) Rollback if Needed
```bash
chmod +x migrations/safe-volume-units/04-rollback.sh
./migrations/safe-volume-units/04-rollback.sh
```

This will:
- Remove newly added columns
- Keep original `_l` columns intact
- Restore to pre-migration state

## Database Changes

### Before Migration
```
batches
├── initial_volume_l (numeric)
└── current_volume_l (numeric)

vessels
└── capacity_l (numeric)
```

### After Migration
```
batches
├── initial_volume_l (numeric) ← KEPT
├── current_volume_l (numeric) ← KEPT
├── initial_volume (numeric)    ← NEW (copy of _l)
├── current_volume (numeric)    ← NEW (copy of _l)
├── initial_volume_unit (unit)  ← NEW (default 'L')
└── current_volume_unit (unit)  ← NEW (default 'L')

vessels
├── capacity_l (numeric)        ← KEPT
├── capacity (numeric)          ← NEW (copy of _l)
└── capacity_unit (unit)        ← NEW (default 'L')
```

## Supported Units

The `unit` enum supports:
- `L` - Liters (default)
- `gal` - Gallons
- `kg` - Kilograms (for weight)
- `lb` - Pounds
- `bushel` - Bushels

## Application Updates

### API Layer

```typescript
// Update API to handle both formats
async function getBatch(id: string) {
  const batch = await db.query.batches.findFirst({
    where: eq(batches.id, id)
  });

  // Return both for compatibility
  return {
    ...batch,
    // Old format (deprecated)
    initialVolumeL: batch.initial_volume_l,
    currentVolumeL: batch.current_volume_l,
    // New format
    initialVolume: batch.initial_volume,
    initialVolumeUnit: batch.initial_volume_unit,
    currentVolume: batch.current_volume,
    currentVolumeUnit: batch.current_volume_unit
  };
}
```

### Frontend

```typescript
// Display with units
function VolumeDisplay({ volume, unit }) {
  const displayValue = unit === 'gal'
    ? `${volume} gallons`
    : `${volume}L`;

  return <span>{displayValue}</span>;
}

// Unit selector
function VolumeInput({ value, unit, onChange }) {
  return (
    <>
      <Input
        type="number"
        value={value}
        onChange={(e) => onChange({ value: e.target.value, unit })}
      />
      <Select
        value={unit}
        onChange={(e) => onChange({ value, unit: e.target.value })}
      >
        <option value="L">Liters</option>
        <option value="gal">Gallons</option>
      </Select>
    </>
  );
}
```

## Safety Features

1. **Transaction-based** - Entire migration runs in a transaction
2. **Verification checks** - Automatic data integrity verification
3. **Non-destructive** - Original columns remain untouched
4. **Rollback ready** - Easy rollback if issues arise
5. **Gradual migration** - App can be updated gradually

## Timeline

1. **Week 1**: Run migration, verify data
2. **Week 2**: Update application to read from new columns
3. **Week 3**: Update application to write to both columns
4. **Week 4**: Monitor for issues
5. **Future**: Remove old `_l` columns when safe

## Troubleshooting

### If migration fails

1. Check error message
2. Run verification: `./03-verify.sh`
3. If data is corrupted, rollback: `./04-rollback.sh`
4. Restore from backup if needed:
   ```bash
   psql $DATABASE_URL < database-backups/backup_[timestamp].sql
   ```

### If app breaks after migration

The app should continue working because:
- Old columns still exist
- Data is duplicated in both columns
- Schema can handle both formats

### Common Issues

**Issue**: "column already exists"
- **Solution**: Migration is idempotent, safe to re-run

**Issue**: Data mismatch in verification
- **Solution**: Check transaction logs, may need rollback

**Issue**: App can't find new columns
- **Solution**: Check Drizzle schema generation

## Support

Keep the backup for at least 30 days after migration. The migration is designed to be safe, but having a backup ensures complete recovery if needed.