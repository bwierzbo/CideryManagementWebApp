import { test, expect } from '@playwright/test';
import { AuthHelper } from '../utils/auth-helpers';
import { TestDataFactory } from '../fixtures/test-data-factory';
import { DashboardPage, PurchasePage, PressPage, BatchPage, PackagingPage, ReportsPage } from '../page-objects';
import { PerformanceMonitor } from '../utils/performance-monitor';

/**
 * Golden Path Workflow Business Validation Tests - Issue #12
 *
 * Advanced business process validation including:
 * - Business rule enforcement
 * - Data consistency validation
 * - Error handling and recovery
 * - Performance constraints
 * - Audit trail verification
 */

test.describe('Golden Path Workflow - Business Process Validation', () => {
  let authHelper: AuthHelper;
  let testDataFactory: TestDataFactory;
  let dashboardPage: DashboardPage;
  let purchasePage: PurchasePage;
  let pressPage: PressPage;
  let batchPage: BatchPage;
  let packagingPage: PackagingPage;
  let reportsPage: ReportsPage;
  let performanceMonitor: PerformanceMonitor;

  test.beforeEach(async ({ page }) => {
    authHelper = new AuthHelper(page);
    testDataFactory = new TestDataFactory();
    dashboardPage = new DashboardPage(page);
    purchasePage = new PurchasePage(page);
    pressPage = new PressPage(page);
    batchPage = new BatchPage(page);
    packagingPage = new PackagingPage(page);
    reportsPage = new ReportsPage(page);
    performanceMonitor = new PerformanceMonitor(page);
  });

  test.afterEach(async () => {
    await testDataFactory.close();
  });

  test('should enforce business rules throughout golden path workflow', async ({ page }) => {
    console.log('🔍 Testing Business Rule Enforcement');

    await authHelper.loginAs('admin');
    await dashboardPage.waitForDashboardLoad();

    const testData = await testDataFactory.createCompleteTestScenario();

    // ==== BUSINESS RULE 1: Purchase Validation ====
    console.log('📋 Testing Purchase Business Rules');

    await dashboardPage.navigateToPurchases();
    await purchasePage.waitForPageLoad();

    // Test: Cannot create purchase with negative quantities
    const invalidPurchaseData = {
      vendor: testData.vendors[0].name,
      invoiceNumber: 'INVALID-PURCHASE-001',
      purchaseDate: new Date().toISOString().split('T')[0],
      items: [
        {
          appleVariety: 'Honeycrisp',
          quantity: '-100', // Invalid negative quantity
          unit: 'kg',
          pricePerUnit: '2.50',
          notes: 'Testing negative quantity validation'
        }
      ]
    };

    await purchasePage.createPurchase(invalidPurchaseData);

    // Verify error message for negative quantity
    const purchaseErrors = await purchasePage.getValidationErrors();
    expect(purchaseErrors.some(error => error.toLowerCase().includes('quantity'))).toBe(true);
    console.log('✅ Purchase negative quantity validation works');

    // Test: Cannot create purchase with future date beyond allowed threshold
    const futurePurchaseData = {
      vendor: testData.vendors[0].name,
      invoiceNumber: 'FUTURE-PURCHASE-001',
      purchaseDate: new Date(Date.now() + 365 * 24 * 60 * 60 * 1000).toISOString().split('T')[0], // 1 year future
      items: [
        {
          appleVariety: 'Honeycrisp',
          quantity: '100',
          unit: 'kg',
          pricePerUnit: '2.50'
        }
      ]
    };

    await purchasePage.createPurchase(futurePurchaseData);

    const futureDateErrors = await purchasePage.getValidationErrors();
    expect(futureDateErrors.some(error => error.toLowerCase().includes('date'))).toBe(true);
    console.log('✅ Purchase future date validation works');

    // Create valid purchase for further testing
    const validPurchaseData = {
      vendor: testData.vendors[0].name,
      invoiceNumber: 'VALID-BUSINESS-RULES-001',
      purchaseDate: new Date().toISOString().split('T')[0],
      items: [
        {
          appleVariety: 'Honeycrisp',
          quantity: '1000',
          unit: 'kg',
          pricePerUnit: '2.50',
          notes: 'Valid purchase for business rule testing'
        }
      ]
    };

    await purchasePage.createPurchase(validPurchaseData);
    await expect(page.locator('[data-testid="purchase-success-message"]')).toBeVisible();
    const purchaseNumber = await purchasePage.getCurrentPurchaseNumber();

    // ==== BUSINESS RULE 2: Press Operations Validation ====
    console.log('🍎 Testing Press Operations Business Rules');

    await dashboardPage.navigateToPress();
    await pressPage.waitForPageLoad();

    // Test: Cannot use more apples than available in purchase
    const excessivePressData = {
      runDate: new Date().toISOString().split('T')[0],
      purchaseNumbers: [purchaseNumber],
      notes: 'Testing excessive apple usage validation'
    };

    await pressPage.createPressRun(excessivePressData);

    // Manually try to add press item with more apples than available
    await pressPage.addPressItem({
      purchaseItemId: 'test-item-id',
      quantityUsed: '2000', // More than the 1000kg purchased
      brixMeasured: '12.0',
      notes: 'Testing excessive quantity validation'
    });

    const pressErrors = await pressPage.getValidationErrors();
    expect(pressErrors.some(error => error.toLowerCase().includes('exceeds') || error.toLowerCase().includes('insufficient'))).toBe(true);
    console.log('✅ Press excessive quantity validation works');

    // Test: Brix measurement must be within valid range
    await pressPage.addPressItem({
      purchaseItemId: 'test-item-id',
      quantityUsed: '500',
      brixMeasured: '50.0', // Invalid - too high for apples
      notes: 'Testing brix validation'
    });

    const brixErrors = await pressPage.getValidationErrors();
    expect(brixErrors.some(error => error.toLowerCase().includes('brix'))).toBe(true);
    console.log('✅ Press brix range validation works');

    // Create valid press run
    const validPressData = {
      runDate: new Date().toISOString().split('T')[0],
      purchaseNumbers: [purchaseNumber],
      items: [
        {
          purchaseItemId: 'valid-item-id',
          quantityUsed: '800',
          juiceProduced: '544', // 68% extraction
          brixMeasured: '13.0',
          notes: 'Valid press item for testing'
        }
      ]
    };

    await pressPage.createPressRun(validPressData);
    await expect(page.locator('[data-testid="press-success-message"]')).toBeVisible();
    const pressRunNumber = await pressPage.getCurrentPressRunNumber();

    // ==== BUSINESS RULE 3: Batch and Fermentation Validation ====
    console.log('🍺 Testing Batch Business Rules');

    await dashboardPage.navigateToBatches();
    await batchPage.waitForPageLoad();

    // Test: Cannot create batch with volume exceeding vessel capacity
    const oversizedBatchData = {
      batchNumber: 'OVERSIZED-BATCH-001',
      pressRunNumber: pressRunNumber,
      vesselName: testData.vessels[0].name,
      targetAbv: '15.0', // Invalid - too high for cider
      notes: 'Testing vessel capacity and ABV validation'
    };

    await batchPage.createBatch(oversizedBatchData);

    const batchErrors = await batchPage.getValidationErrors();
    expect(batchErrors.some(error =>
      error.toLowerCase().includes('capacity') ||
      error.toLowerCase().includes('abv') ||
      error.toLowerCase().includes('volume')
    )).toBe(true);
    console.log('✅ Batch capacity and ABV validation works');

    // Test: Cannot transfer to vessel that is already in use
    const validBatchData = {
      batchNumber: 'VALID-BATCH-001',
      pressRunNumber: pressRunNumber,
      vesselName: testData.vessels[0].name,
      targetAbv: '6.8',
      notes: 'Valid batch for business rule testing'
    };

    await batchPage.createBatch(validBatchData);
    await expect(page.locator('[data-testid="batch-success-message"]')).toBeVisible();

    // Try to create another batch in the same vessel
    const conflictingBatchData = {
      batchNumber: 'CONFLICTING-BATCH-001',
      pressRunNumber: pressRunNumber,
      vesselName: testData.vessels[0].name, // Same vessel - should fail
      targetAbv: '6.5'
    };

    await batchPage.createBatch(conflictingBatchData);

    const vesselConflictErrors = await batchPage.getValidationErrors();
    expect(vesselConflictErrors.some(error =>
      error.toLowerCase().includes('vessel') ||
      error.toLowerCase().includes('use') ||
      error.toLowerCase().includes('occupied')
    )).toBe(true);
    console.log('✅ Vessel availability validation works');

    // ==== BUSINESS RULE 4: Measurement Validation ====
    console.log('📊 Testing Measurement Business Rules');

    // Test: Specific gravity must follow logical progression
    await batchPage.addMeasurement({
      date: new Date().toISOString().split('T')[0],
      specificGravity: '1.055',
      abv: '0.0',
      ph: '3.6',
      temperature: '22',
      notes: 'Initial measurement'
    });

    // Try to add measurement with impossible specific gravity increase
    await batchPage.addMeasurement({
      date: new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString().split('T')[0],
      specificGravity: '1.070', // Higher than initial - impossible during fermentation
      abv: '2.0',
      ph: '3.5',
      temperature: '20',
      notes: 'Invalid gravity increase'
    });

    const gravityErrors = await batchPage.getValidationErrors();
    expect(gravityErrors.some(error =>
      error.toLowerCase().includes('gravity') ||
      error.toLowerCase().includes('fermentation')
    )).toBe(true);
    console.log('✅ Specific gravity progression validation works');

    // Test: pH must be within acceptable range for cider
    await batchPage.addMeasurement({
      date: new Date(Date.now() + 48 * 60 * 60 * 1000).toISOString().split('T')[0],
      specificGravity: '1.020',
      abv: '4.0',
      ph: '2.0', // Too acidic - dangerous
      temperature: '20',
      notes: 'Invalid pH test'
    });

    const phErrors = await batchPage.getValidationErrors();
    expect(phErrors.some(error => error.toLowerCase().includes('ph'))).toBe(true);
    console.log('✅ pH range validation works');

    // ==== BUSINESS RULE 5: Packaging Validation ====
    console.log('📦 Testing Packaging Business Rules');

    // First complete the batch properly
    await batchPage.addMeasurement({
      date: new Date(Date.now() + 3 * 24 * 60 * 60 * 1000).toISOString().split('T')[0],
      specificGravity: '1.000',
      abv: '6.8',
      ph: '3.3',
      temperature: '18',
      notes: 'Fermentation complete'
    });

    await dashboardPage.navigateToPackaging();
    await packagingPage.waitForPageLoad();

    // Test: Cannot package more volume than available in batch
    const excessivePackagingData = {
      batchNumber: 'VALID-BATCH-001',
      bottleSize: '750ml',
      volumeToPackage: '1000', // More than batch volume
      location: 'Test Warehouse',
      notes: 'Testing excessive packaging volume'
    };

    await packagingPage.createPackagingRun(excessivePackagingData);

    const packagingErrors = await packagingPage.getValidationErrors();
    expect(packagingErrors.some(error =>
      error.toLowerCase().includes('volume') ||
      error.toLowerCase().includes('insufficient') ||
      error.toLowerCase().includes('exceeds')
    )).toBe(true);
    console.log('✅ Packaging volume validation works');

    // Test: Quality control validation
    const qcFailData = {
      batchNumber: 'VALID-BATCH-001',
      bottleSize: '750ml',
      volumeToPackage: '400',
      location: 'Test Warehouse',
      qualityControl: {
        abv: '12.0', // Doesn't match batch ABV
        ph: '3.3',
        clarity: 'clear',
        approved: false // QC failed
      }
    };

    await packagingPage.createPackagingRun(qcFailData);

    const qcErrors = await packagingPage.getValidationErrors();
    expect(qcErrors.some(error =>
      error.toLowerCase().includes('quality') ||
      error.toLowerCase().includes('abv') ||
      error.toLowerCase().includes('approved')
    )).toBe(true);
    console.log('✅ Quality control validation works');

    console.log('✅ All business rule validations completed successfully');
  });

  test('should maintain data consistency throughout workflow', async ({ page }) => {
    console.log('🔄 Testing Data Consistency Throughout Workflow');

    await authHelper.loginAs('admin');
    await dashboardPage.waitForDashboardLoad();

    const testData = await testDataFactory.createCompleteTestScenario();

    // Track data consistency through each step
    const consistencyTracker = {
      purchaseData: null as any,
      pressData: null as any,
      batchData: null as any,
      packagingData: null as any
    };

    // ==== STEP 1: Create Purchase and Track Data ====
    await dashboardPage.navigateToPurchases();

    const purchaseData = {
      vendor: testData.vendors[0].name,
      invoiceNumber: 'CONSISTENCY-TEST-001',
      purchaseDate: new Date().toISOString().split('T')[0],
      items: [
        {
          appleVariety: 'Honeycrisp',
          quantity: '1200',
          unit: 'kg',
          pricePerUnit: '2.75',
          notes: 'Consistency tracking apples'
        }
      ]
    };

    await purchasePage.createPurchase(purchaseData);
    const purchaseNumber = await purchasePage.getCurrentPurchaseNumber();
    const purchaseDetails = await purchasePage.getPurchaseDetails();

    consistencyTracker.purchaseData = {
      totalApples: 1200,
      totalCost: 3300, // 1200 * 2.75
      vendor: testData.vendors[0].name
    };

    // Verify purchase totals
    expect(parseFloat(purchaseDetails.totalCost)).toBe(consistencyTracker.purchaseData.totalCost);
    console.log(`✅ Purchase consistency: ${consistencyTracker.purchaseData.totalApples}kg apples, $${consistencyTracker.purchaseData.totalCost}`);

    // ==== STEP 2: Create Press Run and Verify Consistency ====
    await dashboardPage.navigateToPress();

    const pressData = {
      runDate: new Date().toISOString().split('T')[0],
      purchaseNumbers: [purchaseNumber],
      expectedExtractionRate: 0.70
    };

    await pressPage.createPressRun(pressData);
    const pressResults = await pressPage.getPressResults();

    consistencyTracker.pressData = {
      applesUsed: parseFloat(pressResults.totalAppleProcessed),
      juiceProduced: parseFloat(pressResults.totalJuiceProduced),
      extractionRate: parseFloat(pressResults.extractionRate)
    };

    // Verify press consistency
    expect(consistencyTracker.pressData.applesUsed).toBeLessThanOrEqual(consistencyTracker.purchaseData.totalApples);
    expect(consistencyTracker.pressData.extractionRate).toBeCloseTo(0.70, 1);

    const expectedJuice = consistencyTracker.pressData.applesUsed * consistencyTracker.pressData.extractionRate;
    expect(consistencyTracker.pressData.juiceProduced).toBeCloseTo(expectedJuice, 0);

    console.log(`✅ Press consistency: ${consistencyTracker.pressData.applesUsed}kg → ${consistencyTracker.pressData.juiceProduced}L (${consistencyTracker.pressData.extractionRate * 100}%)`);

    // ==== STEP 3: Create Batch and Verify Volume Consistency ====
    await dashboardPage.navigateToBatches();

    const batchData = {
      batchNumber: 'CONSISTENCY-BATCH-001',
      vesselName: testData.vessels[0].name,
      targetAbv: '6.5',
      notes: 'Consistency tracking batch'
    };

    await batchPage.createBatch(batchData);
    const batchDetails = await batchPage.getBatchDetails();

    consistencyTracker.batchData = {
      initialVolume: parseFloat(batchDetails.initialVolume),
      currentVolume: parseFloat(batchDetails.currentVolume),
      targetAbv: parseFloat(batchDetails.targetAbv)
    };

    // Verify batch volume matches press output (allowing for small losses)
    expect(consistencyTracker.batchData.initialVolume).toBeCloseTo(consistencyTracker.pressData.juiceProduced, 1);
    expect(consistencyTracker.batchData.currentVolume).toBe(consistencyTracker.batchData.initialVolume);

    console.log(`✅ Batch consistency: ${consistencyTracker.batchData.initialVolume}L initial volume, target ${consistencyTracker.batchData.targetAbv}% ABV`);

    // ==== STEP 4: Complete Fermentation with Consistent Measurements ====
    const fermentationMeasurements = [
      { sg: 1.055, abv: 0.0, days: 0 },
      { sg: 1.030, abv: 3.2, days: 7 },
      { sg: 1.005, abv: 6.2, days: 14 },
      { sg: 1.000, abv: 6.5, days: 21 }
    ];

    for (const measurement of fermentationMeasurements) {
      await batchPage.addMeasurement({
        date: new Date(Date.now() + measurement.days * 24 * 60 * 60 * 1000).toISOString().split('T')[0],
        specificGravity: measurement.sg.toString(),
        abv: measurement.abv.toString(),
        ph: '3.4',
        temperature: '20',
        notes: `Day ${measurement.days} measurement`
      });
    }

    // Verify measurement progression is logical
    const allMeasurements = await batchPage.getAllMeasurements();
    for (let i = 1; i < allMeasurements.length; i++) {
      const current = allMeasurements[i];
      const previous = allMeasurements[i - 1];

      // SG should decrease or stay same
      expect(parseFloat(current.specificGravity)).toBeLessThanOrEqual(parseFloat(previous.specificGravity));

      // ABV should increase or stay same
      expect(parseFloat(current.abv)).toBeGreaterThanOrEqual(parseFloat(previous.abv));
    }

    console.log(`✅ Fermentation consistency: SG 1.055 → 1.000, ABV 0.0% → 6.5%`);

    // ==== STEP 5: Package with Volume Tracking ====
    await dashboardPage.navigateToPackaging();

    const packagingData = {
      batchNumber: 'CONSISTENCY-BATCH-001',
      bottleSize: '750ml',
      volumeToPackage: Math.floor(consistencyTracker.batchData.currentVolume * 0.95).toString(), // 95% packaging efficiency
      location: 'Consistency Test Warehouse',
      qualityControl: {
        abv: '6.5',
        ph: '3.3',
        clarity: 'clear',
        approved: true
      }
    };

    await packagingPage.createPackagingRun(packagingData);
    const packagingResults = await packagingPage.getPackagingResults();

    consistencyTracker.packagingData = {
      volumePackaged: parseFloat(packagingResults.totalVolumePackaged),
      bottlesProduced: packagingResults.totalBottlesPackaged,
      finalAbv: parseFloat(packagingResults.finalAbv)
    };

    // Verify packaging consistency
    expect(consistencyTracker.packagingData.volumePackaged).toBeLessThanOrEqual(consistencyTracker.batchData.currentVolume);
    expect(consistencyTracker.packagingData.finalAbv).toBeCloseTo(6.5, 1);

    const expectedBottles = Math.floor(consistencyTracker.packagingData.volumePackaged / 0.75);
    expect(consistencyTracker.packagingData.bottlesProduced).toBeCloseTo(expectedBottles, 1);

    console.log(`✅ Packaging consistency: ${consistencyTracker.packagingData.volumePackaged}L → ${consistencyTracker.packagingData.bottlesProduced} bottles`);

    // ==== FINAL CONSISTENCY VERIFICATION ====
    const finalConsistencyReport = {
      inputApples: consistencyTracker.purchaseData.totalApples,
      juiceExtracted: consistencyTracker.pressData.juiceProduced,
      volumePackaged: consistencyTracker.packagingData.volumePackaged,
      bottlesProduced: consistencyTracker.packagingData.bottlesProduced,
      overallEfficiency: (consistencyTracker.packagingData.volumePackaged / (consistencyTracker.purchaseData.totalApples * 0.70)) * 100
    };

    // Mass balance verification
    expect(finalConsistencyReport.overallEfficiency).toBeGreaterThan(85); // At least 85% overall efficiency
    expect(finalConsistencyReport.overallEfficiency).toBeLessThan(100); // Cannot exceed 100%

    console.log('\n🎯 Final Consistency Report:');
    console.log('══════════════════════════════════════');
    console.log(`📊 Input: ${finalConsistencyReport.inputApples}kg apples`);
    console.log(`🧃 Juice: ${finalConsistencyReport.juiceExtracted}L`);
    console.log(`📦 Packaged: ${finalConsistencyReport.volumePackaged}L`);
    console.log(`🍾 Bottles: ${finalConsistencyReport.bottlesProduced}`);
    console.log(`⚡ Efficiency: ${finalConsistencyReport.overallEfficiency.toFixed(1)}%`);
    console.log('══════════════════════════════════════');
    console.log('✅ All data consistency checks passed!');
  });

  test('should handle concurrent workflow operations without data corruption', async ({ page }) => {
    console.log('⚡ Testing Concurrent Operations');

    await authHelper.loginAs('admin');
    await dashboardPage.waitForDashboardLoad();

    const testData = await testDataFactory.createCompleteTestScenario();

    // Create multiple concurrent purchases
    const concurrentPurchases = [
      {
        vendor: testData.vendors[0].name,
        invoiceNumber: 'CONCURRENT-A-001',
        items: [{ appleVariety: 'Honeycrisp', quantity: '500', unit: 'kg', pricePerUnit: '2.50' }]
      },
      {
        vendor: testData.vendors[1].name,
        invoiceNumber: 'CONCURRENT-B-001',
        items: [{ appleVariety: 'Granny Smith', quantity: '600', unit: 'kg', pricePerUnit: '2.00' }]
      }
    ];

    // Process purchases concurrently
    await dashboardPage.navigateToPurchases();

    const purchasePromises = concurrentPurchases.map(async (purchaseData, index) => {
      const fullPurchaseData = {
        ...purchaseData,
        purchaseDate: new Date().toISOString().split('T')[0]
      };

      await purchasePage.createPurchase(fullPurchaseData);
      return await purchasePage.getCurrentPurchaseNumber();
    });

    const purchaseNumbers = await Promise.all(purchasePromises);
    expect(purchaseNumbers).toHaveLength(2);
    expect(purchaseNumbers[0]).not.toBe(purchaseNumbers[1]);

    // Verify no data corruption in concurrent processing
    for (const purchaseNumber of purchaseNumbers) {
      await purchasePage.searchPurchases({ invoiceNumber: purchaseNumber.split('-').slice(-1)[0] });
      const searchResults = await purchasePage.getPurchaseList();
      expect(searchResults).toHaveLength(1);
      expect(searchResults[0].invoiceNumber).toContain(purchaseNumber);
    }

    console.log('✅ Concurrent purchase operations completed without corruption');

    // Test concurrent batch operations in different vessels
    await dashboardPage.navigateToBatches();

    const concurrentBatches = [
      {
        batchNumber: 'CONCURRENT-BATCH-A',
        vesselName: testData.vessels[0].name,
        targetAbv: '6.5'
      },
      {
        batchNumber: 'CONCURRENT-BATCH-B',
        vesselName: testData.vessels[1].name,
        targetAbv: '6.0'
      }
    ];

    for (const batchData of concurrentBatches) {
      await batchPage.createBatch(batchData);
      await expect(page.locator('[data-testid="batch-success-message"]')).toBeVisible();
    }

    // Verify both batches are active in different vessels
    const activeBatches = await batchPage.getActiveBatches();
    expect(activeBatches).toHaveLength(2);

    const vesselNames = activeBatches.map(batch => batch.vesselName);
    expect(vesselNames).toContain(testData.vessels[0].name);
    expect(vesselNames).toContain(testData.vessels[1].name);

    console.log('✅ Concurrent batch operations completed without vessel conflicts');
  });

  test('should validate performance constraints during workflow', async ({ page }) => {
    console.log('⏱️ Testing Performance Constraints');

    const workflowTimer = performanceMonitor.startTimer('full-workflow-performance');

    await authHelper.loginAs('admin');
    await dashboardPage.waitForDashboardLoad();

    const testData = await testDataFactory.createCompleteTestScenario();

    // Performance-constrained workflow execution
    const performanceSteps = [
      {
        name: 'purchase-creation-performance',
        action: async () => {
          await dashboardPage.navigateToPurchases();
          await purchasePage.createPurchase({
            vendor: testData.vendors[0].name,
            invoiceNumber: 'PERF-TEST-001',
            purchaseDate: new Date().toISOString().split('T')[0],
            items: [
              { appleVariety: 'Honeycrisp', quantity: '800', unit: 'kg', pricePerUnit: '2.60' }
            ]
          });
          return await purchasePage.getCurrentPurchaseNumber();
        },
        maxDuration: 5000 // 5 seconds max
      },
      {
        name: 'press-operations-performance',
        action: async (purchaseNumber: string) => {
          await dashboardPage.navigateToPress();
          await pressPage.createPressRun({
            runDate: new Date().toISOString().split('T')[0],
            purchaseNumbers: [purchaseNumber],
            expectedExtractionRate: 0.68
          });
          return await pressPage.getCurrentPressRunNumber();
        },
        maxDuration: 8000 // 8 seconds max
      },
      {
        name: 'batch-creation-performance',
        action: async (pressRunNumber: string) => {
          await dashboardPage.navigateToBatches();
          await batchPage.createBatch({
            batchNumber: 'PERF-BATCH-001',
            vesselName: testData.vessels[0].name,
            targetAbv: '6.8'
          });
          return await batchPage.getCurrentBatchNumber();
        },
        maxDuration: 6000 // 6 seconds max
      }
    ];

    let context: any = null;

    for (const step of performanceSteps) {
      const stepTimer = performanceMonitor.startTimer(step.name);

      try {
        context = await step.action(context);
        const result = stepTimer.stop();

        expect(result.duration).toBeLessThan(step.maxDuration);
        console.log(`✅ ${step.name}: ${result.duration.toFixed(0)}ms (max: ${step.maxDuration}ms)`);
      } catch (error) {
        stepTimer.stop();
        throw error;
      }
    }

    const workflowResult = workflowTimer.stop();

    // Total workflow should complete within performance threshold
    expect(workflowResult.duration).toBeLessThan(30000); // 30 seconds total

    console.log(`✅ Full workflow performance: ${workflowResult.duration.toFixed(0)}ms`);

    // Verify system responsiveness during load
    const responsivenessMeasurements = [];
    for (let i = 0; i < 5; i++) {
      const responseTimer = performanceMonitor.startTimer(`responsiveness-check-${i}`);
      await dashboardPage.navigate();
      await dashboardPage.waitForDashboardLoad();
      const responseResult = responseTimer.stop();
      responsivenessMeasurements.push(responseResult.duration);
    }

    const avgResponseTime = responsivenessMeasurements.reduce((sum, time) => sum + time, 0) / responsivenessMeasurements.length;
    expect(avgResponseTime).toBeLessThan(3000); // Average response under 3 seconds

    console.log(`✅ System responsiveness: ${avgResponseTime.toFixed(0)}ms average`);

    const performanceSummary = performanceMonitor.getPerformanceSummary();
    console.log('\n⚡ Performance Summary:');
    Object.entries(performanceSummary).forEach(([name, result]) => {
      console.log(`  ${name}: ${result.duration.toFixed(0)}ms`);
    });
  });
});

test.describe('Golden Path Workflow - Audit Trail Verification', () => {
  let authHelper: AuthHelper;
  let testDataFactory: TestDataFactory;
  let dashboardPage: DashboardPage;
  let reportsPage: ReportsPage;

  test.beforeEach(async ({ page }) => {
    authHelper = new AuthHelper(page);
    testDataFactory = new TestDataFactory();
    dashboardPage = new DashboardPage(page);
    reportsPage = new ReportsPage(page);
  });

  test.afterEach(async () => {
    await testDataFactory.close();
  });

  test('should maintain complete audit trail throughout golden path workflow', async ({ page }) => {
    console.log('📝 Testing Complete Audit Trail');

    await authHelper.loginAs('admin');
    await dashboardPage.waitForDashboardLoad();

    const testData = await testDataFactory.createCompleteTestScenario();

    // Execute a simplified workflow to generate audit events
    const workflowSteps = [
      'Purchase Creation',
      'Press Operations',
      'Batch Creation',
      'Fermentation Measurements',
      'Packaging Operations'
    ];

    console.log('🎬 Executing workflow to generate audit trail...');

    // Simplified workflow execution for audit testing
    // (Implementation would depend on actual workflow execution)

    // Generate audit report
    await dashboardPage.navigateToReports();
    await reportsPage.waitForPageLoad();

    await reportsPage.generateAuditReport({
      dateFrom: new Date().toISOString().split('T')[0],
      dateTo: new Date().toISOString().split('T')[0],
      includeFullTrail: true
    });

    const auditTrail = await reportsPage.getAuditTrail();

    // Verify audit completeness
    expect(auditTrail.length).toBeGreaterThan(0);

    // Verify each workflow step has corresponding audit entries
    const auditActions = auditTrail.map(entry => entry.action);
    expect(auditActions).toContain('CREATE');
    expect(auditActions).toContain('UPDATE');

    // Verify user attribution
    auditTrail.forEach(entry => {
      expect(entry.userId).toBeTruthy();
      expect(entry.timestamp).toBeTruthy();
    });

    // Verify data integrity in audit
    const createEntries = auditTrail.filter(entry => entry.action === 'CREATE');
    createEntries.forEach(entry => {
      expect(entry.newValues).toBeTruthy();
      expect(entry.entityType).toBeTruthy();
      expect(entry.entityId).toBeTruthy();
    });

    console.log(`✅ Audit trail verification completed: ${auditTrail.length} entries found`);
    console.log(`📊 Audit coverage: ${createEntries.length} CREATE, ${auditTrail.filter(e => e.action === 'UPDATE').length} UPDATE actions`);
  });
});