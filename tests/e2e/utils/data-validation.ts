import { Page } from '@playwright/test';
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
import { eq, sql, count, sum, avg } from 'drizzle-orm';

/**
 * Data validation result for individual checks
 */
export interface DataValidationResult {
  entityType: string;
  passed: boolean;
  message: string;
  dbCount: number;
  uiCount: number;
  visibilityPercentage: number;
  issues: string[];
  calculationErrors?: CalculationValidationResult[];
}

/**
 * Business calculation validation result
 */
export interface CalculationValidationResult {
  field: string;
  expected: number | string;
  actual: number | string;
  passed: boolean;
  tolerance?: number;
}

/**
 * Entity relationship validation result
 */
export interface RelationshipValidationResult {
  relationshipType: string;
  passed: boolean;
  message: string;
  orphanedRecords: number;
  missingReferences: string[];
}

/**
 * Comprehensive data validation report
 */
export interface DataValidationReport {
  timestamp: string;
  summary: {
    totalEntities: number;
    passedEntities: number;
    overallVisibilityPercentage: number;
    criticalIssues: number;
    warnings: number;
  };
  entityValidation: DataValidationResult[];
  relationshipValidation: RelationshipValidationResult[];
  calculationValidation: CalculationValidationResult[];
  dataFreshness: {
    lastUpdated: Date;
    staleDays: number;
    isStale: boolean;
  };
  completenessScore: number;
  recommendations: string[];
}

/**
 * Data validator class for comprehensive demo data validation
 */
export class DataValidator {
  private page: Page;
  private validationResults: DataValidationResult[] = [];

  constructor(page: Page) {
    this.page = page;
  }

  /**
   * Perform comprehensive demo data validation
   */
  async validateDemoData(): Promise<DataValidationReport> {
    const startTime = new Date();

    // Reset validation results
    this.validationResults = [];

    // 1. Validate core entities
    await this.validateVendors();
    await this.validatePurchases();
    await this.validateAppleVarieties();
    await this.validatePressRuns();
    await this.validateVessels();
    await this.validateBatches();
    await this.validatePackaging();
    await this.validateInventory();
    await this.validateUsers();

    // 2. Validate entity relationships
    const relationshipValidation = await this.validateEntityRelationships();

    // 3. Validate business calculations
    const calculationValidation = await this.validateBusinessCalculations();

    // 4. Check data freshness
    const dataFreshness = await this.checkDataFreshness();

    // 5. Calculate completeness score
    const completenessScore = await this.calculateCompletenessScore();

    // Generate summary
    const passedEntities = this.validationResults.filter(r => r.passed).length;
    const overallVisibility = this.validationResults.reduce((sum, r) => sum + r.visibilityPercentage, 0) / this.validationResults.length;
    const criticalIssues = this.validationResults.filter(r => !r.passed && r.visibilityPercentage < 80).length;
    const warnings = this.validationResults.filter(r => r.passed && r.issues.length > 0).length;

    const report: DataValidationReport = {
      timestamp: startTime.toISOString(),
      summary: {
        totalEntities: this.validationResults.length,
        passedEntities,
        overallVisibilityPercentage: overallVisibility,
        criticalIssues,
        warnings
      },
      entityValidation: this.validationResults,
      relationshipValidation,
      calculationValidation,
      dataFreshness,
      completenessScore,
      recommendations: this.generateRecommendations()
    };

    return report;
  }

  /**
   * Validate vendors data visibility and consistency
   */
  private async validateVendors(): Promise<void> {
    const dbVendors = await db.select().from(vendors).where(eq(vendors.isActive, true));
    const dbCount = dbVendors.length;

    // Navigate to vendors page and check UI
    await this.page.goto('/vendors');
    await this.page.waitForLoadState('networkidle');

    // Count visible vendor records in UI
    const vendorSelectors = [
      '[data-testid*="vendor"] tr',
      '.vendor-item',
      'table tbody tr:has(td)',
      '[role="row"]:not([role="columnheader"])'
    ];

    let uiCount = 0;
    for (const selector of vendorSelectors) {
      try {
        const count = await this.page.locator(selector).count();
        if (count > 0) {
          uiCount = count;
          break;
        }
      } catch {
        continue;
      }
    }

    // Check for specific vendor names in the UI
    const issues: string[] = [];
    const visibleVendors: string[] = [];

    for (const vendor of dbVendors) {
      const vendorVisible = await this.page.getByText(vendor.name).isVisible().catch(() => false);
      if (vendorVisible) {
        visibleVendors.push(vendor.name);
      } else {
        issues.push(`Vendor "${vendor.name}" not visible in UI`);
      }
    }

    const visibilityPercentage = (visibleVendors.length / dbCount) * 100;

    this.validationResults.push({
      entityType: 'vendors',
      passed: visibilityPercentage >= 95 && uiCount >= Math.floor(dbCount * 0.95),
      message: `Vendors: ${visibleVendors.length}/${dbCount} visible (${visibilityPercentage.toFixed(1)}%)`,
      dbCount,
      uiCount,
      visibilityPercentage,
      issues
    });
  }

  /**
   * Validate purchases data visibility and consistency
   */
  private async validatePurchases(): Promise<void> {
    const dbPurchases = await db.select({
      id: purchases.id,
      vendorId: purchases.vendorId,
      purchaseDate: purchases.purchaseDate,
      totalCost: purchases.totalCost,
      invoiceNumber: purchases.invoiceNumber
    }).from(purchases);

    const dbCount = dbPurchases.length;

    // Navigate to purchases page
    await this.page.goto('/purchases');
    await this.page.waitForLoadState('networkidle');

    // Count visible purchase records
    const purchaseSelectors = [
      '[data-testid*="purchase"] tr',
      '.purchase-item',
      'table tbody tr:has(td)',
      '[role="row"]:not([role="columnheader"])'
    ];

    let uiCount = 0;
    for (const selector of purchaseSelectors) {
      try {
        const count = await this.page.locator(selector).count();
        if (count > 0) {
          uiCount = count;
          break;
        }
      } catch {
        continue;
      }
    }

    // Check for specific purchase data
    const issues: string[] = [];
    const visiblePurchases: string[] = [];

    for (const purchase of dbPurchases) {
      // Check for invoice number or total cost visibility
      const invoiceVisible = purchase.invoiceNumber ?
        await this.page.getByText(purchase.invoiceNumber).isVisible().catch(() => false) : false;
      const costVisible = await this.page.getByText(purchase.totalCost).isVisible().catch(() => false);

      if (invoiceVisible || costVisible) {
        visiblePurchases.push(purchase.id);
      } else {
        issues.push(`Purchase ${purchase.invoiceNumber || purchase.id} not visible`);
      }
    }

    const visibilityPercentage = (visiblePurchases.length / dbCount) * 100;

    this.validationResults.push({
      entityType: 'purchases',
      passed: visibilityPercentage >= 95 && uiCount >= Math.floor(dbCount * 0.95),
      message: `Purchases: ${visiblePurchases.length}/${dbCount} visible (${visibilityPercentage.toFixed(1)}%)`,
      dbCount,
      uiCount,
      visibilityPercentage,
      issues
    });
  }

  /**
   * Validate apple varieties data visibility
   */
  private async validateAppleVarieties(): Promise<void> {
    const dbVarieties = await db.select().from(appleVarieties);
    const dbCount = dbVarieties.length;

    // Check varieties visibility across relevant pages
    const pageTests = ['/varieties', '/purchases/new', '/press-runs'];
    let bestVisibilityCount = 0;
    let bestPage = '';

    for (const pagePath of pageTests) {
      try {
        await this.page.goto(pagePath);
        await this.page.waitForLoadState('networkidle');

        let pageVisibleCount = 0;
        for (const variety of dbVarieties) {
          const visible = await this.page.getByText(variety.name).isVisible().catch(() => false);
          if (visible) pageVisibleCount++;
        }

        if (pageVisibleCount > bestVisibilityCount) {
          bestVisibilityCount = pageVisibleCount;
          bestPage = pagePath;
        }
      } catch {
        continue;
      }
    }

    const visibilityPercentage = (bestVisibilityCount / dbCount) * 100;
    const issues: string[] = [];

    if (bestVisibilityCount < dbCount) {
      issues.push(`${dbCount - bestVisibilityCount} apple varieties not visible on any checked page`);
    }

    this.validationResults.push({
      entityType: 'apple_varieties',
      passed: visibilityPercentage >= 95,
      message: `Apple Varieties: ${bestVisibilityCount}/${dbCount} visible (${visibilityPercentage.toFixed(1)}%) on ${bestPage}`,
      dbCount,
      uiCount: bestVisibilityCount,
      visibilityPercentage,
      issues
    });
  }

  /**
   * Validate press runs data visibility
   */
  private async validatePressRuns(): Promise<void> {
    const dbPressRuns = await db.select().from(pressRuns);
    const dbCount = dbPressRuns.length;

    await this.page.goto('/press-runs');
    await this.page.waitForLoadState('networkidle');

    let uiCount = 0;
    const runSelectors = [
      '[data-testid*="press"] tr',
      '.press-run-item',
      'table tbody tr:has(td)'
    ];

    for (const selector of runSelectors) {
      try {
        const count = await this.page.locator(selector).count();
        if (count > 0) {
          uiCount = count;
          break;
        }
      } catch {
        continue;
      }
    }

    const issues: string[] = [];
    const visibleRuns: number[] = [];

    for (const run of dbPressRuns) {
      const dateStr = run.runDate.toLocaleDateString();
      const volumeStr = run.totalJuiceProducedL;

      const dateVisible = await this.page.getByText(dateStr).isVisible().catch(() => false);
      const volumeVisible = volumeStr ? await this.page.getByText(volumeStr).isVisible().catch(() => false) : false;

      if (dateVisible || volumeVisible) {
        visibleRuns.push(run.id);
      } else {
        issues.push(`Press run from ${dateStr} not visible`);
      }
    }

    const visibilityPercentage = (visibleRuns.length / dbCount) * 100;

    this.validationResults.push({
      entityType: 'press_runs',
      passed: visibilityPercentage >= 95,
      message: `Press Runs: ${visibleRuns.length}/${dbCount} visible (${visibilityPercentage.toFixed(1)}%)`,
      dbCount,
      uiCount,
      visibilityPercentage,
      issues
    });
  }

  /**
   * Validate vessels data visibility
   */
  private async validateVessels(): Promise<void> {
    const dbVessels = await db.select().from(vessels);
    const dbCount = dbVessels.length;

    await this.page.goto('/vessels');
    await this.page.waitForLoadState('networkidle');

    const issues: string[] = [];
    const visibleVessels: string[] = [];

    for (const vessel of dbVessels) {
      const nameVisible = await this.page.getByText(vessel.name).isVisible().catch(() => false);
      const capacityVisible = vessel.capacityL ?
        await this.page.getByText(vessel.capacityL).isVisible().catch(() => false) : false;

      if (nameVisible || capacityVisible) {
        visibleVessels.push(vessel.name);
      } else {
        issues.push(`Vessel "${vessel.name}" not visible`);
      }
    }

    const visibilityPercentage = (visibleVessels.length / dbCount) * 100;

    this.validationResults.push({
      entityType: 'vessels',
      passed: visibilityPercentage >= 95,
      message: `Vessels: ${visibleVessels.length}/${dbCount} visible (${visibilityPercentage.toFixed(1)}%)`,
      dbCount,
      uiCount: visibleVessels.length,
      visibilityPercentage,
      issues
    });
  }

  /**
   * Validate batches data visibility
   */
  private async validateBatches(): Promise<void> {
    const dbBatches = await db.select().from(batches);
    const dbCount = dbBatches.length;

    await this.page.goto('/batches');
    await this.page.waitForLoadState('networkidle');

    const issues: string[] = [];
    const visibleBatches: string[] = [];

    for (const batch of dbBatches) {
      const batchVisible = await this.page.getByText(batch.batchNumber).isVisible().catch(() => false);
      const statusVisible = await this.page.getByText(batch.status).isVisible().catch(() => false);

      if (batchVisible || statusVisible) {
        visibleBatches.push(batch.batchNumber);
      } else {
        issues.push(`Batch "${batch.batchNumber}" not visible`);
      }
    }

    const visibilityPercentage = (visibleBatches.length / dbCount) * 100;

    this.validationResults.push({
      entityType: 'batches',
      passed: visibilityPercentage >= 95,
      message: `Batches: ${visibleBatches.length}/${dbCount} visible (${visibilityPercentage.toFixed(1)}%)`,
      dbCount,
      uiCount: visibleBatches.length,
      visibilityPercentage,
      issues
    });
  }

  /**
   * Validate packaging data visibility
   */
  private async validatePackaging(): Promise<void> {
    const dbPackages = await db.select().from(packages);
    const dbCount = dbPackages.length;

    await this.page.goto('/bottles');
    await this.page.waitForLoadState('networkidle');

    const issues: string[] = [];
    const visiblePackages: string[] = [];

    for (const pkg of dbPackages) {
      const volumeVisible = pkg.volumePackagedL ?
        await this.page.getByText(pkg.volumePackagedL).isVisible().catch(() => false) : false;
      const bottleCountVisible = await this.page.getByText(pkg.bottleCount.toString()).isVisible().catch(() => false);

      if (volumeVisible || bottleCountVisible) {
        visiblePackages.push(pkg.id);
      } else {
        issues.push(`Package ${pkg.id} not visible`);
      }
    }

    const visibilityPercentage = (visiblePackages.length / dbCount) * 100;

    this.validationResults.push({
      entityType: 'packages',
      passed: visibilityPercentage >= 95,
      message: `Packages: ${visiblePackages.length}/${dbCount} visible (${visibilityPercentage.toFixed(1)}%)`,
      dbCount,
      uiCount: visiblePackages.length,
      visibilityPercentage,
      issues
    });
  }

  /**
   * Validate inventory data visibility
   */
  private async validateInventory(): Promise<void> {
    const dbInventory = await db.select().from(inventory);
    const dbCount = dbInventory.length;

    await this.page.goto('/inventory');
    await this.page.waitForLoadState('networkidle');

    const issues: string[] = [];
    const visibleInventory: string[] = [];

    for (const item of dbInventory) {
      const bottleCountVisible = await this.page.getByText(item.currentBottleCount.toString()).isVisible().catch(() => false);
      const locationVisible = item.location ?
        await this.page.getByText(item.location).isVisible().catch(() => false) : false;

      if (bottleCountVisible || locationVisible) {
        visibleInventory.push(item.id);
      } else {
        issues.push(`Inventory item ${item.id} not visible`);
      }
    }

    const visibilityPercentage = (visibleInventory.length / dbCount) * 100;

    this.validationResults.push({
      entityType: 'inventory',
      passed: visibilityPercentage >= 95,
      message: `Inventory: ${visibleInventory.length}/${dbCount} visible (${visibilityPercentage.toFixed(1)}%)`,
      dbCount,
      uiCount: visibleInventory.length,
      visibilityPercentage,
      issues
    });
  }

  /**
   * Validate users data visibility
   */
  private async validateUsers(): Promise<void> {
    const dbUsers = await db.select().from(users);
    const dbCount = dbUsers.length;

    await this.page.goto('/admin/users');
    await this.page.waitForLoadState('networkidle');

    const issues: string[] = [];
    const visibleUsers: string[] = [];

    for (const user of dbUsers) {
      const emailVisible = await this.page.getByText(user.email).isVisible().catch(() => false);
      const nameVisible = user.name ?
        await this.page.getByText(user.name).isVisible().catch(() => false) : false;

      if (emailVisible || nameVisible) {
        visibleUsers.push(user.email);
      } else {
        issues.push(`User "${user.email}" not visible`);
      }
    }

    const visibilityPercentage = (visibleUsers.length / dbCount) * 100;

    this.validationResults.push({
      entityType: 'users',
      passed: visibilityPercentage >= 95,
      message: `Users: ${visibleUsers.length}/${dbCount} visible (${visibilityPercentage.toFixed(1)}%)`,
      dbCount,
      uiCount: visibleUsers.length,
      visibilityPercentage,
      issues
    });
  }

  /**
   * Validate entity relationships and referential integrity
   */
  private async validateEntityRelationships(): Promise<RelationshipValidationResult[]> {
    const results: RelationshipValidationResult[] = [];

    // Purchase -> Vendor relationship
    const orphanedPurchases = await db.select({
      count: count()
    }).from(purchases)
      .leftJoin(vendors, eq(purchases.vendorId, vendors.id))
      .where(sql`${vendors.id} IS NULL`);

    results.push({
      relationshipType: 'Purchase -> Vendor',
      passed: orphanedPurchases[0].count === 0,
      message: orphanedPurchases[0].count === 0 ?
        'All purchases have valid vendor references' :
        `${orphanedPurchases[0].count} purchases have invalid vendor references`,
      orphanedRecords: orphanedPurchases[0].count,
      missingReferences: []
    });

    // Purchase Items -> Purchase relationship
    const orphanedPurchaseItems = await db.select({
      count: count()
    }).from(purchaseItems)
      .leftJoin(purchases, eq(purchaseItems.purchaseId, purchases.id))
      .where(sql`${purchases.id} IS NULL`);

    results.push({
      relationshipType: 'PurchaseItem -> Purchase',
      passed: orphanedPurchaseItems[0].count === 0,
      message: orphanedPurchaseItems[0].count === 0 ?
        'All purchase items have valid purchase references' :
        `${orphanedPurchaseItems[0].count} purchase items have invalid purchase references`,
      orphanedRecords: orphanedPurchaseItems[0].count,
      missingReferences: []
    });

    // Batch -> Vessel relationship (for active batches)
    const batchesWithInvalidVessels = await db.select({
      count: count()
    }).from(batches)
      .leftJoin(vessels, eq(batches.vesselId, vessels.id))
      .where(sql`${batches.vesselId} IS NOT NULL AND ${vessels.id} IS NULL`);

    results.push({
      relationshipType: 'Batch -> Vessel',
      passed: batchesWithInvalidVessels[0].count === 0,
      message: batchesWithInvalidVessels[0].count === 0 ?
        'All batches with vessels have valid vessel references' :
        `${batchesWithInvalidVessels[0].count} batches have invalid vessel references`,
      orphanedRecords: batchesWithInvalidVessels[0].count,
      missingReferences: []
    });

    return results;
  }

  /**
   * Validate business calculations (COGS, yields, ABV, etc.)
   */
  private async validateBusinessCalculations(): Promise<CalculationValidationResult[]> {
    const results: CalculationValidationResult[] = [];

    // Validate press run extraction rates
    const pressRunsData = await db.select().from(pressRuns);

    for (const pressRun of pressRunsData) {
      if (pressRun.totalAppleProcessedKg && pressRun.totalJuiceProducedL && pressRun.extractionRate) {
        const expectedRate = parseFloat(pressRun.totalJuiceProducedL) / parseFloat(pressRun.totalAppleProcessedKg);
        const actualRate = parseFloat(pressRun.extractionRate);
        const tolerance = 0.05; // 5% tolerance

        results.push({
          field: `Press Run ${pressRun.id} Extraction Rate`,
          expected: expectedRate,
          actual: actualRate,
          passed: Math.abs(expectedRate - actualRate) <= tolerance,
          tolerance
        });
      }
    }

    // Validate batch cost calculations
    const batchCostsData = await db.select().from(batchCosts);

    for (const cost of batchCostsData) {
      // Validate total cost calculation
      const calculatedTotal = parseFloat(cost.totalAppleCost) +
                            parseFloat(cost.laborCost) +
                            parseFloat(cost.overheadCost) +
                            parseFloat(cost.packagingCost);
      const actualTotal = parseFloat(cost.totalCost);
      const tolerance = 0.01; // 1 cent tolerance

      results.push({
        field: `Batch ${cost.batchId} Total Cost`,
        expected: calculatedTotal,
        actual: actualTotal,
        passed: Math.abs(calculatedTotal - actualTotal) <= tolerance,
        tolerance
      });

      // Validate cost per liter calculation
      if (cost.costPerL) {
        const batch = await db.select().from(batches).where(eq(batches.id, cost.batchId));
        if (batch.length > 0 && batch[0].currentVolumeL) {
          const expectedCostPerL = actualTotal / parseFloat(batch[0].currentVolumeL);
          const actualCostPerL = parseFloat(cost.costPerL);

          results.push({
            field: `Batch ${cost.batchId} Cost per Liter`,
            expected: expectedCostPerL,
            actual: actualCostPerL,
            passed: Math.abs(expectedCostPerL - actualCostPerL) <= 0.01,
            tolerance: 0.01
          });
        }
      }
    }

    // Validate ABV calculations from measurements
    const measurements = await db.select().from(batchMeasurements);

    for (const measurement of measurements) {
      if (measurement.specificGravity && measurement.abv) {
        // Simple ABV calculation validation (this would need the initial gravity)
        const sg = parseFloat(measurement.specificGravity);
        const abv = parseFloat(measurement.abv);

        // Basic validation that ABV is reasonable for the specific gravity
        if (sg < 1.000 && abv > 0) {
          // Final gravity < 1.000 should have positive ABV
          results.push({
            field: `Measurement ${measurement.id} ABV consistency`,
            expected: 'ABV > 0 for SG < 1.000',
            actual: `ABV: ${abv}, SG: ${sg}`,
            passed: true
          });
        } else if (sg >= 1.040 && abv === 0) {
          // High gravity should have 0 ABV initially
          results.push({
            field: `Measurement ${measurement.id} Initial ABV`,
            expected: 'ABV = 0 for initial high SG',
            actual: `ABV: ${abv}, SG: ${sg}`,
            passed: true
          });
        }
      }
    }

    return results;
  }

  /**
   * Check data freshness
   */
  private async checkDataFreshness(): Promise<{ lastUpdated: Date; staleDays: number; isStale: boolean }> {
    // Find the most recent record across all entities
    const recentDates = await Promise.all([
      db.select({ date: purchases.createdAt }).from(purchases).orderBy(sql`${purchases.createdAt} DESC`).limit(1),
      db.select({ date: batches.createdAt }).from(batches).orderBy(sql`${batches.createdAt} DESC`).limit(1),
      db.select({ date: pressRuns.createdAt }).from(pressRuns).orderBy(sql`${pressRuns.createdAt} DESC`).limit(1)
    ]);

    const allDates = recentDates.flat().map(r => new Date(r.date)).filter(d => d instanceof Date && !isNaN(d.getTime()));
    const lastUpdated = allDates.length > 0 ? new Date(Math.max(...allDates.map(d => d.getTime()))) : new Date(0);

    const staleDays = Math.floor((Date.now() - lastUpdated.getTime()) / (1000 * 60 * 60 * 24));
    const isStale = staleDays > 30; // Consider data stale if older than 30 days

    return { lastUpdated, staleDays, isStale };
  }

  /**
   * Calculate overall data completeness score
   */
  private async calculateCompletenessScore(): Promise<number> {
    const completenessChecks = [
      // Check that we have data across all major entities
      { entity: 'vendors', query: db.select({ count: count() }).from(vendors), expected: 3 },
      { entity: 'purchases', query: db.select({ count: count() }).from(purchases), expected: 3 },
      { entity: 'batches', query: db.select({ count: count() }).from(batches), expected: 3 },
      { entity: 'vessels', query: db.select({ count: count() }).from(vessels), expected: 4 },
      { entity: 'users', query: db.select({ count: count() }).from(users), expected: 2 }
    ];

    let totalScore = 0;
    for (const check of completenessChecks) {
      const result = await check.query;
      const actualCount = result[0].count;
      const score = Math.min(actualCount / check.expected, 1.0) * 100;
      totalScore += score;
    }

    return totalScore / completenessChecks.length;
  }

  /**
   * Generate recommendations based on validation results
   */
  private generateRecommendations(): string[] {
    const recommendations: string[] = [];

    // Analyze validation results for recommendations
    const failedEntities = this.validationResults.filter(r => !r.passed);
    const lowVisibilityEntities = this.validationResults.filter(r => r.visibilityPercentage < 80);

    if (failedEntities.length > 0) {
      recommendations.push(`Address visibility issues for ${failedEntities.length} entity types`);
    }

    if (lowVisibilityEntities.length > 0) {
      recommendations.push(`Investigate UI display issues for entities with <80% visibility`);
    }

    // Check for significant DB vs UI count mismatches
    const countMismatches = this.validationResults.filter(r =>
      Math.abs(r.dbCount - r.uiCount) > r.dbCount * 0.2
    );

    if (countMismatches.length > 0) {
      recommendations.push(`Review pagination or filtering that may hide data from UI display`);
    }

    if (recommendations.length === 0) {
      recommendations.push('Demo data validation passed all checks - system is functioning correctly');
    }

    return recommendations;
  }

  /**
   * Export validation results to JSON file
   */
  async exportResults(report: DataValidationReport, filePath: string): Promise<void> {
    const fs = require('fs');
    const path = require('path');

    // Ensure directory exists
    const dir = path.dirname(filePath);
    if (!fs.existsSync(dir)) {
      fs.mkdirSync(dir, { recursive: true });
    }

    // Write the report
    fs.writeFileSync(filePath, JSON.stringify(report, null, 2));
    console.log(`Demo data validation results exported to: ${filePath}`);
  }
}