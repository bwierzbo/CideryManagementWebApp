# Database Export - 2025-09-29

Generated: 2025-09-29T19:38:27.756Z

## Export Summary

- **users**: 3 records
- **vendors**: 31 records
- **juiceVarieties**: 2 records
- **juicePurchases**: 7 records
- **juicePurchaseItems**: 7 records
- **additivePurchases**: 3 records
- **additivePurchaseItems**: 2 records
- **vessels**: 18 records
- **applePressRuns**: 62 records
- **applePressRunLoads**: 58 records
- **pressItems**: 0 records
- **batches**: 14 records
- **batchCompositions**: 32 records
- **batchMeasurements**: 11 records
- **batchTransfers**: 6 records
- **packageSizes**: 0 records
- **packagingRuns**: 0 records
- **packagingRunPhotos**: 0 records
- **packages**: 0 records
- **inventoryItems**: 0 records
- **auditLog**: 214 records

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
npx tsx src/scripts/import-data.ts 2025-09-29

# Import specific tables
npx tsx src/scripts/import-data.ts 2025-09-29 --tables users,vendors,batches
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
