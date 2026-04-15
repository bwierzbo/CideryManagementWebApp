# Cidery Management System Map

## Production Workflow (End-to-End Data Flow)

```
Orchard/Vendor → Purchase (fruit, juice, additives) → Inventory
                                                          ↓
Press Run (loads, juice yield) → Vessel (fermentation batch created)
                                         ↓
                              Measurements (SG, pH, temp, ABV)
                              Additives (yeast, sulfites, sugar, fruit)
                              Racking / Filtering / Carbonation
                                         ↓
                              Transfer / Blend → New Vessel(s)
                                         ↓
                              Set to Aging → Packaging
                                         ↓
                    ┌─────────────────────┴──────────────────────┐
              Bottling (bottle runs)                    Kegging (keg fills)
              → Labels, Caps, Labor                    → Keg inventory
              → Mark Ready → Distribute                → Distribute → Return
                    ↓                                          ↓
              Inventory Items                          Keg Tracking
              → Sales (Square POS)                     → Distribution locations
                    ↓
              TTB Compliance Reporting
              → Reconciliation snapshots
              → Period reports

Parallel track:
  Distillation: Cider → Send to distillery → Receive brandy → Barrel aging
  Pommeau: Brandy + Cider/Juice → Fortified blend
```

## Architecture Overview

| Layer | Technology | Location |
|-------|-----------|----------|
| Frontend | Next.js 15 + React + TypeScript + Tailwind | `apps/web/` |
| UI Components | shadcn/ui (194 components, 18 groups) | `apps/web/src/components/` |
| API | tRPC (34 routers, 281 procedures) | `packages/api/` |
| Database | PostgreSQL (Neon) + Drizzle ORM | `packages/db/` |
| Shared Logic | Calculations, validation, RBAC, audit | `packages/lib/` |
| Auth | NextAuth.js (JWT, credentials provider) | `apps/web/src/lib/auth.ts` |
| Deployment | Vercel | Auto-deploy from main |

## Page Routes (37 total)

### Core Operations
- `/dashboard` — Stats, recent batches, quick actions
- `/cellar` — Vessel map, batch management, tank actions (3,147-line page)
- `/pressing` — Press run creation, loads, completion
- `/distillation` — Send to distillery, receive brandy, pommeau creation

### Inventory & Purchases
- `/inventory` — All inventory: fruit, juice, additives, packaging, finished goods
- `/vendors` — Vendor management, variety linking

### Packaging & Distribution
- `/packaging` — Bottle runs, keg fills, bulk actions, COGS
- `/kegs` — Keg inventory, fill tracking, distribution

### Reporting & Compliance
- `/reports` — Batch trace, sales, reconciliation
- `/reports/ttb` — Federal alcohol tax reporting
- `/audit-trail` — Change history, reconciliation logs
- `/activity-register` — Activity logging

### Admin
- `/admin` — Settings, batch reconciliation, TTB onboarding
- `/admin/batch-reconciliation` — Volume reconciliation

## Database (50+ tables, 35+ enums, 125+ migrations)

### Core Entities
- `batches` — Central record: vessel, volume, status, gravity, ABV, product type
- `vessels` — Tanks, barrels, IBCs, carboys, drums (capacity, material, status)
- `batchMeasurements` — SG, pH, temp, ABV readings
- `batchAdditives` — Yeast, sulfites, sugar, fruit additions
- `batchTransfers` — Movement between vessels
- `batchMergeHistory` — Blend tracking

### Purchase Pipeline
- `basefruitPurchases/Items` — Fruit sourcing
- `juicePurchases/Items` — Pre-made juice
- `additivePurchases/Items` — Chemicals, yeast, nutrients
- `packagingPurchases/Items` — Bottles, caps, labels

### Packaging & Distribution
- `bottleRuns` — Packaging events (volume, units, loss, status lifecycle)
- `bottleRunMaterials` — Materials used per run (with cost snapshot)
- `kegs` / `kegFills` — Keg inventory and fill tracking
- `inventoryItems` — Finished goods linked to bottle runs

### Compliance
- `ttbReportingPeriods` / `ttbPeriodSnapshots` — Federal reporting
- `ttbReconciliationSnapshots` — Volume reconciliation
- `salesChannels` — Distribution channel tracking
- `auditLogs` — Complete change history

## Environment Variables
- `DATABASE_URL` — Neon PostgreSQL connection
- `NEXTAUTH_SECRET` — JWT signing key
- `NEXTAUTH_URL` — App URL (localhost:3001 dev, Vercel prod)

---

# Risk & Tech Debt Audit

## Priority 1: Critical

### 1. `currentVolume` / `currentVolumeLiters` drift
**Severity: Critical | Likelihood: Active**

The `batches` table has two volume fields. ~14 locations across 3 routers update `currentVolume` without updating `currentVolumeLiters`. No database trigger was found in the Drizzle schema. TTB reports and the cellar liquid map read `currentVolumeLiters`.

**Files:** `packages/api/src/routers/index.ts` (lines 2505, 4168, 4205, 4426, 4437, 5043, 5053, 5069), `batch.ts` (lines 4929, 5103, 5170, 5229, 5512, 5584), `kegs.ts` (lines 1029, 1051)

**Fix:** Add `currentVolumeLiters` to every `.set()` that updates `currentVolume`, or create a proper DB trigger.

## Priority 2: High

### 2. N+1 query patterns
**Severity: High | Likelihood: On every page load**

Inventory levels query runs 2N+1 queries for N varieties. Similar patterns in dashboard, batch lineage, and purchase details.

**Files:** `index.ts` lines 1715-1776, 406; `batch.ts` lines 4212, 6717; `dashboard.ts` line 142

### 3. liquidMap performs writes during reads
**Severity: High | Likelihood: Every cellar page load**

The `liquidMap` query auto-fixes vessel statuses and completes empty batches — write operations inside a read endpoint. Can cause race conditions under concurrent access.

**Files:** `index.ts` lines 3473-3528

### 4. Giant files need decomposition
**Severity: High | Likelihood: Every code change**

| File | Lines |
|------|-------|
| `batch.ts` | 9,741 |
| `index.ts` | 6,390 |
| `cellar/page.tsx` | 3,147 |
| `pressRun.ts` | 3,576 |

## Priority 3: Medium

### 5. Vendor router missing `deletedAt` checks
**Files:** `vendor.ts` lines 92-146, 168-172, 231-234, 286-289

### 6. Health endpoints expose system diagnostics publicly
**Files:** `health.ts` — `database`, `system`, `diagnostics` procedures use `publicProcedure`

### 7. Purchase table FKs missing cascade rules
**Files:** `schema.ts` lines 508, 523, 551, 566, 594, 609, 635, 650, 890, 930, 1118, 1126

### 8. Missing indexes on batch_measurements
Should have composite index on `(batch_id, measurement_date DESC)` — queried on every cellar page load.

### 9. Debug console.logs in production
**Files:** `vendor.ts` lines 82-89, `batch.ts` scattered

## Priority 4: Low

### 10. Commented-out code and stale TODOs
### 11. Square access token stored unencrypted (noted in setup docs)

## Verified Safe
- No SQL injection vectors (all queries parameterized via Drizzle `sql` template)
- No hardcoded secrets (bcrypt hashes in seed data only)
- Middleware route protection is correct and comprehensive
- RBAC system properly gates procedures

---

# Recommended Next Milestone

**Option A: Inventory + Batch Traceability** — already largely built. The system can trace from bottle run → batch → press run → fruit purchases. The main gap is the COGS rollup display and ensuring `currentVolumeLiters` is accurate.

**Recommendation: Fix the Critical + High items first (items 1-4 above), then focus on operational polish (the work we've been doing).** The system is feature-rich but needs hardening, not new features.
