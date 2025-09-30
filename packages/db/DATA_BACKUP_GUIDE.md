# Database Backup & Restore System

A flexible system for exporting and importing database data that allows manual schema adjustments.

## 🎯 Purpose

This system lets you:
- **Backup** your database to human-readable TypeScript files
- **Edit** those files when your schema changes (rename columns, add fields, etc.)
- **Restore** the data back to your database
- **Version control** your data exports
- **Maintain control** over your database without losing important data

## 🚀 Quick Start

### Export Current Database

```bash
# Export all data to timestamped folder
pnpm db:export

# Or run directly
npx tsx src/scripts/export-data.ts
```

This creates a new folder in `data-exports/` with today's date (e.g., `2025-09-29/`).

### Import Data Back

```bash
# Import all data from an export folder
pnpm db:import 2025-09-29

# Or run directly
npx tsx src/scripts/import-data.ts 2025-09-29
```

## 📁 Export Structure

After running an export, you'll have:

```
data-exports/
└── 2025-09-29/
    ├── README.md              # Instructions and summary
    ├── index.ts               # Export metadata
    ├── users.ts               # User data
    ├── vendors.ts             # Vendor data
    ├── batches.ts             # Batch data
    └── ...                    # All other tables
```

Each `.ts` file contains an array of records:

```typescript
export const batchesData = [
  {
    id: "946685d1-53d9-423f-9531-0edaa6ac8915",
    vesselId: "afb84d71-f761-4ed5-a084-12ad71c38541",
    initialVolume: "40.000",
    initialVolumeUnit: "L",
    currentVolume: "40.000",
    currentVolumeUnit: "L",
    status: "active",
    // ... more fields
  },
  // ... more records
]
```

## ✏️ Editing Exports for Schema Changes

### Example 1: Column Rename

**Before schema change** - you have `volumeL`:
```typescript
{
  id: "abc-123",
  volumeL: "100.5",
}
```

**After schema change** - you need `volume` + `volumeUnit`:
```typescript
{
  id: "abc-123",
  volume: "100.5",        // renamed
  volumeUnit: "L",        // added
}
```

### Example 2: Adding Required Fields

If your schema adds a new required field:

```typescript
{
  id: "abc-123",
  name: "Batch A",
  // Add the new required field with a default
  category: "cider",      // new field
}
```

### Example 3: Removing Fields

Just delete fields that no longer exist:

```typescript
{
  id: "abc-123",
  name: "Batch A",
  // deprecated_field: "value",  ← Remove this
}
```

### Example 4: Filtering Records

Remove records you don't want:

```typescript
export const batchesData = [
  {
    id: "real-batch",
    name: "Production Batch",
    // ... keep this
  },
  // DELETE test records before importing
  // {
  //   id: "test-batch",
  //   name: "Test Data",
  // },
]
```

## 🔧 Import Options

### Import Specific Tables Only

```bash
# Only import users and vendors
pnpm db:import 2025-09-29 --tables=users,vendors
```

### Skip Existing Records

```bash
# Don't overwrite records that already exist
pnpm db:import 2025-09-29 --skip-existing
```

### Dry Run (Preview)

```bash
# See what would be imported without making changes
pnpm db:import 2025-09-29 --dry-run
```

### Truncate First (⚠️ DANGEROUS)

```bash
# Delete all data before importing (CANNOT BE UNDONE!)
pnpm db:import 2025-09-29 --truncate
```

## 📋 Common Workflows

### Workflow 1: Before Major Schema Change

```bash
# 1. Export current data
pnpm db:export

# 2. Run your migration
pnpm db:migrate

# 3. Edit the export files to match new schema
# (edit files in data-exports/2025-09-29/)

# 4. Import the updated data
pnpm db:import 2025-09-29

# 5. Verify everything looks correct
```

### Workflow 2: Restore Backup

```bash
# 1. Find your backup folder
ls data-exports/

# 2. Import it (add --truncate if you want a clean slate)
pnpm db:import 2025-09-25
```

### Workflow 3: Copy Data to Dev Environment

```bash
# On production:
pnpm db:export

# Copy the export folder to dev environment
scp -r data-exports/2025-09-29 dev-server:/path/

# On dev:
pnpm db:import 2025-09-29 --truncate
```

### Workflow 4: Clean Up Test Data

```bash
# 1. Export current data
pnpm db:export

# 2. Edit each .ts file and delete test records

# 3. Reset database
pnpm db:reset

# 4. Import cleaned data
pnpm db:import 2025-09-29
```

## 🛡️ Safety Tips

### ✅ DO:
- Export before major schema changes
- Version control your exports (git)
- Test imports with `--dry-run` first
- Keep multiple backups
- Document your manual edits

### ❌ DON'T:
- Use `--truncate` without a backup
- Edit exports while import is running
- Forget to update foreign key references
- Skip testing after import

## 🔍 Troubleshooting

### Import Errors: Field Name Mismatch

**Error**: `Property 'volumeL' does not exist`

**Fix**: Edit the export file to use the correct field name:
```typescript
// Change volumeL to volume + volumeUnit
volume: "100.5",
volumeUnit: "L",
```

### Import Errors: Missing Required Field

**Error**: `Missing required field 'category'`

**Fix**: Add the field to all records:
```typescript
// Add the missing field with a default value
category: "cider",
```

### Import Errors: Foreign Key Violation

**Error**: `Foreign key constraint failed`

**Fix**: Import tables in dependency order. The import script handles this automatically, but if you're importing specific tables, make sure to include dependencies:

```bash
# Bad - batches reference vessels
pnpm db:import 2025-09-29 --tables=batches

# Good - import vessels first
pnpm db:import 2025-09-29 --tables=vessels,batches
```

## 📊 Export Data Structure

Tables are exported in this order (handles foreign key dependencies):

1. **Reference Data**
   - users
   - vendors
   - juiceVarieties

2. **Purchases**
   - juicePurchases → juicePurchaseItems
   - additivePurchases → additivePurchaseItems

3. **Vessels**
   - vessels

4. **Press Operations**
   - applePressRuns → applePressRunLoads
   - pressItems

5. **Batches**
   - batches
   - batchCompositions
   - batchMeasurements
   - batchTransfers

6. **Packaging**
   - packageSizes
   - packagingRuns
   - packagingRunPhotos
   - packages
   - inventoryItems

7. **Audit**
   - auditLog

## 💡 Advanced Tips

### Transforming Data During Export

Edit the export files to transform data:

```typescript
// Convert all volumes from gallons to liters
export const batchesData = [
  {
    id: "abc",
    volume: "378.541",        // 100 gal * 3.78541
    volumeUnit: "L",
  },
]
```

### Merging Multiple Exports

Copy records from multiple export folders:

```typescript
// data-exports/2025-09-29/batches.ts
export const batchesData = [
  ...batchesFrom2025,
  ...batchesFrom2024,
]
```

### Creating Test Data

Use exports as test data templates:

```typescript
// Edit exports to create test fixtures
export const testBatches = batchesData.map(b => ({
  ...b,
  id: `test-${b.id}`,  // New UUIDs
  name: `TEST: ${b.name}`,
}))
```

## 🎓 Summary

This system gives you **full control** over your database:
- Export anytime to save your data
- Edit the TypeScript files to match schema changes
- Import back to restore your data
- Never lose important data due to migrations

For questions or issues, check the generated `README.md` in each export folder.