# Database Backup - Quick Start

## Export Your Data NOW

```bash
cd packages/db
pnpm db:export
```

This creates: `data-exports/2025-09-29/` with all your data in TypeScript files.

## When Schema Changes (Like Our Volume Migration)

### 1. Export Before Migration
```bash
pnpm db:export
```

### 2. Run Your Migration
```bash
pnpm db:migrate
```

### 3. Edit The Export Files

Open `data-exports/2025-09-29/batches.ts` and update:

```typescript
// OLD FORMAT (if you exported before the change)
{
  volumeL: "100.5",
}

// NEW FORMAT (what you need to change it to)
{
  volume: "100.5",
  volumeUnit: "L",
}
```

### 4. Import Back
```bash
# Test first
pnpm db:import 2025-09-29 --dry-run

# Then do it for real
pnpm db:import 2025-09-29
```

## Common Commands

```bash
# Export all data
pnpm db:export

# Import all data
pnpm db:import 2025-09-29

# Import only specific tables
pnpm db:import 2025-09-29 --tables=users,vendors,batches

# Test without making changes
pnpm db:import 2025-09-29 --dry-run

# Skip records that already exist
pnpm db:import 2025-09-29 --skip-existing

# Nuclear option - delete everything first (CAREFUL!)
pnpm db:import 2025-09-29 --truncate
```

## What Gets Exported?

All tables in TypeScript format:
- users.ts (3 records)
- vendors.ts (31 records)
- vessels.ts (18 records)
- batches.ts (14 records)
- applePressRuns.ts (62 records)
- and many more...

Each file is human-readable and editable!

## Your Current Export

You already have an export at:
```
packages/db/data-exports/2025-09-29/
```

This contains all your current data including:
- 3 users
- 31 vendors
- 18 vessels
- 14 batches
- 62 press runs
- 58 press run loads
- 32 batch compositions
- 11 batch measurements
- 6 batch transfers
- and audit logs

## Safety Net

**Before any risky operation:**
1. Export: `pnpm db:export`
2. Do the risky thing
3. If it breaks: `pnpm db:reset && pnpm db:import 2025-09-29`

## Need More Details?

See `DATA_BACKUP_GUIDE.md` for comprehensive documentation.