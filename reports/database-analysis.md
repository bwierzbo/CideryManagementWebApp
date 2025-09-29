# Database Schema Analysis Report

Generated: 9/28/2025, 6:29:16 PM

## Summary
- **Total Entities**: 90
- **Unused Entities**: 54
- **Potentially Unused**: 0
- **Orphaned Queries**: 3
- **Schema Drift Issues**: 54

## Unused Entities
- **unitEnum** (enum) in `src/schema.ts`
- **batchStatusEnum** (enum) in `src/schema.ts`
- **vesselStatusEnum** (enum) in `src/schema.ts`
- **vesselTypeEnum** (enum) in `src/schema.ts`
- **vesselMaterialEnum** (enum) in `src/schema.ts`
- **vesselJacketedEnum** (enum) in `src/schema.ts`
- **transactionTypeEnum** (enum) in `src/schema.ts`
- **cogsItemTypeEnum** (enum) in `src/schema.ts`
- **userRoleEnum** (enum) in `src/schema.ts`
- **pressRunStatusEnum** (enum) in `src/schema.ts`
- **fruitTypeEnum** (enum) in `src/schema.ts`
- **ciderCategoryEnum** (enum) in `src/schema.ts`
- **intensityEnum** (enum) in `src/schema.ts`
- **harvestWindowEnum** (enum) in `src/schema.ts`
- **packagingItemTypeEnum** (enum) in `src/schema.ts`
- **juiceLots** (table) in `src/schema.ts`
- **vendorsRelations** (relation) in `src/schema.ts`
- **baseFruitVarietiesRelations** (relation) in `src/schema.ts`
- **vendorVarietiesRelations** (relation) in `src/schema.ts`
- **additiveVarietiesRelations** (relation) in `src/schema.ts`
- **vendorAdditiveVarietiesRelations** (relation) in `src/schema.ts`
- **juiceVarietiesRelations** (relation) in `src/schema.ts`
- **vendorJuiceVarietiesRelations** (relation) in `src/schema.ts`
- **packagingVarietiesRelations** (relation) in `src/schema.ts`
- **vendorPackagingVarietiesRelations** (relation) in `src/schema.ts`
- **basefruitPurchasesRelations** (relation) in `src/schema.ts`
- **basefruitPurchaseItemsRelations** (relation) in `src/schema.ts`
- **additivePurchasesRelations** (relation) in `src/schema.ts`
- **additivePurchaseItemsRelations** (relation) in `src/schema.ts`
- **juicePurchasesRelations** (relation) in `src/schema.ts`
- **juicePurchaseItemsRelations** (relation) in `src/schema.ts`
- **packagingPurchasesRelations** (relation) in `src/schema.ts`
- **packagingPurchaseItemsRelations** (relation) in `src/schema.ts`
- **pressRunsRelations** (relation) in `src/schema.ts`
- **juiceLotsRelations** (relation) in `src/schema.ts`
- **pressItemsRelations** (relation) in `src/schema.ts`
- **vesselsRelations** (relation) in `src/schema.ts`
- **batchesRelations** (relation) in `src/schema.ts`
- **batchMergeHistoryRelations** (relation) in `src/schema.ts`
- **batchCompositionsRelations** (relation) in `src/schema.ts`
- **batchMeasurementsRelations** (relation) in `src/schema.ts`
- **batchAdditivesRelations** (relation) in `src/schema.ts`
- **packagesRelations** (relation) in `src/schema.ts`
- **inventoryRelations** (relation) in `src/schema.ts`
- **inventoryTransactionsRelations** (relation) in `src/schema.ts`
- **batchCostsRelations** (relation) in `src/schema.ts`
- **cogsItemsRelations** (relation) in `src/schema.ts`
- **applePressRunsRelations** (relation) in `src/schema.ts`
- **applePressRunLoadsRelations** (relation) in `src/schema.ts`
- **tankMeasurements** (table) in `src/schema.ts`
- **tankAdditives** (table) in `src/schema.ts`
- **tankMeasurementsRelations** (relation) in `src/schema.ts`
- **tankAdditivesRelations** (relation) in `src/schema.ts`
- **batchTransfersRelations** (relation) in `src/schema.ts`

## Potentially Unused Entities
No potentially unused entities found.

## Orphaned Queries
- `packaging-optimized.ts:withCursorPagination`
- `packaging-optimized.ts:generateCursor`
- `packaging-optimized.ts:clearPackageSizesCache`

## Schema-Code Drift
- **unitEnum** (high): Enum unitEnum is defined but never used
- **batchStatusEnum** (high): Enum batchStatusEnum is defined but never used
- **vesselStatusEnum** (high): Enum vesselStatusEnum is defined but never used
- **vesselTypeEnum** (high): Enum vesselTypeEnum is defined but never used
- **vesselMaterialEnum** (high): Enum vesselMaterialEnum is defined but never used
- **vesselJacketedEnum** (high): Enum vesselJacketedEnum is defined but never used
- **transactionTypeEnum** (high): Enum transactionTypeEnum is defined but never used
- **cogsItemTypeEnum** (high): Enum cogsItemTypeEnum is defined but never used
- **userRoleEnum** (high): Enum userRoleEnum is defined but never used
- **pressRunStatusEnum** (high): Enum pressRunStatusEnum is defined but never used
- **fruitTypeEnum** (high): Enum fruitTypeEnum is defined but never used
- **ciderCategoryEnum** (high): Enum ciderCategoryEnum is defined but never used
- **intensityEnum** (high): Enum intensityEnum is defined but never used
- **harvestWindowEnum** (high): Enum harvestWindowEnum is defined but never used
- **packagingItemTypeEnum** (high): Enum packagingItemTypeEnum is defined but never used
- **juiceLots** (medium): Table juiceLots is defined but has no query usages
- **vendorsRelations** (low): Relation vendorsRelations is defined but never used
- **baseFruitVarietiesRelations** (low): Relation baseFruitVarietiesRelations is defined but never used
- **vendorVarietiesRelations** (low): Relation vendorVarietiesRelations is defined but never used
- **additiveVarietiesRelations** (low): Relation additiveVarietiesRelations is defined but never used
- **vendorAdditiveVarietiesRelations** (low): Relation vendorAdditiveVarietiesRelations is defined but never used
- **juiceVarietiesRelations** (low): Relation juiceVarietiesRelations is defined but never used
- **vendorJuiceVarietiesRelations** (low): Relation vendorJuiceVarietiesRelations is defined but never used
- **packagingVarietiesRelations** (low): Relation packagingVarietiesRelations is defined but never used
- **vendorPackagingVarietiesRelations** (low): Relation vendorPackagingVarietiesRelations is defined but never used
- **basefruitPurchasesRelations** (low): Relation basefruitPurchasesRelations is defined but never used
- **basefruitPurchaseItemsRelations** (low): Relation basefruitPurchaseItemsRelations is defined but never used
- **additivePurchasesRelations** (low): Relation additivePurchasesRelations is defined but never used
- **additivePurchaseItemsRelations** (low): Relation additivePurchaseItemsRelations is defined but never used
- **juicePurchasesRelations** (low): Relation juicePurchasesRelations is defined but never used
- **juicePurchaseItemsRelations** (low): Relation juicePurchaseItemsRelations is defined but never used
- **packagingPurchasesRelations** (low): Relation packagingPurchasesRelations is defined but never used
- **packagingPurchaseItemsRelations** (low): Relation packagingPurchaseItemsRelations is defined but never used
- **pressRunsRelations** (low): Relation pressRunsRelations is defined but never used
- **juiceLotsRelations** (low): Relation juiceLotsRelations is defined but never used
- **pressItemsRelations** (low): Relation pressItemsRelations is defined but never used
- **vesselsRelations** (low): Relation vesselsRelations is defined but never used
- **batchesRelations** (low): Relation batchesRelations is defined but never used
- **batchMergeHistoryRelations** (low): Relation batchMergeHistoryRelations is defined but never used
- **batchCompositionsRelations** (low): Relation batchCompositionsRelations is defined but never used
- **batchMeasurementsRelations** (low): Relation batchMeasurementsRelations is defined but never used
- **batchAdditivesRelations** (low): Relation batchAdditivesRelations is defined but never used
- **packagesRelations** (low): Relation packagesRelations is defined but never used
- **inventoryRelations** (low): Relation inventoryRelations is defined but never used
- **inventoryTransactionsRelations** (low): Relation inventoryTransactionsRelations is defined but never used
- **batchCostsRelations** (low): Relation batchCostsRelations is defined but never used
- **cogsItemsRelations** (low): Relation cogsItemsRelations is defined but never used
- **applePressRunsRelations** (low): Relation applePressRunsRelations is defined but never used
- **applePressRunLoadsRelations** (low): Relation applePressRunLoadsRelations is defined but never used
- **tankMeasurements** (medium): Table tankMeasurements is defined but has no query usages
- **tankAdditives** (medium): Table tankAdditives is defined but has no query usages
- **tankMeasurementsRelations** (low): Relation tankMeasurementsRelations is defined but never used
- **tankAdditivesRelations** (low): Relation tankAdditivesRelations is defined but never used
- **batchTransfersRelations** (low): Relation batchTransfersRelations is defined but never used

## Entity Usage Details
### materialTypeEnum (enum)
- **File**: `src/schema.ts`
- **Usages**: 12

- **Values**: apple, additive, juice, packaging

Usage breakdown:
  - `src/types/inventory.ts:4` (validation): export const materialTypeEnum = z.enum(['apple', 'additive', 'juice', 'packaging'])
  - `src/types/inventory.ts:111` (schema): materialType: materialTypeEnum,
  - `src/types/inventory.ts:128` (schema): materialType: materialTypeEnum.optional(),
  - `src/types/inventory.ts:137` (validation): materialTypes: z.array(materialTypeEnum).optional(),
  - `src/types/inventory.ts:142` (validation): export type MaterialType = z.infer<typeof materialTypeEnum>
  - ... and 7 more

### users (table)
- **File**: `src/schema.ts`
- **Usages**: 40
- **Columns**: 


Usage breakdown:
  - `src/routers/pressRun.ts:3` (import): import { db, applePressRuns, applePressRunLoads, vendors, vessels, basefruitPurchaseItems, basefruitPurchases, baseFruitVarieties, auditLog, users, batches, batchCompositions } from 'db'
  - `src/routers/pressRun.ts:1524` (schema): id: users.id,
  - `src/routers/pressRun.ts:1525` (schema): name: users.name,
  - `src/routers/pressRun.ts:1526` (schema): email: users.email,
  - `src/routers/pressRun.ts:1528` (import): .from(users)
  - ... and 35 more

### vendors (table)
- **File**: `src/schema.ts`
- **Usages**: 302
- **Columns**: 


Usage breakdown:
  - `src/services/inventory.ts:8` (schema): vendors,
  - `src/services/inventory.ts:212` (query): .select({ id: vendors.id })
  - `src/services/inventory.ts:213` (import): .from(vendors)
  - `src/services/inventory.ts:215` (schema): eq(vendors.id, transaction.vendorId),
  - `src/services/inventory.ts:216` (schema): eq(vendors.isActive, true),
  - ... and 297 more

### baseFruitVarieties (table)
- **File**: `src/schema.ts`
- **Usages**: 85
- **Columns**: 


Usage breakdown:
  - `src/routers/vendorVariety.ts:3` (import): import { db, vendorVarieties, baseFruitVarieties, vendors, auditLog,
  - `src/routers/vendorVariety.ts:21` (schema): id: baseFruitVarieties.id,
  - `src/routers/vendorVariety.ts:22` (schema): name: baseFruitVarieties.name,
  - `src/routers/vendorVariety.ts:23` (schema): isActive: baseFruitVarieties.isActive,
  - `src/routers/vendorVariety.ts:30` (schema): .innerJoin(baseFruitVarieties, eq(vendorVarieties.varietyId, baseFruitVarieties.id))
  - ... and 80 more

### vendorVarieties (table)
- **File**: `src/schema.ts`
- **Usages**: 55
- **Columns**: 


Usage breakdown:
  - `src/services/inventory.ts:12` (schema): vendorVarieties
  - `src/services/inventory.ts:230` (query): .select({ id: vendorVarieties.id })
  - `src/services/inventory.ts:231` (import): .from(vendorVarieties)
  - `src/services/inventory.ts:233` (schema): eq(vendorVarieties.vendorId, transaction.vendorId),
  - `src/services/inventory.ts:234` (schema): eq(vendorVarieties.varietyId, transaction.appleVarietyId),
  - ... and 50 more

### additiveVarieties (table)
- **File**: `src/schema.ts`
- **Usages**: 66
- **Columns**: 


Usage breakdown:
  - `src/routers/vendorVariety.ts:4` (schema): vendorAdditiveVarieties, additiveVarieties,
  - `src/routers/vendorVariety.ts:43` (schema): id: additiveVarieties.id,
  - `src/routers/vendorVariety.ts:44` (schema): name: additiveVarieties.name,
  - `src/routers/vendorVariety.ts:45` (schema): isActive: additiveVarieties.isActive,
  - `src/routers/vendorVariety.ts:50` (schema): category: additiveVarieties.itemType,
  - ... and 61 more

### vendorAdditiveVarieties (table)
- **File**: `src/schema.ts`
- **Usages**: 34
- **Columns**: 


Usage breakdown:
  - `src/routers/vendorVariety.ts:4` (schema): vendorAdditiveVarieties, additiveVarieties,
  - `src/routers/vendorVariety.ts:46` (schema): vendorVarietyId: vendorAdditiveVarieties.id,
  - `src/routers/vendorVariety.ts:47` (schema): notes: vendorAdditiveVarieties.notes,
  - `src/routers/vendorVariety.ts:48` (schema): linkedAt: vendorAdditiveVarieties.createdAt,
  - `src/routers/vendorVariety.ts:52` (import): .from(vendorAdditiveVarieties)
  - ... and 29 more

### juiceVarieties (table)
- **File**: `src/schema.ts`
- **Usages**: 57
- **Columns**: 


Usage breakdown:
  - `src/routers/vendorVariety.ts:5` (schema): vendorJuiceVarieties, juiceVarieties,
  - `src/routers/vendorVariety.ts:66` (schema): id: juiceVarieties.id,
  - `src/routers/vendorVariety.ts:67` (schema): name: juiceVarieties.name,
  - `src/routers/vendorVariety.ts:68` (schema): isActive: juiceVarieties.isActive,
  - `src/routers/vendorVariety.ts:75` (schema): .innerJoin(juiceVarieties, eq(vendorJuiceVarieties.varietyId, juiceVarieties.id))
  - ... and 52 more

### vendorJuiceVarieties (table)
- **File**: `src/schema.ts`
- **Usages**: 32
- **Columns**: 


Usage breakdown:
  - `src/routers/vendorVariety.ts:5` (schema): vendorJuiceVarieties, juiceVarieties,
  - `src/routers/vendorVariety.ts:69` (schema): vendorVarietyId: vendorJuiceVarieties.id,
  - `src/routers/vendorVariety.ts:70` (schema): notes: vendorJuiceVarieties.notes,
  - `src/routers/vendorVariety.ts:71` (schema): linkedAt: vendorJuiceVarieties.createdAt,
  - `src/routers/vendorVariety.ts:74` (import): .from(vendorJuiceVarieties)
  - ... and 27 more

### packagingVarieties (table)
- **File**: `src/schema.ts`
- **Usages**: 60
- **Columns**: 


Usage breakdown:
  - `src/routers/vendorVariety.ts:6` (import): vendorPackagingVarieties, packagingVarieties } from 'db'
  - `src/routers/vendorVariety.ts:88` (schema): id: packagingVarieties.id,
  - `src/routers/vendorVariety.ts:89` (schema): name: packagingVarieties.name,
  - `src/routers/vendorVariety.ts:90` (schema): isActive: packagingVarieties.isActive,
  - `src/routers/vendorVariety.ts:95` (schema): category: packagingVarieties.itemType,
  - ... and 55 more

### vendorPackagingVarieties (table)
- **File**: `src/schema.ts`
- **Usages**: 32
- **Columns**: 


Usage breakdown:
  - `src/routers/vendorVariety.ts:6` (import): vendorPackagingVarieties, packagingVarieties } from 'db'
  - `src/routers/vendorVariety.ts:91` (schema): vendorVarietyId: vendorPackagingVarieties.id,
  - `src/routers/vendorVariety.ts:92` (schema): notes: vendorPackagingVarieties.notes,
  - `src/routers/vendorVariety.ts:93` (schema): linkedAt: vendorPackagingVarieties.createdAt,
  - `src/routers/vendorVariety.ts:97` (import): .from(vendorPackagingVarieties)
  - ... and 27 more

### basefruitPurchases (table)
- **File**: `src/schema.ts`
- **Usages**: 161
- **Columns**: 


Usage breakdown:
  - `src/routers/reports.ts:4` (import): import { db, basefruitPurchases, basefruitPurchaseItems, vendors, baseFruitVarieties } from 'db'
  - `src/routers/reports.ts:31` (schema): const purchase = await db.query.basefruitPurchases.findFirst({
  - `src/routers/reports.ts:32` (schema): where: eq(basefruitPurchases.id, input.purchaseId),
  - `src/routers/reports.ts:89` (schema): gte(basefruitPurchases.purchaseDate, input.startDate),
  - `src/routers/reports.ts:90` (schema): lte(basefruitPurchases.purchaseDate, input.endDate)
  - ... and 156 more

### basefruitPurchaseItems (table)
- **File**: `src/schema.ts`
- **Usages**: 141
- **Columns**: 


Usage breakdown:
  - `src/routers/reports.ts:4` (import): import { db, basefruitPurchases, basefruitPurchaseItems, vendors, baseFruitVarieties } from 'db'
  - `src/routers/reports.ts:106` (schema): where: input.varietyId ? eq(basefruitPurchaseItems.fruitVarietyId, input.varietyId) : undefined
  - `src/routers/pressRun.ts:3` (import): import { db, applePressRuns, applePressRunLoads, vendors, vessels, basefruitPurchaseItems, basefruitPurchases, baseFruitVarieties, auditLog, users, batches, batchCompositions } from 'db'
  - `src/routers/pressRun.ts:176` (import): .from(basefruitPurchaseItems)
  - `src/routers/pressRun.ts:178` (schema): eq(basefruitPurchaseItems.id, input.purchaseItemId),
  - ... and 136 more

### additivePurchases (table)
- **File**: `src/schema.ts`
- **Usages**: 53
- **Columns**: 


Usage breakdown:
  - `src/routers/inventory.ts:14` (schema): additivePurchases,
  - `src/routers/inventory.ts:90` (schema): 'purchaseId', ${additivePurchases.id},
  - `src/routers/inventory.ts:103` (schema): 'purchaseDate', ${additivePurchases.purchaseDate}
  - `src/routers/inventory.ts:107` (schema): createdAt: additivePurchases.purchaseDate,
  - `src/routers/inventory.ts:108` (query): updatedAt: additivePurchases.updatedAt
  - ... and 48 more

### additivePurchaseItems (table)
- **File**: `src/schema.ts`
- **Usages**: 31
- **Columns**: 


Usage breakdown:
  - `src/routers/inventory.ts:15` (schema): additivePurchaseItems,
  - `src/routers/inventory.ts:84` (schema): id: sql<string>`CONCAT('additive-', ${additivePurchaseItems.id})`,
  - `src/routers/inventory.ts:86` (schema): currentBottleCount: sql<number>`COALESCE(CAST(${additivePurchaseItems.quantity} AS NUMERIC), 0)`,
  - `src/routers/inventory.ts:92` (schema): 'varietyName', COALESCE(${additiveVarieties.name}, ${additivePurchaseItems.additiveType}),
  - `src/routers/inventory.ts:93` (schema): 'varietyType', COALESCE(${additiveVarieties.itemType}, ${additivePurchaseItems.additiveType}),
  - ... and 26 more

### juicePurchases (table)
- **File**: `src/schema.ts`
- **Usages**: 52
- **Columns**: 


Usage breakdown:
  - `src/routers/juicePurchases.ts:3` (import): import { db, juicePurchases, juicePurchaseItems, vendors } from 'db'
  - `src/routers/juicePurchases.ts:19` (query): const conditions = [isNull(juicePurchases.deletedAt)]
  - `src/routers/juicePurchases.ts:21` (schema): conditions.push(eq(juicePurchases.vendorId, vendorId))
  - `src/routers/juicePurchases.ts:26` (schema): id: juicePurchases.id,
  - `src/routers/juicePurchases.ts:27` (schema): vendorId: juicePurchases.vendorId,
  - ... and 47 more

### juicePurchaseItems (table)
- **File**: `src/schema.ts`
- **Usages**: 26
- **Columns**: 


Usage breakdown:
  - `src/routers/juicePurchases.ts:3` (import): import { db, juicePurchases, juicePurchaseItems, vendors } from 'db'
  - `src/routers/juicePurchases.ts:170` (query): .insert(juicePurchaseItems)
  - `src/routers/juicePurchases.ts:170` (query): .insert(juicePurchaseItems)
  - `src/routers/inventory.ts:18` (schema): juicePurchaseItems,
  - `src/routers/inventory.ts:119` (schema): id: sql<string>`CONCAT('juice-', ${juicePurchaseItems.id})`,
  - ... and 21 more

### packagingPurchases (table)
- **File**: `src/schema.ts`
- **Usages**: 52
- **Columns**: 


Usage breakdown:
  - `src/routers/packagingPurchases.ts:3` (import): import { db, packagingPurchases, packagingPurchaseItems, vendors } from 'db'
  - `src/routers/packagingPurchases.ts:19` (query): const conditions = [isNull(packagingPurchases.deletedAt)]
  - `src/routers/packagingPurchases.ts:21` (schema): conditions.push(eq(packagingPurchases.vendorId, vendorId))
  - `src/routers/packagingPurchases.ts:26` (schema): id: packagingPurchases.id,
  - `src/routers/packagingPurchases.ts:27` (schema): vendorId: packagingPurchases.vendorId,
  - ... and 47 more

### packagingPurchaseItems (table)
- **File**: `src/schema.ts`
- **Usages**: 23
- **Columns**: 


Usage breakdown:
  - `src/routers/packagingPurchases.ts:3` (import): import { db, packagingPurchases, packagingPurchaseItems, vendors } from 'db'
  - `src/routers/packagingPurchases.ts:170` (query): .insert(packagingPurchaseItems)
  - `src/routers/packagingPurchases.ts:170` (query): .insert(packagingPurchaseItems)
  - `src/routers/inventory.ts:20` (schema): packagingPurchaseItems
  - `src/routers/inventory.ts:148` (schema): id: sql<string>`CONCAT('packaging-', ${packagingPurchaseItems.id})`,
  - ... and 18 more

### pressRuns (table)
- **File**: `src/schema.ts`
- **Usages**: 38
- **Columns**: 


Usage breakdown:
  - `src/routers/pressRun.ts:1411` (schema): pressRuns: enhancedPressRuns,
  - `src/routers/index.ts:32` (schema): pressRuns,
  - `src/routers/index.ts:1267` (schema): id: pressRuns.id,
  - `src/routers/index.ts:1268` (schema): runDate: pressRuns.runDate,
  - `src/routers/index.ts:1269` (schema): totalAppleProcessedKg: pressRuns.totalAppleProcessedKg,
  - ... and 33 more

### pressItems (table)
- **File**: `src/schema.ts`
- **Usages**: 15
- **Columns**: 


Usage breakdown:
  - `src/routers/index.ts:33` (schema): pressItems,
  - `src/routers/index.ts:1368` (query): .insert(pressItems)
  - `src/routers/index.ts:1468` (query): .update(pressItems)
  - `src/routers/index.ts:1475` (schema): .where(and(eq(pressItems.id, item.pressItemId), eq(pressItems.pressRunId, input.pressRunId)))
  - `src/routers/index.ts:1475` (schema): .where(and(eq(pressItems.id, item.pressItemId), eq(pressItems.pressRunId, input.pressRunId)))
  - ... and 10 more

### vessels (table)
- **File**: `src/schema.ts`
- **Usages**: 217
- **Columns**: 


Usage breakdown:
  - `src/services/inventory.ts:11` (schema): vessels,
  - `src/services/inventory.ts:284` (query): .select({ id: vessels.id, status: vessels.status })
  - `src/services/inventory.ts:284` (query): .select({ id: vessels.id, status: vessels.status })
  - `src/services/inventory.ts:285` (import): .from(vessels)
  - `src/services/inventory.ts:287` (schema): eq(vessels.id, transaction.vesselId),
  - ... and 212 more

### batches (table)
- **File**: `src/schema.ts`
- **Usages**: 293
- **Columns**: 


Usage breakdown:
  - `src/routers/pressRun.ts:3` (import): import { db, applePressRuns, applePressRunLoads, vendors, vessels, basefruitPurchaseItems, basefruitPurchases, baseFruitVarieties, auditLog, users, batches, batchCompositions } from 'db'
  - `src/routers/pressRun.ts:632` (query): .insert(batches)
  - `src/routers/pressRun.ts:643` (schema): .returning({ id: batches.id })
  - `src/routers/pressRun.ts:721` (schema): // Complete press run and create batches - admin/operator only
  - `src/routers/pressRun.ts:750` (schema): // Check if batches already exist for this press run
  - ... and 288 more

### batchCompositions (table)
- **File**: `src/schema.ts`
- **Usages**: 48
- **Columns**: 


Usage breakdown:
  - `src/routers/pressRun.ts:3` (import): import { db, applePressRuns, applePressRunLoads, vendors, vessels, basefruitPurchaseItems, basefruitPurchases, baseFruitVarieties, auditLog, users, batches, batchCompositions } from 'db'
  - `src/routers/pressRun.ts:627` (schema): batchCompositions: batchCompositionData
  - `src/routers/pressRun.ts:672` (query): await tx.insert(batchCompositions).values({
  - `src/routers/pressRun.ts:1033` (schema): batchCompositions: batchCompositionData
  - `src/routers/pressRun.ts:1109` (import): .from(batchCompositions)
  - ... and 43 more

### batchMeasurements (table)
- **File**: `src/schema.ts`
- **Usages**: 61
- **Columns**: 


Usage breakdown:
  - `src/routers/index.ts:36` (schema): batchMeasurements,
  - `src/routers/index.ts:1761` (query): .insert(batchMeasurements)
  - `src/routers/index.ts:1961` (import): .from(batchMeasurements)
  - `src/routers/index.ts:1962` (query): .where(and(eq(batchMeasurements.batchId, input.id), isNull(batchMeasurements.deletedAt)))
  - `src/routers/index.ts:1962` (query): .where(and(eq(batchMeasurements.batchId, input.id), isNull(batchMeasurements.deletedAt)))
  - ... and 56 more

### batchAdditives (table)
- **File**: `src/schema.ts`
- **Usages**: 26
- **Columns**: 


Usage breakdown:
  - `src/routers/batch.ts:3` (import): import { db, batches, batchCompositions, vendors, baseFruitVarieties, purchaseItems, vessels, batchMeasurements, batchAdditives, applePressRuns, basefruitPurchaseItems, basefruitPurchases, batchMergeHistory, batchTransfers } from 'db'
  - `src/routers/batch.ts:404` (schema): id: batchAdditives.id,
  - `src/routers/batch.ts:405` (schema): additiveType: batchAdditives.additiveType,
  - `src/routers/batch.ts:406` (schema): additiveName: batchAdditives.additiveName,
  - `src/routers/batch.ts:407` (schema): amount: batchAdditives.amount,
  - ... and 21 more

### packages (table)
- **File**: `src/schema.ts`
- **Usages**: 14
- **Columns**: 


Usage breakdown:
  - `src/services/inventory.ts:6` (schema): packages,
  - `src/routers/inventory.ts:7` (schema): packages,
  - `src/routers/index.ts:38` (schema): packages,
  - `src/routers/index.ts:2387` (schema): totalVolumeL: sql<number>`sum(${packages.volumePackagedL}::decimal * ${inventory.currentBottleCount}::decimal / ${packages.bottleCount}::decimal)`,
  - `src/routers/index.ts:2387` (schema): totalVolumeL: sql<number>`sum(${packages.volumePackagedL}::decimal * ${inventory.currentBottleCount}::decimal / ${packages.bottleCount}::decimal)`,
  - ... and 9 more

### inventory (table)
- **File**: `src/schema.ts`
- **Usages**: 329
- **Columns**: 


Usage breakdown:
  - `src/types/inventory.ts:16` (schema): // Apple transaction - for base fruit inventory tracking
  - `src/types/inventory.ts:42` (schema): // Juice transaction - for pressed juice inventory
  - `src/types/inventory.ts:79` (validation): // Simplified transaction schema for recording transactions on existing inventory items
  - `src/types/inventory.ts:81` (validation): inventoryId: z.string().uuid('Invalid inventory ID'),
  - `src/types/inventory.ts:89` (validation): // Extended transaction schema for creating new inventory items with material-specific data
  - ... and 324 more

### inventoryTransactions (table)
- **File**: `src/schema.ts`
- **Usages**: 24
- **Columns**: 


Usage breakdown:
  - `src/services/inventory.ts:5` (schema): inventoryTransactions,
  - `src/services/inventory.ts:427` (query): .insert(inventoryTransactions)
  - `src/services/inventory.ts:499` (query): .insert(inventoryTransactions)
  - `src/services/inventory.ts:585` (query): .insert(inventoryTransactions)
  - `src/services/inventory.ts:714` (schema): inventoryId: inventoryTransactions.inventoryId,
  - ... and 19 more

### batchCosts (table)
- **File**: `src/schema.ts`
- **Usages**: 18
- **Columns**: 


Usage breakdown:
  - `src/routers/index.ts:2829` (schema): // TODO: Implement when batchCosts and cogsItems tables are created
  - `src/routers/index.ts:2850` (schema): batchId: batchCosts.batchId,
  - `src/routers/index.ts:2853` (schema): totalAppleCost: batchCosts.totalAppleCost,
  - `src/routers/index.ts:2854` (schema): laborCost: batchCosts.laborCost,
  - `src/routers/index.ts:2855` (schema): overheadCost: batchCosts.overheadCost,
  - ... and 13 more

### cogsItems (table)
- **File**: `src/schema.ts`
- **Usages**: 20
- **Columns**: 


Usage breakdown:
  - `src/routers/index.ts:2829` (schema): // TODO: Implement when batchCosts and cogsItems tables are created
  - `src/routers/index.ts:2870` (schema): const cogsItems = await db
  - `src/routers/index.ts:2872` (schema): batchId: cogsItems.batchId,
  - `src/routers/index.ts:2873` (schema): itemType: cogsItems.itemType,
  - `src/routers/index.ts:2874` (schema): description: cogsItems.description,
  - ... and 15 more

### applePressRuns (table)
- **File**: `src/schema.ts`
- **Usages**: 179
- **Columns**: 


Usage breakdown:
  - `src/services/inventory.ts:10` (schema): applePressRuns,
  - `src/services/inventory.ts:258` (query): .select({ id: applePressRuns.id, status: applePressRuns.status })
  - `src/services/inventory.ts:258` (query): .select({ id: applePressRuns.id, status: applePressRuns.status })
  - `src/services/inventory.ts:259` (import): .from(applePressRuns)
  - `src/services/inventory.ts:261` (schema): eq(applePressRuns.id, transaction.pressRunId),
  - ... and 174 more

### applePressRunLoads (table)
- **File**: `src/schema.ts`
- **Usages**: 138
- **Columns**: 


Usage breakdown:
  - `src/routers/pressRun.ts:3` (import): import { db, applePressRuns, applePressRunLoads, vendors, vessels, basefruitPurchaseItems, basefruitPurchases, baseFruitVarieties, auditLog, users, batches, batchCompositions } from 'db'
  - `src/routers/pressRun.ts:209` (query): .select({ maxSequence: sql<number>`COALESCE(MAX(${applePressRunLoads.loadSequence}), 0)` })
  - `src/routers/pressRun.ts:210` (import): .from(applePressRunLoads)
  - `src/routers/pressRun.ts:211` (query): .where(and(eq(applePressRunLoads.applePressRunId, input.pressRunId), isNull(applePressRunLoads.deletedAt)))
  - `src/routers/pressRun.ts:211` (query): .where(and(eq(applePressRunLoads.applePressRunId, input.pressRunId), isNull(applePressRunLoads.deletedAt)))
  - ... and 133 more

### auditLog (table)
- **File**: `src/schema.ts`
- **Usages**: 43
- **Columns**: 


Usage breakdown:
  - `src/services/inventory.ts:9` (schema): auditLog,
  - `src/services/inventory.ts:60` (query): await db.insert(auditLog).values({
  - `src/services/inventory.ts:60` (query): await db.insert(auditLog).values({
  - `src/services/inventory.ts:60` (query): await db.insert(auditLog).values({
  - `src/routers/vendorVariety.ts:3` (import): import { db, vendorVarieties, baseFruitVarieties, vendors, auditLog,
  - ... and 38 more

### batchTransfers (table)
- **File**: `src/schema.ts`
- **Usages**: 47
- **Columns**: 


Usage breakdown:
  - `src/routers/index.ts:37` (schema): batchTransfers,
  - `src/routers/index.ts:2593` (schema): // Record the transfer in batchTransfers table
  - `src/routers/index.ts:2595` (query): .insert(batchTransfers)
  - `src/routers/index.ts:2640` (query): let whereClause = and(isNull(batchTransfers.deletedAt))
  - `src/routers/index.ts:2646` (schema): eq(batchTransfers.sourceVesselId, input.vesselId),
  - ... and 42 more

### batchMergeHistory (table)
- **File**: `src/schema.ts`
- **Usages**: 26
- **Columns**: 


Usage breakdown:
  - `src/routers/batch.ts:3` (import): import { db, batches, batchCompositions, vendors, baseFruitVarieties, purchaseItems, vessels, batchMeasurements, batchAdditives, applePressRuns, basefruitPurchaseItems, basefruitPurchases, batchMergeHistory, batchTransfers } from 'db'
  - `src/routers/batch.ts:829` (schema): id: batchMergeHistory.id,
  - `src/routers/batch.ts:830` (schema): mergedAt: batchMergeHistory.mergedAt,
  - `src/routers/batch.ts:831` (schema): volumeAddedL: batchMergeHistory.volumeAddedL,
  - `src/routers/batch.ts:832` (schema): targetVolumeBeforeL: batchMergeHistory.targetVolumeBeforeL,
  - ... and 21 more



