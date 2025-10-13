import { db } from './packages/db/src/client';
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
} from './packages/db/src/schema';
import { sql, count, sum, avg, max, min } from 'drizzle-orm';

/**
 * Seeded data entity information
 */
export interface SeededEntityInfo {
  entityType: string;
  tableName: string;
  recordCount: number;
  sampleRecords: any[];
  keyFields: string[];
  dataQuality: {
    nullFieldPercentage: number;
    duplicateRecords: number;
    referencialIntegrityIssues: number;
  };
  createdDateRange: {
    earliest: Date | null;
    latest: Date | null;
    span: number; // days
  };
  estimatedUIPages: string[];
}

/**
 * Complete seeded data inventory
 */
export interface SeededDataInventory {
  timestamp: string;
  totalEntities: number;
  totalRecords: number;
  entities: SeededEntityInfo[];
  dataRelationships: DataRelationshipMap;
  businessWorkflowCoverage: WorkflowCoverage;
  recommendations: string[];
}

/**
 * Data relationship mapping between entities
 */
export interface DataRelationshipMap {
  [entityType: string]: {
    parentEntities: string[];
    childEntities: string[];
    recordCounts: { [relatedEntity: string]: number };
  };
}

/**
 * Business workflow coverage analysis
 */
export interface WorkflowCoverage {
  vendorToPurchase: boolean;
  purchaseToPressing: boolean;
  pressingToFermentation: boolean;
  fermentationToPackaging: boolean;
  packagingToInventory: boolean;
  completeWorkflowExamples: number;
  partialWorkflowGaps: string[];
}

/**
 * Seeded data discovery service for comprehensive demo data analysis
 */
export class SeededDataDiscovery {
  /**
   * Discover and analyze all seeded data in the database
   */
  async discoverAllSeededData(): Promise<SeededDataInventory> {
    const startTime = new Date();

    // Discover all entities
    const entities: SeededEntityInfo[] = await Promise.all([
      this.discoverVendors(),
      this.discoverAppleVarieties(),
      this.discoverPurchases(),
      this.discoverPurchaseItems(),
      this.discoverPressRuns(),
      this.discoverPressItems(),
      this.discoverVessels(),
      this.discoverBatches(),
      this.discoverBatchIngredients(),
      this.discoverBatchMeasurements(),
      this.discoverPackages(),
      this.discoverInventory(),
      this.discoverInventoryTransactions(),
      this.discoverBatchCosts(),
      this.discoverCogsItems(),
      this.discoverUsers()
    ]);

    // Analyze relationships between entities
    const dataRelationships = await this.analyzeDataRelationships();

    // Analyze business workflow coverage
    const businessWorkflowCoverage = await this.analyzeWorkflowCoverage();

    const totalRecords = entities.reduce((sum, entity) => sum + entity.recordCount, 0);

    const inventory: SeededDataInventory = {
      timestamp: startTime.toISOString(),
      totalEntities: entities.length,
      totalRecords,
      entities,
      dataRelationships,
      businessWorkflowCoverage,
      recommendations: this.generateDiscoveryRecommendations(entities, businessWorkflowCoverage)
    };

    return inventory;
  }

  /**
   * Discover vendor data
   */
  private async discoverVendors(): Promise<SeededEntityInfo> {
    const allVendors = await db.select().from(vendors).limit(100);
    const vendorCount = await db.select({ count: count() }).from(vendors);

    // Analyze data quality
    const nullContacts = allVendors.filter(v => !v.contactInfo).length;
    const activeVendors = allVendors.filter(v => v.isActive).length;

    return {
      entityType: 'vendors',
      tableName: 'vendors',
      recordCount: vendorCount[0].count,
      sampleRecords: allVendors.slice(0, 5),
      keyFields: ['name', 'contactInfo', 'isActive'],
      dataQuality: {
        nullFieldPercentage: (nullContacts / allVendors.length) * 100,
        duplicateRecords: 0, // Would need duplicate detection logic
        referencialIntegrityIssues: 0
      },
      createdDateRange: {
        earliest: null, // vendors table doesn't have createdAt in current schema
        latest: null,
        span: 0
      },
      estimatedUIPages: ['/vendors', '/purchases/new', '/admin/vendors']
    };
  }

  /**
   * Discover apple varieties data
   */
  private async discoverAppleVarieties(): Promise<SeededEntityInfo> {
    const allVarieties = await db.select().from(appleVarieties).limit(100);
    const varietyCount = await db.select({ count: count() }).from(appleVarieties);

    return {
      entityType: 'apple_varieties',
      tableName: 'apple_varieties',
      recordCount: varietyCount[0].count,
      sampleRecords: allVarieties.slice(0, 5),
      keyFields: ['name', 'description', 'typicalBrix'],
      dataQuality: {
        nullFieldPercentage: 0, // All varieties should have names
        duplicateRecords: 0,
        referencialIntegrityIssues: 0
      },
      createdDateRange: {
        earliest: null,
        latest: null,
        span: 0
      },
      estimatedUIPages: ['/varieties', '/purchases/new', '/press-runs/new']
    };
  }

  /**
   * Discover purchase data
   */
  private async discoverPurchases(): Promise<SeededEntityInfo> {
    const allPurchases = await db.select().from(purchases).limit(100);
    const purchaseCount = await db.select({ count: count() }).from(purchases);

    // Get date range
    const dateRange = await db.select({
      earliest: min(purchases.purchaseDate),
      latest: max(purchases.purchaseDate)
    }).from(purchases);

    const earliest = dateRange[0].earliest;
    const latest = dateRange[0].latest;
    const span = earliest && latest ?
      Math.ceil((latest.getTime() - earliest.getTime()) / (1000 * 60 * 60 * 24)) : 0;

    // Check for referential integrity with vendors
    const purchasesWithInvalidVendors = await db.select({ count: count() })
      .from(purchases)
      .leftJoin(vendors, sql`${purchases.vendorId} = ${vendors.id}`)
      .where(sql`${vendors.id} IS NULL`);

    return {
      entityType: 'purchases',
      tableName: 'purchases',
      recordCount: purchaseCount[0].count,
      sampleRecords: allPurchases.slice(0, 5),
      keyFields: ['vendorId', 'purchaseDate', 'totalCost', 'invoiceNumber'],
      dataQuality: {
        nullFieldPercentage: 0,
        duplicateRecords: 0,
        referencialIntegrityIssues: purchasesWithInvalidVendors[0].count
      },
      createdDateRange: {
        earliest,
        latest,
        span
      },
      estimatedUIPages: ['/purchases', '/dashboard', '/reports/purchases']
    };
  }

  /**
   * Discover purchase items data
   */
  private async discoverPurchaseItems(): Promise<SeededEntityInfo> {
    const allItems = await db.select().from(purchaseItems).limit(100);
    const itemCount = await db.select({ count: count() }).from(purchaseItems);

    // Check referential integrity
    const itemsWithInvalidPurchases = await db.select({ count: count() })
      .from(purchaseItems)
      .leftJoin(purchases, sql`${purchaseItems.purchaseId} = ${purchases.id}`)
      .where(sql`${purchases.id} IS NULL`);

    const itemsWithInvalidVarieties = await db.select({ count: count() })
      .from(purchaseItems)
      .leftJoin(appleVarieties, sql`${purchaseItems.appleVarietyId} = ${appleVarieties.id}`)
      .where(sql`${appleVarieties.id} IS NULL`);

    return {
      entityType: 'purchase_items',
      tableName: 'purchase_items',
      recordCount: itemCount[0].count,
      sampleRecords: allItems.slice(0, 5),
      keyFields: ['purchaseId', 'appleVarietyId', 'quantity', 'pricePerUnit', 'totalCost'],
      dataQuality: {
        nullFieldPercentage: 0,
        duplicateRecords: 0,
        referencialIntegrityIssues: itemsWithInvalidPurchases[0].count + itemsWithInvalidVarieties[0].count
      },
      createdDateRange: {
        earliest: null,
        latest: null,
        span: 0
      },
      estimatedUIPages: ['/purchases', '/purchases/[id]', '/reports/purchase-details']
    };
  }

  /**
   * Discover press runs data
   */
  private async discoverPressRuns(): Promise<SeededEntityInfo> {
    const allRuns = await db.select().from(pressRuns).limit(100);
    const runCount = await db.select({ count: count() }).from(pressRuns);

    const dateRange = await db.select({
      earliest: min(pressRuns.runDate),
      latest: max(pressRuns.runDate)
    }).from(pressRuns);

    const earliest = dateRange[0].earliest;
    const latest = dateRange[0].latest;
    const span = earliest && latest ?
      Math.ceil((latest.getTime() - earliest.getTime()) / (1000 * 60 * 60 * 24)) : 0;

    return {
      entityType: 'press_runs',
      tableName: 'press_runs',
      recordCount: runCount[0].count,
      sampleRecords: allRuns.slice(0, 5),
      keyFields: ['runDate', 'totalAppleProcessedKg', 'totalJuiceProducedL', 'extractionRate'],
      dataQuality: {
        nullFieldPercentage: 0,
        duplicateRecords: 0,
        referencialIntegrityIssues: 0
      },
      createdDateRange: {
        earliest,
        latest,
        span
      },
      estimatedUIPages: ['/press-runs', '/dashboard', '/reports/pressing']
    };
  }

  /**
   * Discover press items data
   */
  private async discoverPressItems(): Promise<SeededEntityInfo> {
    const allItems = await db.select().from(pressItems).limit(100);
    const itemCount = await db.select({ count: count() }).from(pressItems);

    return {
      entityType: 'press_items',
      tableName: 'press_items',
      recordCount: itemCount[0].count,
      sampleRecords: allItems.slice(0, 5),
      keyFields: ['pressRunId', 'purchaseItemId', 'quantityUsedKg', 'juiceProducedL', 'brixMeasured'],
      dataQuality: {
        nullFieldPercentage: 0,
        duplicateRecords: 0,
        referencialIntegrityIssues: 0
      },
      createdDateRange: {
        earliest: null,
        latest: null,
        span: 0
      },
      estimatedUIPages: ['/press-runs', '/press-runs/[id]', '/juice-lots']
    };
  }

  /**
   * Discover vessels data
   */
  private async discoverVessels(): Promise<SeededEntityInfo> {
    const allVessels = await db.select().from(vessels).limit(100);
    const vesselCount = await db.select({ count: count() }).from(vessels);

    return {
      entityType: 'vessels',
      tableName: 'vessels',
      recordCount: vesselCount[0].count,
      sampleRecords: allVessels.slice(0, 5),
      keyFields: ['name', 'type', 'capacityL', 'status', 'location'],
      dataQuality: {
        nullFieldPercentage: 0,
        duplicateRecords: 0,
        referencialIntegrityIssues: 0
      },
      createdDateRange: {
        earliest: null,
        latest: null,
        span: 0
      },
      estimatedUIPages: ['/vessels', '/batches/new', '/dashboard']
    };
  }

  /**
   * Discover batches data
   */
  private async discoverBatches(): Promise<SeededEntityInfo> {
    const allBatches = await db.select().from(batches).limit(100);
    const batchCount = await db.select({ count: count() }).from(batches);

    const dateRange = await db.select({
      earliest: min(batches.startDate),
      latest: max(batches.startDate)
    }).from(batches);

    const earliest = dateRange[0].earliest;
    const latest = dateRange[0].latest;
    const span = earliest && latest ?
      Math.ceil((latest.getTime() - earliest.getTime()) / (1000 * 60 * 60 * 24)) : 0;

    return {
      entityType: 'batches',
      tableName: 'batches',
      recordCount: batchCount[0].count,
      sampleRecords: allBatches.slice(0, 5),
      keyFields: ['batchNumber', 'status', 'vesselId', 'startDate', 'targetAbv', 'actualAbv'],
      dataQuality: {
        nullFieldPercentage: 0,
        duplicateRecords: 0,
        referencialIntegrityIssues: 0
      },
      createdDateRange: {
        earliest,
        latest,
        span
      },
      estimatedUIPages: ['/batches', '/dashboard', '/fermentation']
    };
  }

  /**
   * Discover batch ingredients data
   */
  private async discoverBatchIngredients(): Promise<SeededEntityInfo> {
    const allIngredients = await db.select().from(batchIngredients).limit(100);
    const ingredientCount = await db.select({ count: count() }).from(batchIngredients);

    return {
      entityType: 'batch_ingredients',
      tableName: 'batch_ingredients',
      recordCount: ingredientCount[0].count,
      sampleRecords: allIngredients.slice(0, 5),
      keyFields: ['batchId', 'pressItemId', 'volumeUsedL', 'brixAtUse'],
      dataQuality: {
        nullFieldPercentage: 0,
        duplicateRecords: 0,
        referencialIntegrityIssues: 0
      },
      createdDateRange: {
        earliest: null,
        latest: null,
        span: 0
      },
      estimatedUIPages: ['/batches/[id]', '/batch-details', '/juice-usage']
    };
  }

  /**
   * Discover batch measurements data
   */
  private async discoverBatchMeasurements(): Promise<SeededEntityInfo> {
    const allMeasurements = await db.select().from(batchMeasurements).limit(100);
    const measurementCount = await db.select({ count: count() }).from(batchMeasurements);

    const dateRange = await db.select({
      earliest: min(batchMeasurements.measurementDate),
      latest: max(batchMeasurements.measurementDate)
    }).from(batchMeasurements);

    const earliest = dateRange[0].earliest;
    const latest = dateRange[0].latest;
    const span = earliest && latest ?
      Math.ceil((latest.getTime() - earliest.getTime()) / (1000 * 60 * 60 * 24)) : 0;

    return {
      entityType: 'batch_measurements',
      tableName: 'batch_measurements',
      recordCount: measurementCount[0].count,
      sampleRecords: allMeasurements.slice(0, 5),
      keyFields: ['batchId', 'measurementDate', 'specificGravity', 'abv', 'ph', 'temperature'],
      dataQuality: {
        nullFieldPercentage: 0,
        duplicateRecords: 0,
        referencialIntegrityIssues: 0
      },
      createdDateRange: {
        earliest,
        latest,
        span
      },
      estimatedUIPages: ['/batches/[id]', '/measurements', '/fermentation-tracking']
    };
  }

  /**
   * Discover packages data
   */
  private async discoverPackages(): Promise<SeededEntityInfo> {
    const allPackages = await db.select().from(packages).limit(100);
    const packageCount = await db.select({ count: count() }).from(packages);

    const dateRange = await db.select({
      earliest: min(packages.packageDate),
      latest: max(packages.packageDate)
    }).from(packages);

    const earliest = dateRange[0].earliest;
    const latest = dateRange[0].latest;
    const span = earliest && latest ?
      Math.ceil((latest.getTime() - earliest.getTime()) / (1000 * 60 * 60 * 24)) : 0;

    return {
      entityType: 'packages',
      tableName: 'packages',
      recordCount: packageCount[0].count,
      sampleRecords: allPackages.slice(0, 5),
      keyFields: ['batchId', 'packageDate', 'volumePackagedL', 'bottleSize', 'bottleCount'],
      dataQuality: {
        nullFieldPercentage: 0,
        duplicateRecords: 0,
        referencialIntegrityIssues: 0
      },
      createdDateRange: {
        earliest,
        latest,
        span
      },
      estimatedUIPages: ['/bottles', '/batches/[id]', '/production-runs']
    };
  }

  /**
   * Discover inventory data
   */
  private async discoverInventory(): Promise<SeededEntityInfo> {
    const allInventory = await db.select().from(inventory).limit(100);
    const inventoryCount = await db.select({ count: count() }).from(inventory);

    return {
      entityType: 'inventory',
      tableName: 'inventory',
      recordCount: inventoryCount[0].count,
      sampleRecords: allInventory.slice(0, 5),
      keyFields: ['packageId', 'currentBottleCount', 'reservedBottleCount', 'location'],
      dataQuality: {
        nullFieldPercentage: 0,
        duplicateRecords: 0,
        referencialIntegrityIssues: 0
      },
      createdDateRange: {
        earliest: null,
        latest: null,
        span: 0
      },
      estimatedUIPages: ['/inventory', '/warehouse', '/stock-levels']
    };
  }

  /**
   * Discover inventory transactions data
   */
  private async discoverInventoryTransactions(): Promise<SeededEntityInfo> {
    const allTransactions = await db.select().from(inventoryTransactions).limit(100);
    const transactionCount = await db.select({ count: count() }).from(inventoryTransactions);

    const dateRange = await db.select({
      earliest: min(inventoryTransactions.transactionDate),
      latest: max(inventoryTransactions.transactionDate)
    }).from(inventoryTransactions);

    const earliest = dateRange[0].earliest;
    const latest = dateRange[0].latest;
    const span = earliest && latest ?
      Math.ceil((latest.getTime() - earliest.getTime()) / (1000 * 60 * 60 * 24)) : 0;

    return {
      entityType: 'inventory_transactions',
      tableName: 'inventory_transactions',
      recordCount: transactionCount[0].count,
      sampleRecords: allTransactions.slice(0, 5),
      keyFields: ['inventoryId', 'transactionType', 'quantityChange', 'transactionDate', 'reason'],
      dataQuality: {
        nullFieldPercentage: 0,
        duplicateRecords: 0,
        referencialIntegrityIssues: 0
      },
      createdDateRange: {
        earliest,
        latest,
        span
      },
      estimatedUIPages: ['/inventory/[id]', '/transactions', '/inventory-history']
    };
  }

  /**
   * Discover batch costs data
   */
  private async discoverBatchCosts(): Promise<SeededEntityInfo> {
    const allCosts = await db.select().from(batchCosts).limit(100);
    const costCount = await db.select({ count: count() }).from(batchCosts);

    return {
      entityType: 'batch_costs',
      tableName: 'batch_costs',
      recordCount: costCount[0].count,
      sampleRecords: allCosts.slice(0, 5),
      keyFields: ['batchId', 'totalCost', 'costPerL', 'costPerBottle', 'calculatedAt'],
      dataQuality: {
        nullFieldPercentage: 0,
        duplicateRecords: 0,
        referencialIntegrityIssues: 0
      },
      createdDateRange: {
        earliest: null,
        latest: null,
        span: 0
      },
      estimatedUIPages: ['/costing', '/batches/[id]', '/reports/costs']
    };
  }

  /**
   * Discover COGS items data
   */
  private async discoverCogsItems(): Promise<SeededEntityInfo> {
    const allItems = await db.select().from(cogsItems).limit(100);
    const itemCount = await db.select({ count: count() }).from(cogsItems);

    return {
      entityType: 'cogs_items',
      tableName: 'cogs_items',
      recordCount: itemCount[0].count,
      sampleRecords: allItems.slice(0, 5),
      keyFields: ['batchId', 'itemType', 'description', 'cost', 'quantity'],
      dataQuality: {
        nullFieldPercentage: 0,
        duplicateRecords: 0,
        referencialIntegrityIssues: 0
      },
      createdDateRange: {
        earliest: null,
        latest: null,
        span: 0
      },
      estimatedUIPages: ['/costing/[id]', '/cost-breakdown', '/reports/cogs']
    };
  }

  /**
   * Discover users data
   */
  private async discoverUsers(): Promise<SeededEntityInfo> {
    const allUsers = await db.select().from(users).limit(100);
    const userCount = await db.select({ count: count() }).from(users);

    return {
      entityType: 'users',
      tableName: 'users',
      recordCount: userCount[0].count,
      sampleRecords: allUsers.slice(0, 5).map(u => ({
        ...u,
        passwordHash: '[REDACTED]' // Don't expose password hashes
      })),
      keyFields: ['email', 'name', 'role'],
      dataQuality: {
        nullFieldPercentage: 0,
        duplicateRecords: 0,
        referencialIntegrityIssues: 0
      },
      createdDateRange: {
        earliest: null,
        latest: null,
        span: 0
      },
      estimatedUIPages: ['/admin/users', '/profile', '/user-management']
    };
  }

  /**
   * Analyze relationships between entities
   */
  private async analyzeDataRelationships(): Promise<DataRelationshipMap> {
    return {
      purchases: {
        parentEntities: ['vendors'],
        childEntities: ['purchase_items'],
        recordCounts: {}
      },
      purchase_items: {
        parentEntities: ['purchases', 'apple_varieties'],
        childEntities: ['press_items'],
        recordCounts: {}
      },
      press_runs: {
        parentEntities: [],
        childEntities: ['press_items'],
        recordCounts: {}
      },
      press_items: {
        parentEntities: ['press_runs', 'purchase_items'],
        childEntities: ['batch_ingredients'],
        recordCounts: {}
      },
      batches: {
        parentEntities: ['vessels'],
        childEntities: ['batch_ingredients', 'batch_measurements', 'packages', 'batch_costs'],
        recordCounts: {}
      },
      packages: {
        parentEntities: ['batches'],
        childEntities: ['inventory'],
        recordCounts: {}
      },
      inventory: {
        parentEntities: ['packages'],
        childEntities: ['inventory_transactions'],
        recordCounts: {}
      }
    };
  }

  /**
   * Analyze business workflow coverage
   */
  private async analyzeWorkflowCoverage(): Promise<WorkflowCoverage> {
    // Check if we have complete workflow examples
    const vendorCount = await db.select({ count: count() }).from(vendors);
    const purchaseCount = await db.select({ count: count() }).from(purchases);
    const pressRunCount = await db.select({ count: count() }).from(pressRuns);
    const batchCount = await db.select({ count: count() }).from(batches);
    const packageCount = await db.select({ count: count() }).from(packages);
    const inventoryCount = await db.select({ count: count() }).from(inventory);

    const hasVendorToPurchase = vendorCount[0].count > 0 && purchaseCount[0].count > 0;
    const hasPurchaseToPressing = purchaseCount[0].count > 0 && pressRunCount[0].count > 0;
    const hasPressingToFermentation = pressRunCount[0].count > 0 && batchCount[0].count > 0;
    const hasFermentationToPackaging = batchCount[0].count > 0 && packageCount[0].count > 0;
    const hasPackagingToInventory = packageCount[0].count > 0 && inventoryCount[0].count > 0;

    const partialGaps: string[] = [];
    if (!hasVendorToPurchase) partialGaps.push('No vendor→purchase examples');
    if (!hasPurchaseToPressing) partialGaps.push('No purchase→pressing examples');
    if (!hasPressingToFermentation) partialGaps.push('No pressing→fermentation examples');
    if (!hasFermentationToPackaging) partialGaps.push('No fermentation→packaging examples');
    if (!hasPackagingToInventory) partialGaps.push('No packaging→inventory examples');

    return {
      vendorToPurchase: hasVendorToPurchase,
      purchaseToPressing: hasPurchaseToPressing,
      pressingToFermentation: hasPressingToFermentation,
      fermentationToPackaging: hasFermentationToPackaging,
      packagingToInventory: hasPackagingToInventory,
      completeWorkflowExamples: Math.min(purchaseCount[0].count, batchCount[0].count),
      partialWorkflowGaps: partialGaps
    };
  }

  /**
   * Generate recommendations based on data discovery
   */
  private generateDiscoveryRecommendations(entities: SeededEntityInfo[], workflow: WorkflowCoverage): string[] {
    const recommendations: string[] = [];

    // Check for low record counts
    const lowCountEntities = entities.filter(e => e.recordCount < 3);
    if (lowCountEntities.length > 0) {
      recommendations.push(`Consider adding more demo data for: ${lowCountEntities.map(e => e.entityType).join(', ')}`);
    }

    // Check for workflow gaps
    if (workflow.partialWorkflowGaps.length > 0) {
      recommendations.push(`Address workflow gaps: ${workflow.partialWorkflowGaps.join(', ')}`);
    }

    // Check for data quality issues
    const qualityIssues = entities.filter(e => e.dataQuality.referencialIntegrityIssues > 0);
    if (qualityIssues.length > 0) {
      recommendations.push(`Fix referential integrity issues in: ${qualityIssues.map(e => e.entityType).join(', ')}`);
    }

    // Check for missing UI coverage
    const limitedUIPages = entities.filter(e => e.estimatedUIPages.length < 2);
    if (limitedUIPages.length > 0) {
      recommendations.push(`Expand UI visibility for: ${limitedUIPages.map(e => e.entityType).join(', ')}`);
    }

    if (recommendations.length === 0) {
      recommendations.push('Seeded data appears comprehensive and well-structured');
    }

    return recommendations;
  }

  /**
   * Export seeded data inventory to JSON
   */
  async exportInventory(inventory: SeededDataInventory, filePath: string): Promise<void> {
    const fs = require('fs');
    const path = require('path');

    const dir = path.dirname(filePath);
    if (!fs.existsSync(dir)) {
      fs.mkdirSync(dir, { recursive: true });
    }

    fs.writeFileSync(filePath, JSON.stringify(inventory, null, 2));
    console.log(`Seeded data inventory exported to: ${filePath}`);
  }
}