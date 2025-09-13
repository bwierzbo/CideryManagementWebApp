import { db } from '../../../packages/db/src/client';
import {
  vendors,
  purchases,
  purchaseItems,
  appleVarieties,
  pressRuns,
  pressItems,
  vessels,
  batches,
  batchIngredients,
  batchMeasurements,
  packages,
  inventory,
  inventoryTransactions,
  batchCosts,
  cogsItems,
  users
} from '../../../packages/db/src/schema';
import { eq, sql, count, isNull, isNotNull } from 'drizzle-orm';

/**
 * Individual relationship validation result
 */
export interface RelationshipValidation {
  relationshipType: string;
  parentEntity: string;
  childEntity: string;
  expectedReferenceCount: number;
  actualReferenceCount: number;
  orphanedRecords: number;
  missingReferences: string[];
  passed: boolean;
  severity: 'critical' | 'warning' | 'info';
  message: string;
}

/**
 * Workflow continuity validation result
 */
export interface WorkflowValidation {
  workflowType: string;
  startEntity: string;
  endEntity: string;
  completeChains: number;
  brokenChains: number;
  gapDescriptions: string[];
  continuityPercentage: number;
  passed: boolean;
  message: string;
}

/**
 * Entity relationship validation report
 */
export interface RelationshipValidationReport {
  timestamp: string;
  summary: {
    totalRelationships: number;
    passedRelationships: number;
    failedRelationships: number;
    orphanedRecords: number;
    criticalIssues: number;
    workflowContinuity: number; // percentage
  };
  relationshipValidations: RelationshipValidation[];
  workflowValidations: WorkflowValidation[];
  dataIntegrityScore: number;
  recommendations: string[];
}

/**
 * Entity relationship validator for cidery management workflow
 */
export class RelationshipValidator {
  private relationshipValidations: RelationshipValidation[] = [];
  private workflowValidations: WorkflowValidation[] = [];

  /**
   * Perform comprehensive entity relationship validation
   */
  async validateAllRelationships(): Promise<RelationshipValidationReport> {
    const startTime = new Date();

    // Reset validations
    this.relationshipValidations = [];
    this.workflowValidations = [];

    // Validate core entity relationships
    await this.validatePurchaseVendorRelationships();
    await this.validatePurchaseItemRelationships();
    await this.validatePressRunRelationships();
    await this.validateBatchRelationships();
    await this.validatePackagingRelationships();
    await this.validateInventoryRelationships();
    await this.validateCostingRelationships();

    // Validate business workflow continuity
    await this.validateVendorToPurchaseWorkflow();
    await this.validatePurchaseToPressingWorkflow();
    await this.validatePressingToFermentationWorkflow();
    await this.validateFermentationToPackagingWorkflow();
    await this.validatePackagingToInventoryWorkflow();
    await this.validateCompleteProductionWorkflow();

    const report = this.generateRelationshipReport(startTime);
    return report;
  }

  /**
   * Validate Purchase -> Vendor relationships
   */
  private async validatePurchaseVendorRelationships(): Promise<void> {
    // Check for purchases without valid vendors
    const orphanedPurchases = await db.select({
      purchaseId: purchases.id,
      vendorId: purchases.vendorId
    })
      .from(purchases)
      .leftJoin(vendors, eq(purchases.vendorId, vendors.id))
      .where(isNull(vendors.id));

    const totalPurchases = await db.select({ count: count() }).from(purchases);
    const orphanCount = orphanedPurchases.length;

    this.relationshipValidations.push({
      relationshipType: 'purchase_vendor',
      parentEntity: 'vendors',
      childEntity: 'purchases',
      expectedReferenceCount: totalPurchases[0].count,
      actualReferenceCount: totalPurchases[0].count - orphanCount,
      orphanedRecords: orphanCount,
      missingReferences: orphanedPurchases.map(p => `Purchase ${p.purchaseId} references invalid vendor ${p.vendorId}`),
      passed: orphanCount === 0,
      severity: orphanCount > 0 ? 'critical' : 'info',
      message: orphanCount === 0 ?
        'All purchases have valid vendor references' :
        `${orphanCount} purchases reference invalid vendors`
    });

    // Check for inactive vendors with recent purchases
    const inactiveVendorPurchases = await db.select({
      vendorName: vendors.name,
      purchaseCount: count()
    })
      .from(purchases)
      .innerJoin(vendors, eq(purchases.vendorId, vendors.id))
      .where(eq(vendors.isActive, false))
      .groupBy(vendors.id, vendors.name);

    if (inactiveVendorPurchases.length > 0) {
      this.relationshipValidations.push({
        relationshipType: 'inactive_vendor_purchases',
        parentEntity: 'vendors',
        childEntity: 'purchases',
        expectedReferenceCount: 0,
        actualReferenceCount: inactiveVendorPurchases.reduce((sum, v) => sum + v.purchaseCount, 0),
        orphanedRecords: 0,
        missingReferences: inactiveVendorPurchases.map(v => `Inactive vendor ${v.vendorName} has ${v.purchaseCount} purchases`),
        passed: false,
        severity: 'warning',
        message: `${inactiveVendorPurchases.length} inactive vendors have purchases`
      });
    }
  }

  /**
   * Validate PurchaseItem relationships
   */
  private async validatePurchaseItemRelationships(): Promise<void> {
    // Check purchase items without valid purchases
    const orphanedItems = await db.select({
      itemId: purchaseItems.id,
      purchaseId: purchaseItems.purchaseId
    })
      .from(purchaseItems)
      .leftJoin(purchases, eq(purchaseItems.purchaseId, purchases.id))
      .where(isNull(purchases.id));

    const totalItems = await db.select({ count: count() }).from(purchaseItems);
    const orphanItemCount = orphanedItems.length;

    this.relationshipValidations.push({
      relationshipType: 'purchaseitem_purchase',
      parentEntity: 'purchases',
      childEntity: 'purchase_items',
      expectedReferenceCount: totalItems[0].count,
      actualReferenceCount: totalItems[0].count - orphanItemCount,
      orphanedRecords: orphanItemCount,
      missingReferences: orphanedItems.map(i => `PurchaseItem ${i.itemId} references invalid purchase ${i.purchaseId}`),
      passed: orphanItemCount === 0,
      severity: orphanItemCount > 0 ? 'critical' : 'info',
      message: orphanItemCount === 0 ?
        'All purchase items have valid purchase references' :
        `${orphanItemCount} purchase items reference invalid purchases`
    });

    // Check purchase items without valid apple varieties
    const itemsWithInvalidVarieties = await db.select({
      itemId: purchaseItems.id,
      varietyId: purchaseItems.appleVarietyId
    })
      .from(purchaseItems)
      .leftJoin(appleVarieties, eq(purchaseItems.appleVarietyId, appleVarieties.id))
      .where(isNull(appleVarieties.id));

    const invalidVarietyCount = itemsWithInvalidVarieties.length;

    this.relationshipValidations.push({
      relationshipType: 'purchaseitem_variety',
      parentEntity: 'apple_varieties',
      childEntity: 'purchase_items',
      expectedReferenceCount: totalItems[0].count,
      actualReferenceCount: totalItems[0].count - invalidVarietyCount,
      orphanedRecords: invalidVarietyCount,
      missingReferences: itemsWithInvalidVarieties.map(i => `PurchaseItem ${i.itemId} references invalid variety ${i.varietyId}`),
      passed: invalidVarietyCount === 0,
      severity: invalidVarietyCount > 0 ? 'critical' : 'info',
      message: invalidVarietyCount === 0 ?
        'All purchase items have valid apple variety references' :
        `${invalidVarietyCount} purchase items reference invalid apple varieties`
    });
  }

  /**
   * Validate Press Run relationships
   */
  private async validatePressRunRelationships(): Promise<void> {
    // Check press items without valid press runs
    const orphanedPressItems = await db.select({
      itemId: pressItems.id,
      pressRunId: pressItems.pressRunId
    })
      .from(pressItems)
      .leftJoin(pressRuns, eq(pressItems.pressRunId, pressRuns.id))
      .where(isNull(pressRuns.id));

    const totalPressItems = await db.select({ count: count() }).from(pressItems);
    const orphanPressItemCount = orphanedPressItems.length;

    this.relationshipValidations.push({
      relationshipType: 'pressitem_pressrun',
      parentEntity: 'press_runs',
      childEntity: 'press_items',
      expectedReferenceCount: totalPressItems[0].count,
      actualReferenceCount: totalPressItems[0].count - orphanPressItemCount,
      orphanedRecords: orphanPressItemCount,
      missingReferences: orphanedPressItems.map(i => `PressItem ${i.itemId} references invalid press run ${i.pressRunId}`),
      passed: orphanPressItemCount === 0,
      severity: orphanPressItemCount > 0 ? 'critical' : 'info',
      message: orphanPressItemCount === 0 ?
        'All press items have valid press run references' :
        `${orphanPressItemCount} press items reference invalid press runs`
    });

    // Check press items without valid purchase items
    const pressItemsWithInvalidPurchases = await db.select({
      itemId: pressItems.id,
      purchaseItemId: pressItems.purchaseItemId
    })
      .from(pressItems)
      .leftJoin(purchaseItems, eq(pressItems.purchaseItemId, purchaseItems.id))
      .where(isNull(purchaseItems.id));

    const invalidPurchaseCount = pressItemsWithInvalidPurchases.length;

    this.relationshipValidations.push({
      relationshipType: 'pressitem_purchaseitem',
      parentEntity: 'purchase_items',
      childEntity: 'press_items',
      expectedReferenceCount: totalPressItems[0].count,
      actualReferenceCount: totalPressItems[0].count - invalidPurchaseCount,
      orphanedRecords: invalidPurchaseCount,
      missingReferences: pressItemsWithInvalidPurchases.map(i => `PressItem ${i.itemId} references invalid purchase item ${i.purchaseItemId}`),
      passed: invalidPurchaseCount === 0,
      severity: invalidPurchaseCount > 0 ? 'critical' : 'info',
      message: invalidPurchaseCount === 0 ?
        'All press items have valid purchase item references' :
        `${invalidPurchaseCount} press items reference invalid purchase items`
    });
  }

  /**
   * Validate Batch relationships
   */
  private async validateBatchRelationships(): Promise<void> {
    // Check batches with invalid vessel references (for active batches)
    const batchesWithInvalidVessels = await db.select({
      batchId: batches.id,
      vesselId: batches.vesselId
    })
      .from(batches)
      .leftJoin(vessels, eq(batches.vesselId, vessels.id))
      .where(sql`${batches.vesselId} IS NOT NULL AND ${vessels.id} IS NULL`);

    const invalidVesselCount = batchesWithInvalidVessels.length;

    this.relationshipValidations.push({
      relationshipType: 'batch_vessel',
      parentEntity: 'vessels',
      childEntity: 'batches',
      expectedReferenceCount: 0, // Should be no invalid references
      actualReferenceCount: invalidVesselCount,
      orphanedRecords: invalidVesselCount,
      missingReferences: batchesWithInvalidVessels.map(b => `Batch ${b.batchId} references invalid vessel ${b.vesselId}`),
      passed: invalidVesselCount === 0,
      severity: invalidVesselCount > 0 ? 'critical' : 'info',
      message: invalidVesselCount === 0 ?
        'All batches with vessels have valid vessel references' :
        `${invalidVesselCount} batches reference invalid vessels`
    });

    // Check batch ingredients without valid batches
    const orphanedIngredients = await db.select({
      ingredientId: batchIngredients.id,
      batchId: batchIngredients.batchId
    })
      .from(batchIngredients)
      .leftJoin(batches, eq(batchIngredients.batchId, batches.id))
      .where(isNull(batches.id));

    const orphanIngredientCount = orphanedIngredients.length;

    this.relationshipValidations.push({
      relationshipType: 'batchingredient_batch',
      parentEntity: 'batches',
      childEntity: 'batch_ingredients',
      expectedReferenceCount: await db.select({ count: count() }).from(batchIngredients).then(r => r[0].count),
      actualReferenceCount: await db.select({ count: count() }).from(batchIngredients).then(r => r[0].count) - orphanIngredientCount,
      orphanedRecords: orphanIngredientCount,
      missingReferences: orphanedIngredients.map(i => `BatchIngredient ${i.ingredientId} references invalid batch ${i.batchId}`),
      passed: orphanIngredientCount === 0,
      severity: orphanIngredientCount > 0 ? 'critical' : 'info',
      message: orphanIngredientCount === 0 ?
        'All batch ingredients have valid batch references' :
        `${orphanIngredientCount} batch ingredients reference invalid batches`
    });

    // Check batch measurements without valid batches
    const orphanedMeasurements = await db.select({
      measurementId: batchMeasurements.id,
      batchId: batchMeasurements.batchId
    })
      .from(batchMeasurements)
      .leftJoin(batches, eq(batchMeasurements.batchId, batches.id))
      .where(isNull(batches.id));

    const orphanMeasurementCount = orphanedMeasurements.length;

    this.relationshipValidations.push({
      relationshipType: 'batchmeasurement_batch',
      parentEntity: 'batches',
      childEntity: 'batch_measurements',
      expectedReferenceCount: await db.select({ count: count() }).from(batchMeasurements).then(r => r[0].count),
      actualReferenceCount: await db.select({ count: count() }).from(batchMeasurements).then(r => r[0].count) - orphanMeasurementCount,
      orphanedRecords: orphanMeasurementCount,
      missingReferences: orphanedMeasurements.map(m => `BatchMeasurement ${m.measurementId} references invalid batch ${m.batchId}`),
      passed: orphanMeasurementCount === 0,
      severity: orphanMeasurementCount > 0 ? 'critical' : 'info',
      message: orphanMeasurementCount === 0 ?
        'All batch measurements have valid batch references' :
        `${orphanMeasurementCount} batch measurements reference invalid batches`
    });
  }

  /**
   * Validate Packaging relationships
   */
  private async validatePackagingRelationships(): Promise<void> {
    // Check packages without valid batches
    const orphanedPackages = await db.select({
      packageId: packages.id,
      batchId: packages.batchId
    })
      .from(packages)
      .leftJoin(batches, eq(packages.batchId, batches.id))
      .where(isNull(batches.id));

    const orphanPackageCount = orphanedPackages.length;

    this.relationshipValidations.push({
      relationshipType: 'package_batch',
      parentEntity: 'batches',
      childEntity: 'packages',
      expectedReferenceCount: await db.select({ count: count() }).from(packages).then(r => r[0].count),
      actualReferenceCount: await db.select({ count: count() }).from(packages).then(r => r[0].count) - orphanPackageCount,
      orphanedRecords: orphanPackageCount,
      missingReferences: orphanedPackages.map(p => `Package ${p.packageId} references invalid batch ${p.batchId}`),
      passed: orphanPackageCount === 0,
      severity: orphanPackageCount > 0 ? 'critical' : 'info',
      message: orphanPackageCount === 0 ?
        'All packages have valid batch references' :
        `${orphanPackageCount} packages reference invalid batches`
    });
  }

  /**
   * Validate Inventory relationships
   */
  private async validateInventoryRelationships(): Promise<void> {
    // Check inventory without valid packages
    const orphanedInventory = await db.select({
      inventoryId: inventory.id,
      packageId: inventory.packageId
    })
      .from(inventory)
      .leftJoin(packages, eq(inventory.packageId, packages.id))
      .where(isNull(packages.id));

    const orphanInventoryCount = orphanedInventory.length;

    this.relationshipValidations.push({
      relationshipType: 'inventory_package',
      parentEntity: 'packages',
      childEntity: 'inventory',
      expectedReferenceCount: await db.select({ count: count() }).from(inventory).then(r => r[0].count),
      actualReferenceCount: await db.select({ count: count() }).from(inventory).then(r => r[0].count) - orphanInventoryCount,
      orphanedRecords: orphanInventoryCount,
      missingReferences: orphanedInventory.map(i => `Inventory ${i.inventoryId} references invalid package ${i.packageId}`),
      passed: orphanInventoryCount === 0,
      severity: orphanInventoryCount > 0 ? 'critical' : 'info',
      message: orphanInventoryCount === 0 ?
        'All inventory records have valid package references' :
        `${orphanInventoryCount} inventory records reference invalid packages`
    });

    // Check inventory transactions without valid inventory
    const orphanedTransactions = await db.select({
      transactionId: inventoryTransactions.id,
      inventoryId: inventoryTransactions.inventoryId
    })
      .from(inventoryTransactions)
      .leftJoin(inventory, eq(inventoryTransactions.inventoryId, inventory.id))
      .where(isNull(inventory.id));

    const orphanTransactionCount = orphanedTransactions.length;

    this.relationshipValidations.push({
      relationshipType: 'transaction_inventory',
      parentEntity: 'inventory',
      childEntity: 'inventory_transactions',
      expectedReferenceCount: await db.select({ count: count() }).from(inventoryTransactions).then(r => r[0].count),
      actualReferenceCount: await db.select({ count: count() }).from(inventoryTransactions).then(r => r[0].count) - orphanTransactionCount,
      orphanedRecords: orphanTransactionCount,
      missingReferences: orphanedTransactions.map(t => `Transaction ${t.transactionId} references invalid inventory ${t.inventoryId}`),
      passed: orphanTransactionCount === 0,
      severity: orphanTransactionCount > 0 ? 'critical' : 'info',
      message: orphanTransactionCount === 0 ?
        'All inventory transactions have valid inventory references' :
        `${orphanTransactionCount} inventory transactions reference invalid inventory records`
    });
  }

  /**
   * Validate Costing relationships
   */
  private async validateCostingRelationships(): Promise<void> {
    // Check batch costs without valid batches
    const orphanedBatchCosts = await db.select({
      costId: batchCosts.id,
      batchId: batchCosts.batchId
    })
      .from(batchCosts)
      .leftJoin(batches, eq(batchCosts.batchId, batches.id))
      .where(isNull(batches.id));

    const orphanBatchCostCount = orphanedBatchCosts.length;

    this.relationshipValidations.push({
      relationshipType: 'batchcost_batch',
      parentEntity: 'batches',
      childEntity: 'batch_costs',
      expectedReferenceCount: await db.select({ count: count() }).from(batchCosts).then(r => r[0].count),
      actualReferenceCount: await db.select({ count: count() }).from(batchCosts).then(r => r[0].count) - orphanBatchCostCount,
      orphanedRecords: orphanBatchCostCount,
      missingReferences: orphanedBatchCosts.map(c => `BatchCost ${c.costId} references invalid batch ${c.batchId}`),
      passed: orphanBatchCostCount === 0,
      severity: orphanBatchCostCount > 0 ? 'critical' : 'info',
      message: orphanBatchCostCount === 0 ?
        'All batch costs have valid batch references' :
        `${orphanBatchCostCount} batch costs reference invalid batches`
    });

    // Check COGS items without valid batches
    const orphanedCogsItems = await db.select({
      cogsId: cogsItems.id,
      batchId: cogsItems.batchId
    })
      .from(cogsItems)
      .leftJoin(batches, eq(cogsItems.batchId, batches.id))
      .where(isNull(batches.id));

    const orphanCogsCount = orphanedCogsItems.length;

    this.relationshipValidations.push({
      relationshipType: 'cogsitem_batch',
      parentEntity: 'batches',
      childEntity: 'cogs_items',
      expectedReferenceCount: await db.select({ count: count() }).from(cogsItems).then(r => r[0].count),
      actualReferenceCount: await db.select({ count: count() }).from(cogsItems).then(r => r[0].count) - orphanCogsCount,
      orphanedRecords: orphanCogsCount,
      missingReferences: orphanedCogsItems.map(c => `CogsItem ${c.cogsId} references invalid batch ${c.batchId}`),
      passed: orphanCogsCount === 0,
      severity: orphanCogsCount > 0 ? 'critical' : 'info',
      message: orphanCogsCount === 0 ?
        'All COGS items have valid batch references' :
        `${orphanCogsCount} COGS items reference invalid batches`
    });
  }

  /**
   * Validate Vendor -> Purchase workflow continuity
   */
  private async validateVendorToPurchaseWorkflow(): Promise<void> {
    const vendorCount = await db.select({ count: count() }).from(vendors);
    const purchaseCount = await db.select({ count: count() }).from(purchases);

    // Check vendors with purchases
    const vendorsWithPurchases = await db.select({
      vendorId: vendors.id,
      vendorName: vendors.name,
      purchaseCount: count()
    })
      .from(vendors)
      .leftJoin(purchases, eq(vendors.id, purchases.vendorId))
      .groupBy(vendors.id, vendors.name);

    const vendorsWithoutPurchases = vendorsWithPurchases.filter(v => v.purchaseCount === 0);
    const continuityPercentage = ((vendorCount[0].count - vendorsWithoutPurchases.length) / vendorCount[0].count) * 100;

    this.workflowValidations.push({
      workflowType: 'vendor_purchase',
      startEntity: 'vendors',
      endEntity: 'purchases',
      completeChains: vendorCount[0].count - vendorsWithoutPurchases.length,
      brokenChains: vendorsWithoutPurchases.length,
      gapDescriptions: vendorsWithoutPurchases.map(v => `Vendor "${v.vendorName}" has no purchases`),
      continuityPercentage,
      passed: continuityPercentage >= 60, // At least 60% of vendors should have purchases
      message: `${continuityPercentage.toFixed(1)}% of vendors have purchases`
    });
  }

  /**
   * Validate Purchase -> Pressing workflow continuity
   */
  private async validatePurchaseToPressingWorkflow(): Promise<void> {
    // Check purchase items that have been pressed
    const purchaseItemsPressed = await db.select({
      purchaseItemId: purchaseItems.id,
      pressed: count()
    })
      .from(purchaseItems)
      .leftJoin(pressItems, eq(purchaseItems.id, pressItems.purchaseItemId))
      .groupBy(purchaseItems.id);

    const totalPurchaseItems = purchaseItemsPressed.length;
    const pressedItems = purchaseItemsPressed.filter(p => p.pressed > 0).length;
    const continuityPercentage = totalPurchaseItems > 0 ? (pressedItems / totalPurchaseItems) * 100 : 0;

    this.workflowValidations.push({
      workflowType: 'purchase_pressing',
      startEntity: 'purchase_items',
      endEntity: 'press_items',
      completeChains: pressedItems,
      brokenChains: totalPurchaseItems - pressedItems,
      gapDescriptions: [`${totalPurchaseItems - pressedItems} purchase items not yet pressed`],
      continuityPercentage,
      passed: continuityPercentage >= 40, // Some items may still be in storage
      message: `${continuityPercentage.toFixed(1)}% of purchased items have been pressed`
    });
  }

  /**
   * Validate Pressing -> Fermentation workflow continuity
   */
  private async validatePressingToFermentationWorkflow(): Promise<void> {
    // Check press items that have been used in batches
    const pressItemsInBatches = await db.select({
      pressItemId: pressItems.id,
      batchCount: count()
    })
      .from(pressItems)
      .leftJoin(batchIngredients, eq(pressItems.id, batchIngredients.pressItemId))
      .groupBy(pressItems.id);

    const totalPressItems = pressItemsInBatches.length;
    const itemsInBatches = pressItemsInBatches.filter(p => p.batchCount > 0).length;
    const continuityPercentage = totalPressItems > 0 ? (itemsInBatches / totalPressItems) * 100 : 0;

    this.workflowValidations.push({
      workflowType: 'pressing_fermentation',
      startEntity: 'press_items',
      endEntity: 'batch_ingredients',
      completeChains: itemsInBatches,
      brokenChains: totalPressItems - itemsInBatches,
      gapDescriptions: [`${totalPressItems - itemsInBatches} pressed juice lots not yet used in batches`],
      continuityPercentage,
      passed: continuityPercentage >= 50, // Some juice may be in storage or blending
      message: `${continuityPercentage.toFixed(1)}% of pressed juice has been used in fermentation batches`
    });
  }

  /**
   * Validate Fermentation -> Packaging workflow continuity
   */
  private async validateFermentationToPackagingWorkflow(): Promise<void> {
    const batchesToPackages = await db.select({
      batchId: batches.id,
      batchNumber: batches.batchNumber,
      status: batches.status,
      packageCount: count()
    })
      .from(batches)
      .leftJoin(packages, eq(batches.id, packages.batchId))
      .groupBy(batches.id, batches.batchNumber, batches.status);

    const totalBatches = batchesToPackages.length;
    const completedBatches = batchesToPackages.filter(b => b.status === 'completed').length;
    const packagedBatches = batchesToPackages.filter(b => b.packageCount > 0).length;
    const continuityPercentage = completedBatches > 0 ? (packagedBatches / completedBatches) * 100 : 0;

    const gaps: string[] = [];
    batchesToPackages.forEach(b => {
      if (b.status === 'completed' && b.packageCount === 0) {
        gaps.push(`Completed batch "${b.batchNumber}" not packaged`);
      }
    });

    this.workflowValidations.push({
      workflowType: 'fermentation_packaging',
      startEntity: 'batches',
      endEntity: 'packages',
      completeChains: packagedBatches,
      brokenChains: completedBatches - packagedBatches,
      gapDescriptions: gaps,
      continuityPercentage,
      passed: continuityPercentage >= 80, // Most completed batches should be packaged
      message: `${continuityPercentage.toFixed(1)}% of completed batches have been packaged`
    });
  }

  /**
   * Validate Packaging -> Inventory workflow continuity
   */
  private async validatePackagingToInventoryWorkflow(): Promise<void> {
    const packagesToInventory = await db.select({
      packageId: packages.id,
      inventoryCount: count()
    })
      .from(packages)
      .leftJoin(inventory, eq(packages.id, inventory.packageId))
      .groupBy(packages.id);

    const totalPackages = packagesToInventory.length;
    const packagesWithInventory = packagesToInventory.filter(p => p.inventoryCount > 0).length;
    const continuityPercentage = totalPackages > 0 ? (packagesWithInventory / totalPackages) * 100 : 0;

    this.workflowValidations.push({
      workflowType: 'packaging_inventory',
      startEntity: 'packages',
      endEntity: 'inventory',
      completeChains: packagesWithInventory,
      brokenChains: totalPackages - packagesWithInventory,
      gapDescriptions: [`${totalPackages - packagesWithInventory} packages not tracked in inventory`],
      continuityPercentage,
      passed: continuityPercentage >= 90, // Nearly all packages should have inventory records
      message: `${continuityPercentage.toFixed(1)}% of packages are tracked in inventory`
    });
  }

  /**
   * Validate complete production workflow (vendor to inventory)
   */
  private async validateCompleteProductionWorkflow(): Promise<void> {
    // Find vendors that have complete workflow chains to inventory
    const completeChains = await db.select({
      vendorId: vendors.id,
      vendorName: vendors.name,
      inventoryItems: count()
    })
      .from(vendors)
      .innerJoin(purchases, eq(vendors.id, purchases.vendorId))
      .innerJoin(purchaseItems, eq(purchases.id, purchaseItems.purchaseId))
      .innerJoin(pressItems, eq(purchaseItems.id, pressItems.purchaseItemId))
      .innerJoin(batchIngredients, eq(pressItems.id, batchIngredients.pressItemId))
      .innerJoin(packages, eq(batchIngredients.batchId, packages.batchId))
      .innerJoin(inventory, eq(packages.id, inventory.packageId))
      .groupBy(vendors.id, vendors.name);

    const vendorCount = await db.select({ count: count() }).from(vendors);
    const completeChainCount = completeChains.length;
    const continuityPercentage = vendorCount[0].count > 0 ? (completeChainCount / vendorCount[0].count) * 100 : 0;

    this.workflowValidations.push({
      workflowType: 'complete_production',
      startEntity: 'vendors',
      endEntity: 'inventory',
      completeChains: completeChainCount,
      brokenChains: vendorCount[0].count - completeChainCount,
      gapDescriptions: [`${vendorCount[0].count - completeChainCount} vendors without complete production chains to inventory`],
      continuityPercentage,
      passed: continuityPercentage >= 30, // At least 30% should have complete chains in demo
      message: `${continuityPercentage.toFixed(1)}% of vendors have complete production chains to inventory`
    });
  }

  /**
   * Generate comprehensive relationship validation report
   */
  private generateRelationshipReport(startTime: Date): RelationshipValidationReport {
    const totalRelationships = this.relationshipValidations.length;
    const passedRelationships = this.relationshipValidations.filter(r => r.passed).length;
    const failedRelationships = totalRelationships - passedRelationships;
    const orphanedRecords = this.relationshipValidations.reduce((sum, r) => sum + r.orphanedRecords, 0);
    const criticalIssues = this.relationshipValidations.filter(r => !r.passed && r.severity === 'critical').length;

    const workflowContinuity = this.workflowValidations.reduce((sum, w) => sum + w.continuityPercentage, 0) /
                              (this.workflowValidations.length || 1);

    const dataIntegrityScore = totalRelationships > 0 ? (passedRelationships / totalRelationships) * 100 : 0;

    return {
      timestamp: startTime.toISOString(),
      summary: {
        totalRelationships,
        passedRelationships,
        failedRelationships,
        orphanedRecords,
        criticalIssues,
        workflowContinuity
      },
      relationshipValidations: this.relationshipValidations,
      workflowValidations: this.workflowValidations,
      dataIntegrityScore,
      recommendations: this.generateRelationshipRecommendations()
    };
  }

  /**
   * Generate recommendations based on relationship validation results
   */
  private generateRelationshipRecommendations(): string[] {
    const recommendations: string[] = [];

    const criticalIssues = this.relationshipValidations.filter(r => !r.passed && r.severity === 'critical');
    const orphanedRecords = this.relationshipValidations.reduce((sum, r) => sum + r.orphanedRecords, 0);

    if (criticalIssues.length > 0) {
      recommendations.push(`Fix ${criticalIssues.length} critical referential integrity issues immediately`);
    }

    if (orphanedRecords > 0) {
      recommendations.push(`Clean up ${orphanedRecords} orphaned records to maintain data integrity`);
    }

    const brokenWorkflows = this.workflowValidations.filter(w => !w.passed);
    if (brokenWorkflows.length > 0) {
      recommendations.push(`Address workflow continuity issues in ${brokenWorkflows.length} business processes`);
    }

    const lowContinuityWorkflows = this.workflowValidations.filter(w => w.continuityPercentage < 50);
    if (lowContinuityWorkflows.length > 0) {
      recommendations.push('Add more demo data to demonstrate complete production workflows');
    }

    // Specific workflow recommendations
    const completeWorkflow = this.workflowValidations.find(w => w.workflowType === 'complete_production');
    if (completeWorkflow && completeWorkflow.continuityPercentage < 20) {
      recommendations.push('Create more end-to-end workflow examples from vendor to inventory');
    }

    if (recommendations.length === 0) {
      recommendations.push('Entity relationships and workflow continuity are in good shape');
    }

    return recommendations;
  }

  /**
   * Export relationship validation results
   */
  async exportResults(report: RelationshipValidationReport, filePath: string): Promise<void> {
    const fs = require('fs');
    const path = require('path');

    const dir = path.dirname(filePath);
    if (!fs.existsSync(dir)) {
      fs.mkdirSync(dir, { recursive: true });
    }

    fs.writeFileSync(filePath, JSON.stringify(report, null, 2));
    console.log(`Relationship validation results exported to: ${filePath}`);
  }
}