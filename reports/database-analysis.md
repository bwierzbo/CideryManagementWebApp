# Database Schema Analysis Report

Generated: 9/28/2025, 6:46:58 PM

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
  - `src/services/inventory.ts:28` (schema): materialTypeEnum,
  - `src/routers/inventory.ts:31` (schema): materialTypeEnum,
  - `src/routers/inventory.ts:413` (schema): materialType: materialTypeEnum.optional(),
  - `src/types/inventory.ts:4` (validation): export const materialTypeEnum = z.enum([
  - `src/types/inventory.ts:148` (schema): materialType: materialTypeEnum,
  - ... and 7 more

### users (table)
- **File**: `src/schema.ts`
- **Usages**: 39
- **Columns**: 


Usage breakdown:
  - `src/routers/pressRun.ts:13` (schema): users,
  - `src/routers/pressRun.ts:1788` (schema): id: users.id,
  - `src/routers/pressRun.ts:1789` (schema): name: users.name,
  - `src/routers/pressRun.ts:1790` (schema): email: users.email,
  - `src/routers/pressRun.ts:1792` (import): .from(users)
  - ... and 34 more

### vendors (table)
- **File**: `src/schema.ts`
- **Usages**: 292
- **Columns**: 


Usage breakdown:
  - `src/services/inventory.ts:8` (schema): vendors,
  - `src/services/inventory.ts:249` (query): .select({ id: vendors.id })
  - `src/services/inventory.ts:250` (import): .from(vendors)
  - `src/services/inventory.ts:253` (schema): eq(vendors.id, transaction.vendorId),
  - `src/services/inventory.ts:254` (schema): eq(vendors.isActive, true),
  - ... and 287 more

### baseFruitVarieties (table)
- **File**: `src/schema.ts`
- **Usages**: 85
- **Columns**: 


Usage breakdown:
  - `src/routers/vendorVariety.ts:6` (schema): baseFruitVarieties,
  - `src/routers/vendorVariety.ts:32` (schema): id: baseFruitVarieties.id,
  - `src/routers/vendorVariety.ts:33` (schema): name: baseFruitVarieties.name,
  - `src/routers/vendorVariety.ts:34` (schema): isActive: baseFruitVarieties.isActive,
  - `src/routers/vendorVariety.ts:42` (schema): baseFruitVarieties,
  - ... and 80 more

### vendorVarieties (table)
- **File**: `src/schema.ts`
- **Usages**: 56
- **Columns**: 


Usage breakdown:
  - `src/services/inventory.ts:12` (schema): vendorVarieties,
  - `src/services/inventory.ts:269` (query): .select({ id: vendorVarieties.id })
  - `src/services/inventory.ts:270` (import): .from(vendorVarieties)
  - `src/services/inventory.ts:273` (schema): eq(vendorVarieties.vendorId, transaction.vendorId),
  - `src/services/inventory.ts:274` (schema): eq(vendorVarieties.varietyId, transaction.appleVarietyId),
  - ... and 51 more

### additiveVarieties (table)
- **File**: `src/schema.ts`
- **Usages**: 66
- **Columns**: 


Usage breakdown:
  - `src/routers/vendorVariety.ts:10` (schema): additiveVarieties,
  - `src/routers/vendorVariety.ts:57` (schema): id: additiveVarieties.id,
  - `src/routers/vendorVariety.ts:58` (schema): name: additiveVarieties.name,
  - `src/routers/vendorVariety.ts:59` (schema): isActive: additiveVarieties.isActive,
  - `src/routers/vendorVariety.ts:64` (schema): category: additiveVarieties.itemType,
  - ... and 61 more

### vendorAdditiveVarieties (table)
- **File**: `src/schema.ts`
- **Usages**: 34
- **Columns**: 


Usage breakdown:
  - `src/routers/vendorVariety.ts:9` (schema): vendorAdditiveVarieties,
  - `src/routers/vendorVariety.ts:60` (schema): vendorVarietyId: vendorAdditiveVarieties.id,
  - `src/routers/vendorVariety.ts:61` (schema): notes: vendorAdditiveVarieties.notes,
  - `src/routers/vendorVariety.ts:62` (schema): linkedAt: vendorAdditiveVarieties.createdAt,
  - `src/routers/vendorVariety.ts:66` (import): .from(vendorAdditiveVarieties)
  - ... and 29 more

### juiceVarieties (table)
- **File**: `src/schema.ts`
- **Usages**: 57
- **Columns**: 


Usage breakdown:
  - `src/routers/vendorVariety.ts:12` (schema): juiceVarieties,
  - `src/routers/vendorVariety.ts:83` (schema): id: juiceVarieties.id,
  - `src/routers/vendorVariety.ts:84` (schema): name: juiceVarieties.name,
  - `src/routers/vendorVariety.ts:85` (schema): isActive: juiceVarieties.isActive,
  - `src/routers/vendorVariety.ts:93` (schema): juiceVarieties,
  - ... and 52 more

### vendorJuiceVarieties (table)
- **File**: `src/schema.ts`
- **Usages**: 32
- **Columns**: 


Usage breakdown:
  - `src/routers/vendorVariety.ts:11` (schema): vendorJuiceVarieties,
  - `src/routers/vendorVariety.ts:86` (schema): vendorVarietyId: vendorJuiceVarieties.id,
  - `src/routers/vendorVariety.ts:87` (schema): notes: vendorJuiceVarieties.notes,
  - `src/routers/vendorVariety.ts:88` (schema): linkedAt: vendorJuiceVarieties.createdAt,
  - `src/routers/vendorVariety.ts:91` (import): .from(vendorJuiceVarieties)
  - ... and 27 more

### packagingVarieties (table)
- **File**: `src/schema.ts`
- **Usages**: 60
- **Columns**: 


Usage breakdown:
  - `src/routers/vendorVariety.ts:14` (schema): packagingVarieties,
  - `src/routers/vendorVariety.ts:108` (schema): id: packagingVarieties.id,
  - `src/routers/vendorVariety.ts:109` (schema): name: packagingVarieties.name,
  - `src/routers/vendorVariety.ts:110` (schema): isActive: packagingVarieties.isActive,
  - `src/routers/vendorVariety.ts:115` (schema): category: packagingVarieties.itemType,
  - ... and 55 more

### vendorPackagingVarieties (table)
- **File**: `src/schema.ts`
- **Usages**: 32
- **Columns**: 


Usage breakdown:
  - `src/routers/vendorVariety.ts:13` (schema): vendorPackagingVarieties,
  - `src/routers/vendorVariety.ts:111` (schema): vendorVarietyId: vendorPackagingVarieties.id,
  - `src/routers/vendorVariety.ts:112` (schema): notes: vendorPackagingVarieties.notes,
  - `src/routers/vendorVariety.ts:113` (schema): linkedAt: vendorPackagingVarieties.createdAt,
  - `src/routers/vendorVariety.ts:117` (import): .from(vendorPackagingVarieties)
  - ... and 27 more

### basefruitPurchases (table)
- **File**: `src/schema.ts`
- **Usages**: 161
- **Columns**: 


Usage breakdown:
  - `src/routers/reports.ts:6` (schema): basefruitPurchases,
  - `src/routers/reports.ts:40` (schema): const purchase = await db.query.basefruitPurchases.findFirst({
  - `src/routers/reports.ts:41` (schema): where: eq(basefruitPurchases.id, input.purchaseId),
  - `src/routers/reports.ts:97` (schema): gte(basefruitPurchases.purchaseDate, input.startDate),
  - `src/routers/reports.ts:98` (schema): lte(basefruitPurchases.purchaseDate, input.endDate),
  - ... and 156 more

### basefruitPurchaseItems (table)
- **File**: `src/schema.ts`
- **Usages**: 141
- **Columns**: 


Usage breakdown:
  - `src/routers/reports.ts:7` (schema): basefruitPurchaseItems,
  - `src/routers/reports.ts:115` (schema): ? eq(basefruitPurchaseItems.fruitVarietyId, input.varietyId)
  - `src/routers/pressRun.ts:9` (schema): basefruitPurchaseItems,
  - `src/routers/pressRun.ts:222` (import): .from(basefruitPurchaseItems)
  - `src/routers/pressRun.ts:225` (schema): eq(basefruitPurchaseItems.id, input.purchaseItemId),
  - ... and 136 more

### additivePurchases (table)
- **File**: `src/schema.ts`
- **Usages**: 53
- **Columns**: 


Usage breakdown:
  - `src/routers/inventory.ts:14` (schema): additivePurchases,
  - `src/routers/inventory.ts:98` (schema): 'purchaseId', ${additivePurchases.id},
  - `src/routers/inventory.ts:111` (schema): 'purchaseDate', ${additivePurchases.purchaseDate}
  - `src/routers/inventory.ts:115` (schema): createdAt: additivePurchases.purchaseDate,
  - `src/routers/inventory.ts:116` (query): updatedAt: additivePurchases.updatedAt,
  - ... and 48 more

### additivePurchaseItems (table)
- **File**: `src/schema.ts`
- **Usages**: 31
- **Columns**: 


Usage breakdown:
  - `src/routers/inventory.ts:15` (schema): additivePurchaseItems,
  - `src/routers/inventory.ts:92` (schema): id: sql<string>`CONCAT('additive-', ${additivePurchaseItems.id})`,
  - `src/routers/inventory.ts:94` (schema): currentBottleCount: sql<number>`COALESCE(CAST(${additivePurchaseItems.quantity} AS NUMERIC), 0)`,
  - `src/routers/inventory.ts:100` (schema): 'varietyName', COALESCE(${additiveVarieties.name}, ${additivePurchaseItems.additiveType}),
  - `src/routers/inventory.ts:101` (schema): 'varietyType', COALESCE(${additiveVarieties.itemType}, ${additivePurchaseItems.additiveType}),
  - ... and 26 more

### juicePurchases (table)
- **File**: `src/schema.ts`
- **Usages**: 52
- **Columns**: 


Usage breakdown:
  - `src/routers/juicePurchases.ts:3` (import): import { db, juicePurchases, juicePurchaseItems, vendors } from "db";
  - `src/routers/juicePurchases.ts:21` (query): const conditions = [isNull(juicePurchases.deletedAt)];
  - `src/routers/juicePurchases.ts:23` (schema): conditions.push(eq(juicePurchases.vendorId, vendorId));
  - `src/routers/juicePurchases.ts:28` (schema): id: juicePurchases.id,
  - `src/routers/juicePurchases.ts:29` (schema): vendorId: juicePurchases.vendorId,
  - ... and 47 more

### juicePurchaseItems (table)
- **File**: `src/schema.ts`
- **Usages**: 26
- **Columns**: 


Usage breakdown:
  - `src/routers/juicePurchases.ts:3` (import): import { db, juicePurchases, juicePurchaseItems, vendors } from "db";
  - `src/routers/juicePurchases.ts:185` (query): .insert(juicePurchaseItems)
  - `src/routers/juicePurchases.ts:185` (query): .insert(juicePurchaseItems)
  - `src/routers/inventory.ts:18` (schema): juicePurchaseItems,
  - `src/routers/inventory.ts:133` (schema): id: sql<string>`CONCAT('juice-', ${juicePurchaseItems.id})`,
  - ... and 21 more

### packagingPurchases (table)
- **File**: `src/schema.ts`
- **Usages**: 52
- **Columns**: 


Usage breakdown:
  - `src/routers/packagingPurchases.ts:3` (import): import { db, packagingPurchases, packagingPurchaseItems, vendors } from "db";
  - `src/routers/packagingPurchases.ts:21` (query): const conditions = [isNull(packagingPurchases.deletedAt)];
  - `src/routers/packagingPurchases.ts:23` (schema): conditions.push(eq(packagingPurchases.vendorId, vendorId));
  - `src/routers/packagingPurchases.ts:28` (schema): id: packagingPurchases.id,
  - `src/routers/packagingPurchases.ts:29` (schema): vendorId: packagingPurchases.vendorId,
  - ... and 47 more

### packagingPurchaseItems (table)
- **File**: `src/schema.ts`
- **Usages**: 23
- **Columns**: 


Usage breakdown:
  - `src/routers/packagingPurchases.ts:3` (import): import { db, packagingPurchases, packagingPurchaseItems, vendors } from "db";
  - `src/routers/packagingPurchases.ts:186` (query): .insert(packagingPurchaseItems)
  - `src/routers/packagingPurchases.ts:186` (query): .insert(packagingPurchaseItems)
  - `src/routers/inventory.ts:20` (schema): packagingPurchaseItems,
  - `src/routers/inventory.ts:165` (schema): id: sql<string>`CONCAT('packaging-', ${packagingPurchaseItems.id})`,
  - ... and 18 more

### pressRuns (table)
- **File**: `src/schema.ts`
- **Usages**: 37
- **Columns**: 


Usage breakdown:
  - `src/routers/pressRun.ts:1656` (schema): pressRuns: enhancedPressRuns,
  - `src/routers/index.ts:38` (schema): pressRuns,
  - `src/routers/index.ts:1508` (schema): id: pressRuns.id,
  - `src/routers/index.ts:1509` (schema): runDate: pressRuns.runDate,
  - `src/routers/index.ts:1510` (schema): totalAppleProcessedKg: pressRuns.totalAppleProcessedKg,
  - ... and 32 more

### pressItems (table)
- **File**: `src/schema.ts`
- **Usages**: 15
- **Columns**: 


Usage breakdown:
  - `src/routers/index.ts:39` (schema): pressItems,
  - `src/routers/index.ts:1625` (query): .insert(pressItems)
  - `src/routers/index.ts:1751` (query): .update(pressItems)
  - `src/routers/index.ts:1760` (schema): eq(pressItems.id, item.pressItemId),
  - `src/routers/index.ts:1761` (schema): eq(pressItems.pressRunId, input.pressRunId),
  - ... and 10 more

### vessels (table)
- **File**: `src/schema.ts`
- **Usages**: 214
- **Columns**: 


Usage breakdown:
  - `src/services/inventory.ts:11` (schema): vessels,
  - `src/services/inventory.ts:327` (query): .select({ id: vessels.id, status: vessels.status })
  - `src/services/inventory.ts:327` (query): .select({ id: vessels.id, status: vessels.status })
  - `src/services/inventory.ts:328` (import): .from(vessels)
  - `src/services/inventory.ts:330` (query): and(eq(vessels.id, transaction.vesselId), isNull(vessels.deletedAt)),
  - ... and 209 more

### batches (table)
- **File**: `src/schema.ts`
- **Usages**: 291
- **Columns**: 


Usage breakdown:
  - `src/routers/pressRun.ts:14` (schema): batches,
  - `src/routers/pressRun.ts:757` (query): .insert(batches)
  - `src/routers/pressRun.ts:768` (schema): .returning({ id: batches.id });
  - `src/routers/pressRun.ts:847` (schema): // Complete press run and create batches - admin/operator only
  - `src/routers/pressRun.ts:884` (schema): // Check if batches already exist for this press run
  - ... and 286 more

### batchCompositions (table)
- **File**: `src/schema.ts`
- **Usages**: 48
- **Columns**: 


Usage breakdown:
  - `src/routers/pressRun.ts:15` (schema): batchCompositions,
  - `src/routers/pressRun.ts:752` (schema): batchCompositions: batchCompositionData,
  - `src/routers/pressRun.ts:798` (query): await tx.insert(batchCompositions).values({
  - `src/routers/pressRun.ts:1227` (schema): batchCompositions: batchCompositionData,
  - `src/routers/pressRun.ts:1310` (import): .from(batchCompositions)
  - ... and 43 more

### batchMeasurements (table)
- **File**: `src/schema.ts`
- **Usages**: 56
- **Columns**: 


Usage breakdown:
  - `src/routers/index.ts:42` (schema): batchMeasurements,
  - `src/routers/index.ts:2086` (query): .insert(batchMeasurements)
  - `src/routers/index.ts:2312` (import): .from(batchMeasurements)
  - `src/routers/index.ts:2315` (schema): eq(batchMeasurements.batchId, input.id),
  - `src/routers/index.ts:2316` (query): isNull(batchMeasurements.deletedAt),
  - ... and 51 more

### batchAdditives (table)
- **File**: `src/schema.ts`
- **Usages**: 26
- **Columns**: 


Usage breakdown:
  - `src/routers/batch.ts:12` (schema): batchAdditives,
  - `src/routers/batch.ts:453` (schema): id: batchAdditives.id,
  - `src/routers/batch.ts:454` (schema): additiveType: batchAdditives.additiveType,
  - `src/routers/batch.ts:455` (schema): additiveName: batchAdditives.additiveName,
  - `src/routers/batch.ts:456` (schema): amount: batchAdditives.amount,
  - ... and 21 more

### packages (table)
- **File**: `src/schema.ts`
- **Usages**: 14
- **Columns**: 


Usage breakdown:
  - `src/services/inventory.ts:6` (schema): packages,
  - `src/routers/inventory.ts:7` (schema): packages,
  - `src/routers/index.ts:44` (schema): packages,
  - `src/routers/index.ts:2785` (schema): totalVolumeL: sql<number>`sum(${packages.volumePackagedL}::decimal * ${inventory.currentBottleCount}::decimal / ${packages.bottleCount}::decimal)`,
  - `src/routers/index.ts:2785` (schema): totalVolumeL: sql<number>`sum(${packages.volumePackagedL}::decimal * ${inventory.currentBottleCount}::decimal / ${packages.bottleCount}::decimal)`,
  - ... and 9 more

### inventory (table)
- **File**: `src/schema.ts`
- **Usages**: 310
- **Columns**: 


Usage breakdown:
  - `src/services/inventory.ts:4` (schema): inventory,
  - `src/services/inventory.ts:38` (import): } from "../types/inventory";
  - `src/services/inventory.ts:87` (schema): * Handles all inventory-related business logic and operations
  - `src/services/inventory.ts:319` (import): message: "Cannot create inventory from cancelled press run",
  - `src/services/inventory.ts:370` (schema): * Check if inventory levels are sufficient for transaction
  - ... and 305 more

### inventoryTransactions (table)
- **File**: `src/schema.ts`
- **Usages**: 24
- **Columns**: 


Usage breakdown:
  - `src/services/inventory.ts:5` (schema): inventoryTransactions,
  - `src/services/inventory.ts:480` (query): .insert(inventoryTransactions)
  - `src/services/inventory.ts:559` (query): .insert(inventoryTransactions)
  - `src/services/inventory.ts:651` (query): .insert(inventoryTransactions)
  - `src/services/inventory.ts:784` (schema): inventoryId: inventoryTransactions.inventoryId,
  - ... and 19 more

### batchCosts (table)
- **File**: `src/schema.ts`
- **Usages**: 18
- **Columns**: 


Usage breakdown:
  - `src/routers/index.ts:3270` (schema): // TODO: Implement when batchCosts and cogsItems tables are created
  - `src/routers/index.ts:3291` (schema): batchId: batchCosts.batchId,
  - `src/routers/index.ts:3294` (schema): totalAppleCost: batchCosts.totalAppleCost,
  - `src/routers/index.ts:3295` (schema): laborCost: batchCosts.laborCost,
  - `src/routers/index.ts:3296` (schema): overheadCost: batchCosts.overheadCost,
  - ... and 13 more

### cogsItems (table)
- **File**: `src/schema.ts`
- **Usages**: 20
- **Columns**: 


Usage breakdown:
  - `src/routers/index.ts:3270` (schema): // TODO: Implement when batchCosts and cogsItems tables are created
  - `src/routers/index.ts:3311` (schema): const cogsItems = await db
  - `src/routers/index.ts:3313` (schema): batchId: cogsItems.batchId,
  - `src/routers/index.ts:3314` (schema): itemType: cogsItems.itemType,
  - `src/routers/index.ts:3315` (schema): description: cogsItems.description,
  - ... and 15 more

### applePressRuns (table)
- **File**: `src/schema.ts`
- **Usages**: 175
- **Columns**: 


Usage breakdown:
  - `src/services/inventory.ts:10` (schema): applePressRuns,
  - `src/services/inventory.ts:299` (query): .select({ id: applePressRuns.id, status: applePressRuns.status })
  - `src/services/inventory.ts:299` (query): .select({ id: applePressRuns.id, status: applePressRuns.status })
  - `src/services/inventory.ts:300` (import): .from(applePressRuns)
  - `src/services/inventory.ts:303` (schema): eq(applePressRuns.id, transaction.pressRunId),
  - ... and 170 more

### applePressRunLoads (table)
- **File**: `src/schema.ts`
- **Usages**: 138
- **Columns**: 


Usage breakdown:
  - `src/routers/pressRun.ts:6` (schema): applePressRunLoads,
  - `src/routers/pressRun.ts:258` (schema): maxSequence: sql<number>`COALESCE(MAX(${applePressRunLoads.loadSequence}), 0)`,
  - `src/routers/pressRun.ts:260` (import): .from(applePressRunLoads)
  - `src/routers/pressRun.ts:263` (schema): eq(applePressRunLoads.applePressRunId, input.pressRunId),
  - `src/routers/pressRun.ts:264` (query): isNull(applePressRunLoads.deletedAt),
  - ... and 133 more

### auditLog (table)
- **File**: `src/schema.ts`
- **Usages**: 43
- **Columns**: 


Usage breakdown:
  - `src/services/inventory.ts:9` (schema): auditLog,
  - `src/services/inventory.ts:72` (query): await db.insert(auditLog).values({
  - `src/services/inventory.ts:72` (query): await db.insert(auditLog).values({
  - `src/services/inventory.ts:72` (query): await db.insert(auditLog).values({
  - `src/routers/vendorVariety.ts:8` (schema): auditLog,
  - ... and 38 more

### batchTransfers (table)
- **File**: `src/schema.ts`
- **Usages**: 47
- **Columns**: 


Usage breakdown:
  - `src/routers/index.ts:43` (schema): batchTransfers,
  - `src/routers/index.ts:3016` (schema): // Record the transfer in batchTransfers table
  - `src/routers/index.ts:3018` (query): .insert(batchTransfers)
  - `src/routers/index.ts:3066` (query): let whereClause = and(isNull(batchTransfers.deletedAt));
  - `src/routers/index.ts:3072` (schema): eq(batchTransfers.sourceVesselId, input.vesselId),
  - ... and 42 more

### batchMergeHistory (table)
- **File**: `src/schema.ts`
- **Usages**: 26
- **Columns**: 


Usage breakdown:
  - `src/routers/batch.ts:16` (schema): batchMergeHistory,
  - `src/routers/batch.ts:902` (schema): id: batchMergeHistory.id,
  - `src/routers/batch.ts:903` (schema): mergedAt: batchMergeHistory.mergedAt,
  - `src/routers/batch.ts:904` (schema): volumeAddedL: batchMergeHistory.volumeAddedL,
  - `src/routers/batch.ts:905` (schema): targetVolumeBeforeL: batchMergeHistory.targetVolumeBeforeL,
  - ... and 21 more



