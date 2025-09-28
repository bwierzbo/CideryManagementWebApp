# Knip Analysis Results

## Unused Files (21)

```
apps/web/src/components/inventory/BatchMergeHistory.tsx
apps/web/src/components/inventory/SearchHighlighter.tsx
apps/web/src/components/inventory/VendorVarietyManagement.tsx
apps/web/src/components/packaging/packaging-detail-cards.tsx
apps/web/src/components/pressing/FruitLoadForm.tsx
apps/web/src/components/pressing/OfflineFruitLoadForm.tsx
apps/web/src/components/ui/progress.tsx
apps/web/src/hooks/use-press-run-drafts.ts
apps/web/src/hooks/useOptimizedPackagingQueries.ts
apps/web/src/lib/conflict-resolution.ts
apps/web/src/lib/offline-storage.ts
apps/web/src/lib/service-worker.ts
apps/web/src/server/routers/press-run.ts
apps/web/src/server/trpc.ts
apps/web/src/utils/inventoryPerformanceTest.ts
apps/web/src/utils/pdf/juice-lot-receipt.tsx
packages/api/src/middleware/cors.ts
packages/api/src/middleware/csrf.ts
packages/api/src/services/audit-service.ts
packages/lib/src/calculations/temperature.ts
packages/lib/src/validations/inventory-validations.ts
```

## Major Cleanup Categories

### UI Components (6 files)
- Inventory: BatchMergeHistory, SearchHighlighter, VendorVarietyManagement
- Packaging: packaging-detail-cards
- Pressing: FruitLoadForm, OfflineFruitLoadForm
- UI: progress

### Hooks & State (2 files)
- use-press-run-drafts
- useOptimizedPackagingQueries

### Infrastructure (3 files)
- conflict-resolution
- offline-storage
- service-worker

### Backend (4 files)
- press-run router
- trpc server setup
- cors middleware
- csrf middleware

### Services & Utils (6 files)
- audit-service
- inventoryPerformanceTest
- juice-lot-receipt PDF
- temperature calculations
- inventory validations