# Database Export - 2025-10-14

Generated: 2025-10-14T16:32:36.316Z

## Export Summary

- **users**: 3 records
- **vendors**: 31 records
- **baseFruitVarieties**: 137 records
- **juiceVarieties**: 2 records
- **basefruitPurchases**: 69 records
- **basefruitPurchaseItems**: 108 records
- **juicePurchases**: 6 records
- **juicePurchaseItems**: 1 records
- **additivePurchases**: 1 records
- **additivePurchaseItems**: 1 records
- **vessels**: 26 records
- **applePressRuns**: 74 records
- **applePressRunLoads**: 83 records
- **batches**: 29 records
- **batchCompositions**: 69 records
- **batchMeasurements**: 12 records
- **batchTransfers**: 6 records
- **packageSizes**: 0 records
- **inventoryItems**: 2 records

## How to Use This Export

### 1. Manual Editing

Each `.ts` file contains the data for one table. You can:
- Edit field names to match new schema
- Add/remove fields
- Modify values
- Delete records you don't want to import

### 2. Importing Data

Use the import script to restore this data:

```bash
# Import all data
npx tsx src/scripts/import-data.ts 2025-10-14

# Import specific tables
npx tsx src/scripts/import-data.ts 2025-10-14 --tables users,vendors,batches
```

### 3. Schema Changes

If your schema changes:
1. Open the relevant `.ts` file
2. Update field names to match new schema
3. Add new required fields with default values
4. Remove deprecated fields
5. Run the import script

Example - if `volumeL` changed to `volume` + `volumeUnit`:

```typescript
// OLD
{
  id: "abc",
  volumeL: "100.5",
}

// NEW
{
  id: "abc",
  volume: "100.5",
  volumeUnit: "L",
}
```

## Table Dependencies

Tables are exported in dependency order:
1. Reference data (refValues, users, vendors, varieties)
2. Purchases (baseFruit, juice, additive)
3. Vessels
4. Press operations (applePressRuns, loads, items)
5. Batches (batches, compositions, measurements, transfers)
6. Packaging (packageSizes, runs, packages, inventory)
7. Audit logs

## Notes

- All timestamps are in ISO format
- UUIDs are preserved
- NULL values are represented as `null`
- Deleted records (deletedAt != null) are included
- You can filter out test data before importing
