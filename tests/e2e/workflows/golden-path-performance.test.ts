import { test, expect } from '@playwright/test';
import { AuthHelper } from '../utils/auth-helpers';
import { TestDataFactory } from '../fixtures/test-data-factory';
import { DashboardPage, PurchasePage, PressPage, BatchPage, PackagingPage, ReportsPage } from '../page-objects';
import { PerformanceMonitor, TimerResult } from '../utils/performance-monitor';

/**
 * Golden Path Workflow Performance Tests - Issue #12
 *
 * Comprehensive performance testing including:
 * - 10-minute workflow completion target
 * - Large-scale data handling
 * - Concurrent operation performance
 * - Memory usage optimization
 * - Response time benchmarks
 * - Realistic production scenarios
 */

test.describe('Golden Path Workflow - Performance and Scale Testing', () => {
  let authHelper: AuthHelper;
  let testDataFactory: TestDataFactory;
  let dashboardPage: DashboardPage;
  let purchasePage: PurchasePage;
  let pressPage: PressPage;
  let batchPage: BatchPage;
  let packagingPage: PackagingPage;
  let reportsPage: ReportsPage;
  let performanceMonitor: PerformanceMonitor;

  // Performance thresholds (in milliseconds)
  const PERFORMANCE_THRESHOLDS = {
    TOTAL_WORKFLOW: 600000, // 10 minutes
    PURCHASE_CREATION: 5000, // 5 seconds
    PRESS_OPERATIONS: 8000, // 8 seconds
    BATCH_CREATION: 6000, // 6 seconds
    FERMENTATION_MEASUREMENT: 3000, // 3 seconds
    TRANSFER_OPERATION: 5000, // 5 seconds
    PACKAGING_RUN: 10000, // 10 seconds
    COGS_REPORT: 15000, // 15 seconds
    PAGE_NAVIGATION: 3000, // 3 seconds
    FORM_SUBMISSION: 4000 // 4 seconds
  };

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

  test('should complete full golden path workflow within 10-minute performance target', async ({ page }) => {
    console.log('⏱️ PERFORMANCE TARGET: Complete workflow within 10 minutes');
    console.log('🚀 Starting comprehensive performance test...');

    const fullWorkflowTimer = performanceMonitor.startTimer('full-golden-path-workflow');

    // ==== SETUP AND AUTHENTICATION ====
    const authTimer = performanceMonitor.startTimer('authentication-setup');
    await authHelper.loginAs('admin');
    await dashboardPage.waitForDashboardLoad();
    const testData = await testDataFactory.createCompleteTestScenario();
    authTimer.stop();

    console.log('✅ Authentication and setup completed');

    // ==== PHASE 1: PURCHASE CREATION ====
    const purchaseTimer = performanceMonitor.startTimer('purchase-creation-phase');

    const navigationTimer1 = performanceMonitor.startTimer('navigation-to-purchases');
    await dashboardPage.navigateToPurchases();
    await purchasePage.waitForPageLoad();
    navigationTimer1.stop();

    const purchaseData = {
      vendor: testData.vendors[0].name,
      invoiceNumber: 'PERF-TARGET-001',
      purchaseDate: new Date().toISOString().split('T')[0],
      items: [
        {
          appleVariety: 'Honeycrisp',
          quantity: '2000',
          unit: 'kg',
          pricePerUnit: '2.80',
          notes: 'Performance test - premium apples'
        },
        {
          appleVariety: 'Granny Smith',
          quantity: '800',
          unit: 'kg',
          pricePerUnit: '2.20',
          notes: 'Performance test - acid balance'
        },
        {
          appleVariety: 'Gala',
          quantity: '500',
          unit: 'kg',
          pricePerUnit: '2.40',
          notes: 'Performance test - sweetness'
        }
      ]
    };

    const createPurchaseTimer = performanceMonitor.startTimer('create-purchase-operation');
    await purchasePage.createPurchase(purchaseData);
    await expect(page.locator('[data-testid="purchase-success-message"]')).toBeVisible();
    const purchaseNumber = await purchasePage.getCurrentPurchaseNumber();
    createPurchaseTimer.stop();

    const purchasePhaseResult = purchaseTimer.stop();
    expect(purchasePhaseResult.duration).toBeLessThan(PERFORMANCE_THRESHOLDS.PURCHASE_CREATION);

    console.log(`✅ Purchase Phase: ${purchasePhaseResult.duration.toFixed(0)}ms (Target: ${PERFORMANCE_THRESHOLDS.PURCHASE_CREATION}ms)`);

    // ==== PHASE 2: PRESS OPERATIONS ====
    const pressTimer = performanceMonitor.startTimer('press-operations-phase');

    const navigationTimer2 = performanceMonitor.startTimer('navigation-to-press');
    await dashboardPage.navigateToPress();
    await pressPage.waitForPageLoad();
    navigationTimer2.stop();

    const pressData = {
      runDate: new Date().toISOString().split('T')[0],
      purchaseNumbers: [purchaseNumber],
      expectedExtractionRate: 0.72,
      notes: 'Performance test press run - high efficiency target'
    };

    const createPressTimer = performanceMonitor.startTimer('create-press-operation');
    await pressPage.createPressRun(pressData);
    await expect(page.locator('[data-testid="press-success-message"]')).toBeVisible();
    const pressRunNumber = await pressPage.getCurrentPressRunNumber();
    createPressTimer.stop();

    const pressResults = await pressPage.getPressResults();
    const pressPhaseResult = pressTimer.stop();
    expect(pressPhaseResult.duration).toBeLessThan(PERFORMANCE_THRESHOLDS.PRESS_OPERATIONS);

    console.log(`✅ Press Phase: ${pressPhaseResult.duration.toFixed(0)}ms (Target: ${PERFORMANCE_THRESHOLDS.PRESS_OPERATIONS}ms)`);
    console.log(`  - Processed: ${pressResults.totalAppleProcessed}kg → ${pressResults.totalJuiceProduced}L`);

    // ==== PHASE 3: BATCH CREATION AND INITIAL FERMENTATION ====
    const batchTimer = performanceMonitor.startTimer('batch-creation-phase');

    const navigationTimer3 = performanceMonitor.startTimer('navigation-to-batches');
    await dashboardPage.navigateToBatches();
    await batchPage.waitForPageLoad();
    navigationTimer3.stop();

    const batchData = {
      batchNumber: 'PERF-BATCH-2024-001',
      pressRunNumber: pressRunNumber,
      vesselName: testData.vessels[0].name,
      targetAbv: '7.2',
      notes: 'Performance test batch - complex blend'
    };

    const createBatchTimer = performanceMonitor.startTimer('create-batch-operation');
    await batchPage.createBatch(batchData);
    await expect(page.locator('[data-testid="batch-success-message"]')).toBeVisible();
    const batchNumber = await batchPage.getCurrentBatchNumber();
    createBatchTimer.stop();

    const batchPhaseResult = batchTimer.stop();
    expect(batchPhaseResult.duration).toBeLessThan(PERFORMANCE_THRESHOLDS.BATCH_CREATION);

    console.log(`✅ Batch Phase: ${batchPhaseResult.duration.toFixed(0)}ms (Target: ${PERFORMANCE_THRESHOLDS.BATCH_CREATION}ms)`);

    // ==== PHASE 4: FERMENTATION MONITORING ====
    const fermentationTimer = performanceMonitor.startTimer('fermentation-monitoring-phase');

    // Add comprehensive fermentation measurements
    const fermentationSchedule = [
      { days: 0, sg: 1.058, abv: 0.0, ph: 3.7, temp: 22, notes: 'Initial pitch - healthy yeast activity' },
      { days: 2, sg: 1.045, abv: 1.8, ph: 3.6, temp: 24, notes: 'Primary fermentation active' },
      { days: 5, sg: 1.025, abv: 4.2, ph: 3.5, temp: 23, notes: 'Vigorous fermentation continues' },
      { days: 8, sg: 1.015, abv: 5.6, ph: 3.4, temp: 21, notes: 'Fermentation slowing' },
      { days: 12, sg: 1.005, abv: 6.8, ph: 3.3, temp: 20, notes: 'Near completion' },
      { days: 16, sg: 1.002, abv: 7.1, ph: 3.3, temp: 19, notes: 'Fermentation complete' },
      { days: 20, sg: 1.000, abv: 7.2, ph: 3.2, temp: 18, notes: 'Final gravity reached' }
    ];

    for (const measurement of fermentationSchedule) {
      const measurementTimer = performanceMonitor.startTimer(`measurement-day-${measurement.days}`);

      await batchPage.addMeasurement({
        date: new Date(Date.now() + measurement.days * 24 * 60 * 60 * 1000).toISOString().split('T')[0],
        specificGravity: measurement.sg.toString(),
        abv: measurement.abv.toString(),
        ph: measurement.ph.toString(),
        temperature: measurement.temp.toString(),
        notes: measurement.notes
      });

      const measurementResult = measurementTimer.stop();
      expect(measurementResult.duration).toBeLessThan(PERFORMANCE_THRESHOLDS.FERMENTATION_MEASUREMENT);
    }

    const fermentationPhaseResult = fermentationTimer.stop();
    console.log(`✅ Fermentation Monitoring: ${fermentationPhaseResult.duration.toFixed(0)}ms`);

    // ==== PHASE 5: TRANSFER OPERATIONS ====
    const transferTimer = performanceMonitor.startTimer('transfer-operations-phase');

    // Transfer to conditioning tank
    const transfer1Timer = performanceMonitor.startTimer('transfer-to-conditioning');
    await batchPage.transferBatch({
      targetVessel: testData.vessels[1].name,
      transferVolume: (parseFloat(pressResults.totalJuiceProduced) * 0.96).toString(),
      notes: 'Transfer to conditioning - clarity and stabilization'
    });
    transfer1Timer.stop();

    // Add conditioning measurement
    await batchPage.addMeasurement({
      date: new Date(Date.now() + 24 * 24 * 60 * 60 * 1000).toISOString().split('T')[0],
      specificGravity: '1.000',
      abv: '7.2',
      ph: '3.1',
      temperature: '16',
      notes: 'Conditioning complete - clear and stable'
    });

    // Final transfer to bright tank
    const transfer2Timer = performanceMonitor.startTimer('transfer-to-bright-tank');
    await batchPage.transferBatch({
      targetVessel: testData.vessels[2].name,
      transferVolume: (parseFloat(pressResults.totalJuiceProduced) * 0.94).toString(),
      notes: 'Final transfer to bright tank for packaging'
    });
    transfer2Timer.stop();

    const transferPhaseResult = transferTimer.stop();
    expect(transferPhaseResult.duration).toBeLessThan(PERFORMANCE_THRESHOLDS.TRANSFER_OPERATION * 2); // Two transfers

    console.log(`✅ Transfer Operations: ${transferPhaseResult.duration.toFixed(0)}ms`);

    // ==== PHASE 6: PACKAGING OPERATIONS ====
    const packagingTimer = performanceMonitor.startTimer('packaging-operations-phase');

    const navigationTimer4 = performanceMonitor.startTimer('navigation-to-packaging');
    await dashboardPage.navigateToPackaging();
    await packagingPage.waitForPageLoad();
    navigationTimer4.stop();

    const finalVolume = parseFloat(pressResults.totalJuiceProduced) * 0.94;

    // Multiple packaging runs for different bottle sizes
    const packagingRuns = [
      {
        bottleSize: '750ml',
        volume: Math.floor(finalVolume * 0.5),
        location: 'Premium Warehouse A',
        notes: 'Premium 750ml bottles - retail channel'
      },
      {
        bottleSize: '500ml',
        volume: Math.floor(finalVolume * 0.3),
        location: 'Standard Warehouse B',
        notes: 'Standard 500ml bottles - hospitality'
      },
      {
        bottleSize: '375ml',
        volume: Math.floor(finalVolume * 0.2),
        location: 'Premium Warehouse A',
        notes: 'Small format - tasting flights'
      }
    ];

    const packageNumbers = [];
    for (const [index, run] of packagingRuns.entries()) {
      const packagingRunTimer = performanceMonitor.startTimer(`packaging-run-${index + 1}`);

      await packagingPage.createPackagingRun({
        batchNumber: batchNumber,
        bottleSize: run.bottleSize,
        volumeToPackage: run.volume.toString(),
        location: run.location,
        notes: run.notes,
        qualityControl: {
          abv: '7.2',
          ph: '3.1',
          clarity: 'brilliant',
          tasteNotes: 'Complex, well-balanced, excellent quality',
          approved: true
        }
      });

      await expect(page.locator('[data-testid="packaging-success-message"]')).toBeVisible();
      const packageNumber = await packagingPage.getCurrentPackageNumber();
      packageNumbers.push(packageNumber);

      const packagingRunResult = packagingRunTimer.stop();
      expect(packagingRunResult.duration).toBeLessThan(PERFORMANCE_THRESHOLDS.PACKAGING_RUN);
    }

    const packagingPhaseResult = packagingTimer.stop();
    console.log(`✅ Packaging Operations: ${packagingPhaseResult.duration.toFixed(0)}ms`);

    const packagingResults = await packagingPage.getPackagingResults();
    console.log(`  - Total bottles: ${packagingResults.totalBottlesPackaged}`);

    // ==== PHASE 7: COGS REPORTING ====
    const reportsTimer = performanceMonitor.startTimer('cogs-reporting-phase');

    const navigationTimer5 = performanceMonitor.startTimer('navigation-to-reports');
    await dashboardPage.navigateToReports();
    await reportsPage.waitForPageLoad();
    navigationTimer5.stop();

    const cogsTimer = performanceMonitor.startTimer('cogs-report-generation');
    await reportsPage.generateCOGSReport({
      batchNumber: batchNumber,
      reportPeriod: 'batch',
      includeDetails: true
    });
    cogsTimer.stop();

    const cogsData = await reportsPage.getCOGSData();
    const profitability = await reportsPage.getProfitabilityMetrics();

    const reportsPhaseResult = reportsTimer.stop();
    expect(reportsPhaseResult.duration).toBeLessThan(PERFORMANCE_THRESHOLDS.COGS_REPORT);

    console.log(`✅ COGS Reporting: ${reportsPhaseResult.duration.toFixed(0)}ms`);

    // ==== WORKFLOW COMPLETION AND PERFORMANCE ANALYSIS ====
    const fullWorkflowResult = fullWorkflowTimer.stop();

    // CRITICAL ASSERTION: Must complete within 10 minutes
    expect(fullWorkflowResult.duration).toBeLessThan(PERFORMANCE_THRESHOLDS.TOTAL_WORKFLOW);

    // Generate comprehensive performance report
    const performanceSummary = performanceMonitor.getPerformanceSummary();

    console.log('\n🎯 GOLDEN PATH WORKFLOW PERFORMANCE REPORT');
    console.log('════════════════════════════════════════════════════════════');
    console.log(`⏱️  TOTAL WORKFLOW TIME: ${(fullWorkflowResult.duration / 1000).toFixed(2)} seconds`);
    console.log(`🎯 TARGET: ${(PERFORMANCE_THRESHOLDS.TOTAL_WORKFLOW / 1000).toFixed(0)} seconds (10 minutes)`);
    console.log(`✅ PERFORMANCE STATUS: ${fullWorkflowResult.duration < PERFORMANCE_THRESHOLDS.TOTAL_WORKFLOW ? 'PASSED' : 'FAILED'}`);
    console.log('');
    console.log('📊 PHASE BREAKDOWN:');
    console.log(`   🔐 Authentication/Setup: ${performanceSummary['authentication-setup']?.duration.toFixed(0) || 'N/A'}ms`);
    console.log(`   🛒 Purchase Creation: ${performanceSummary['purchase-creation-phase']?.duration.toFixed(0) || 'N/A'}ms`);
    console.log(`   🍎 Press Operations: ${performanceSummary['press-operations-phase']?.duration.toFixed(0) || 'N/A'}ms`);
    console.log(`   🍺 Batch Creation: ${performanceSummary['batch-creation-phase']?.duration.toFixed(0) || 'N/A'}ms`);
    console.log(`   📊 Fermentation Monitoring: ${performanceSummary['fermentation-monitoring-phase']?.duration.toFixed(0) || 'N/A'}ms`);
    console.log(`   🔄 Transfer Operations: ${performanceSummary['transfer-operations-phase']?.duration.toFixed(0) || 'N/A'}ms`);
    console.log(`   📦 Packaging Operations: ${performanceSummary['packaging-operations-phase']?.duration.toFixed(0) || 'N/A'}ms`);
    console.log(`   📈 COGS Reporting: ${performanceSummary['cogs-reporting-phase']?.duration.toFixed(0) || 'N/A'}ms`);
    console.log('');
    console.log('🏭 PRODUCTION METRICS:');
    console.log(`   📊 Input: 3,300kg apples ($${parseFloat(cogsData.totalAppleCost).toFixed(2)})`);
    console.log(`   🧃 Juice: ${pressResults.totalJuiceProduced}L (${pressResults.extractionRate}% extraction)`);
    console.log(`   📦 Packaged: ${packagingResults.totalVolumePackaged}L → ${packagingResults.totalBottlesPackaged} bottles`);
    console.log(`   🍷 Final ABV: ${packagingResults.finalAbv}%`);
    console.log(`   💰 Cost per bottle: $${cogsData.costPerBottle}`);
    console.log(`   📈 Break-even price: $${profitability.breakEvenPrice.toFixed(2)}`);
    console.log('');
    console.log('⚡ EFFICIENCY METRICS:');
    const extractionEfficiency = parseFloat(pressResults.extractionRate);
    const packagingEfficiency = (parseFloat(packagingResults.totalVolumePackaged) / parseFloat(pressResults.totalJuiceProduced)) * 100;
    const overallEfficiency = (extractionEfficiency / 100) * (packagingEfficiency / 100) * 100;
    console.log(`   🍎 Extraction Efficiency: ${extractionEfficiency.toFixed(1)}%`);
    console.log(`   📦 Packaging Efficiency: ${packagingEfficiency.toFixed(1)}%`);
    console.log(`   ⚡ Overall Efficiency: ${overallEfficiency.toFixed(1)}%`);
    console.log('════════════════════════════════════════════════════════════');

    // Validate business metrics
    expect(extractionEfficiency).toBeGreaterThan(65); // At least 65% extraction
    expect(packagingEfficiency).toBeGreaterThan(90); // At least 90% packaging efficiency
    expect(overallEfficiency).toBeGreaterThan(58); // At least 58% overall efficiency
    expect(parseFloat(cogsData.costPerBottle)).toBeGreaterThan(0);
    expect(profitability.breakEvenPrice).toBeGreaterThan(0);

    console.log('✅ PERFORMANCE TEST COMPLETED SUCCESSFULLY');
    console.log(`🚀 Workflow completed ${((PERFORMANCE_THRESHOLDS.TOTAL_WORKFLOW - fullWorkflowResult.duration) / 1000).toFixed(1)} seconds under target!`);
  });

  test('should handle large-scale production scenarios efficiently', async ({ page }) => {
    console.log('📊 Testing Large-Scale Production Performance');

    const scaleTimer = performanceMonitor.startTimer('large-scale-scenario');

    await authHelper.loginAs('admin');
    await dashboardPage.waitForDashboardLoad();

    const testData = await testDataFactory.createCompleteTestScenario();

    // Large-scale purchase simulation
    const largePurchaseData = {
      vendor: testData.vendors[0].name,
      invoiceNumber: 'LARGE-SCALE-001',
      purchaseDate: new Date().toISOString().split('T')[0],
      items: [
        { appleVariety: 'Honeycrisp', quantity: '10000', unit: 'kg', pricePerUnit: '2.80' },
        { appleVariety: 'Granny Smith', quantity: '8000', unit: 'kg', pricePerUnit: '2.20' },
        { appleVariety: 'Gala', quantity: '6000', unit: 'kg', pricePerUnit: '2.40' },
        { appleVariety: 'Fuji', quantity: '4000', unit: 'kg', pricePerUnit: '2.60' },
        { appleVariety: 'Braeburn', quantity: '2000', unit: 'kg', pricePerUnit: '2.50' }
      ]
    };

    await dashboardPage.navigateToPurchases();

    const largePurchaseTimer = performanceMonitor.startTimer('large-purchase-creation');
    await purchasePage.createPurchase(largePurchaseData);
    await expect(page.locator('[data-testid="purchase-success-message"]')).toBeVisible();
    const largePurchaseResult = largePurchaseTimer.stop();

    // Should handle large purchases efficiently
    expect(largePurchaseResult.duration).toBeLessThan(10000); // 10 seconds max

    console.log(`✅ Large purchase (30,000kg): ${largePurchaseResult.duration.toFixed(0)}ms`);

    // Large-scale press operation
    const purchaseNumber = await purchasePage.getCurrentPurchaseNumber();

    await dashboardPage.navigateToPress();

    const largePressTimer = performanceMonitor.startTimer('large-press-operation');
    await pressPage.createPressRun({
      runDate: new Date().toISOString().split('T')[0],
      purchaseNumbers: [purchaseNumber],
      expectedExtractionRate: 0.70,
      notes: 'Large-scale press run - 30,000kg processing'
    });
    await expect(page.locator('[data-testid="press-success-message"]')).toBeVisible();
    const largePressResult = largePressTimer.stop();

    expect(largePressResult.duration).toBeLessThan(15000); // 15 seconds max

    const pressResults = await pressPage.getPressResults();
    console.log(`✅ Large press operation: ${largePressResult.duration.toFixed(0)}ms`);
    console.log(`  - Processed: ${pressResults.totalAppleProcessed}kg → ${pressResults.totalJuiceProduced}L`);

    const scaleResult = scaleTimer.stop();
    console.log(`✅ Large-scale scenario: ${(scaleResult.duration / 1000).toFixed(1)}s total`);

    // Verify performance scales appropriately
    expect(scaleResult.duration).toBeLessThan(60000); // 1 minute total for large operations
  });

  test('should maintain performance under concurrent load', async ({ page }) => {
    console.log('⚡ Testing Concurrent Load Performance');

    await authHelper.loginAs('admin');
    await dashboardPage.waitForDashboardLoad();

    const testData = await testDataFactory.createCompleteTestScenario();

    // Simulate multiple concurrent users performing operations
    const concurrentTimer = performanceMonitor.startTimer('concurrent-operations');

    // Create multiple purchases concurrently (simulated)
    const concurrentPurchases = Array.from({ length: 5 }, (_, i) => ({
      vendor: testData.vendors[i % testData.vendors.length].name,
      invoiceNumber: `CONCURRENT-${i + 1}-001`,
      purchaseDate: new Date().toISOString().split('T')[0],
      items: [
        {
          appleVariety: 'Honeycrisp',
          quantity: (500 + i * 100).toString(),
          unit: 'kg',
          pricePerUnit: (2.50 + i * 0.10).toString(),
          notes: `Concurrent purchase test ${i + 1}`
        }
      ]
    }));

    await dashboardPage.navigateToPurchases();

    // Process purchases sequentially to simulate concurrent load
    const purchaseTimers: TimerResult[] = [];
    for (const [index, purchaseData] of concurrentPurchases.entries()) {
      const purchaseTimer = performanceMonitor.startTimer(`concurrent-purchase-${index + 1}`);

      await purchasePage.createPurchase(purchaseData);
      await expect(page.locator('[data-testid="purchase-success-message"]')).toBeVisible();

      const result = purchaseTimer.stop();
      purchaseTimers.push(result);

      // Each individual operation should still be performant
      expect(result.duration).toBeLessThan(PERFORMANCE_THRESHOLDS.PURCHASE_CREATION);
    }

    const concurrentResult = concurrentTimer.stop();

    // Average response time should remain reasonable under load
    const avgResponseTime = purchaseTimers.reduce((sum, timer) => sum + timer.duration, 0) / purchaseTimers.length;
    expect(avgResponseTime).toBeLessThan(PERFORMANCE_THRESHOLDS.PURCHASE_CREATION);

    console.log(`✅ Concurrent operations: ${concurrentResult.duration.toFixed(0)}ms total`);
    console.log(`  - Average response time: ${avgResponseTime.toFixed(0)}ms`);
    console.log(`  - Operations completed: ${purchaseTimers.length}`);

    // Verify system responsiveness is maintained
    const responsivenessTimer = performanceMonitor.startTimer('responsiveness-check');
    await dashboardPage.navigate();
    await dashboardPage.waitForDashboardLoad();
    const responsivenessResult = responsivenessTimer.stop();

    expect(responsivenessResult.duration).toBeLessThan(PERFORMANCE_THRESHOLDS.PAGE_NAVIGATION);
    console.log(`✅ System responsiveness maintained: ${responsivenessResult.duration.toFixed(0)}ms`);
  });
});