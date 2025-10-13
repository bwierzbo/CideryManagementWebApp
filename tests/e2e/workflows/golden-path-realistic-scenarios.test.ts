import { test, expect } from '@playwright/test';
import { AuthHelper } from '../utils/auth-helpers';
import { TestDataFactory } from '../fixtures/test-data-factory';
import { DashboardPage, PurchasePage, PressPage, BatchPage, PackagingPage, ReportsPage } from '../page-objects';
import { PerformanceMonitor } from '../utils/performance-monitor';

/**
 * Golden Path Workflow Realistic Production Scenarios - Issue #12
 *
 * Real-world cidery production scenarios including:
 * - Seasonal production cycles
 * - Multi-variety apple blends
 * - Complex fermentation profiles
 * - Mixed packaging strategies
 * - Comprehensive COGS analysis
 * - Production efficiency metrics
 */

test.describe('Golden Path Workflow - Realistic Production Scenarios', () => {
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

  test('should handle fall harvest season production workflow', async ({ page }) => {
    console.log('🍂 SCENARIO: Fall Harvest Season Production');
    console.log('Complex multi-variety blend for flagship autumn cider');

    const harvestTimer = performanceMonitor.startTimer('fall-harvest-workflow');

    await authHelper.loginAs('admin');
    await dashboardPage.waitForDashboardLoad();
    const testData = await testDataFactory.createCompleteTestScenario();

    // ==== REALISTIC APPLE PROCUREMENT ====
    console.log('🍎 Phase 1: Seasonal Apple Procurement');

    const fallHarvestPurchases = [
      {
        vendor: testData.vendors[0].name,
        invoiceNumber: 'FALL-HARVEST-001',
        items: [
          { appleVariety: 'Honeycrisp', quantity: '3500', unit: 'kg', pricePerUnit: '3.20', notes: 'Peak season premium grade' },
          { appleVariety: 'Granny Smith', quantity: '2000', unit: 'kg', pricePerUnit: '2.80', notes: 'Tartness and structure' }
        ]
      },
      {
        vendor: testData.vendors[1].name,
        invoiceNumber: 'FALL-HARVEST-002',
        items: [
          { appleVariety: 'Gala', quantity: '1800', unit: 'kg', pricePerUnit: '2.90', notes: 'Sweetness balance' },
          { appleVariety: 'Fuji', quantity: '1200', unit: 'kg', pricePerUnit: '3.10', notes: 'Aromatic complexity' }
        ]
      },
      {
        vendor: testData.vendors[0].name,
        invoiceNumber: 'FALL-HARVEST-003',
        items: [
          { appleVariety: 'Braeburn', quantity: '800', unit: 'kg', pricePerUnit: '2.70', notes: 'Spice notes' },
          { appleVariety: 'Newton Pippin', quantity: '400', unit: 'kg', pricePerUnit: '3.50', notes: 'Heritage variety complexity' }
        ]
      }
    ];

    await dashboardPage.navigateToPurchases();

    const purchaseNumbers = [];
    let totalAppleCost = 0;
    let totalAppleKg = 0;

    for (const purchase of fallHarvestPurchases) {
      const purchaseData = {
        ...purchase,
        purchaseDate: new Date().toISOString().split('T')[0]
      };

      await purchasePage.createPurchase(purchaseData);
      await expect(page.locator('[data-testid="purchase-success-message"]')).toBeVisible();

      const purchaseNumber = await purchasePage.getCurrentPurchaseNumber();
      purchaseNumbers.push(purchaseNumber);

      // Calculate totals for validation
      for (const item of purchase.items) {
        totalAppleCost += parseFloat(item.quantity) * parseFloat(item.pricePerUnit);
        totalAppleKg += parseFloat(item.quantity);
      }
    }

    console.log(`✅ Procured ${totalAppleKg}kg apples from ${fallHarvestPurchases.length} vendors`);
    console.log(`💰 Total apple cost: $${totalAppleCost.toFixed(2)}`);

    // ==== COMPLEX PRESSING OPERATIONS ====
    console.log('🍎 Phase 2: Complex Multi-Variety Pressing');

    await dashboardPage.navigateToPress();

    // Create separate press runs for different apple characteristics
    const pressRuns = [
      {
        name: 'Primary Fruit Press',
        purchases: [purchaseNumbers[0], purchaseNumbers[1]], // Honeycrisp, Granny Smith, Gala, Fuji
        expectedExtraction: 0.72,
        notes: 'Primary fruit blend - body and structure'
      },
      {
        name: 'Heritage Character Press',
        purchases: [purchaseNumbers[2]], // Braeburn, Newton Pippin
        expectedExtraction: 0.68,
        notes: 'Heritage varieties - complexity and spice'
      }
    ];

    const pressRunNumbers = [];
    let totalJuiceProduced = 0;

    for (const [index, pressRun] of pressRuns.entries()) {
      await pressPage.createPressRun({
        runDate: new Date(Date.now() + index * 24 * 60 * 60 * 1000).toISOString().split('T')[0],
        purchaseNumbers: pressRun.purchases,
        expectedExtractionRate: pressRun.expectedExtraction,
        notes: pressRun.notes
      });

      await expect(page.locator('[data-testid="press-success-message"]')).toBeVisible();
      const pressRunNumber = await pressPage.getCurrentPressRunNumber();
      pressRunNumbers.push(pressRunNumber);

      const pressResults = await pressPage.getPressResults();
      totalJuiceProduced += parseFloat(pressResults.totalJuiceProduced);

      console.log(`  ✅ ${pressRun.name}: ${pressResults.totalJuiceProduced}L (${pressResults.extractionRate}%)`);
    }

    // ==== FLAGSHIP BATCH CREATION ====
    console.log('🍺 Phase 3: Flagship Fall Blend Batch');

    await dashboardPage.navigateToBatches();

    const flagshipBatch = {
      batchNumber: 'FALL-FLAGSHIP-2024',
      vesselName: testData.vessels[0].name,
      targetAbv: '6.8',
      notes: 'Fall Harvest Flagship - Complex multi-variety blend with heritage character'
    };

    await batchPage.createBatch(flagshipBatch);
    await expect(page.locator('[data-testid="batch-success-message"]')).toBeVisible();
    const batchNumber = await batchPage.getCurrentBatchNumber();

    const batchDetails = await batchPage.getBatchDetails();
    console.log(`✅ Created flagship batch: ${batchDetails.initialVolume}L initial volume`);

    // ==== COMPLEX FERMENTATION PROFILE ====
    console.log('📊 Phase 4: Complex Fermentation Management');

    // Realistic fermentation progression for complex blend
    const fermentationProfile = [
      { days: 0, sg: 1.062, abv: 0.0, ph: 3.8, temp: 20, notes: 'Yeast pitched - slow start expected with heritage varieties' },
      { days: 1, sg: 1.058, abv: 0.5, ph: 3.7, temp: 22, notes: 'Fermentation beginning - good yeast activity' },
      { days: 3, sg: 1.048, abv: 1.9, ph: 3.6, temp: 24, notes: 'Primary fermentation active - complex aroma development' },
      { days: 6, sg: 1.035, abv: 3.5, ph: 3.5, temp: 25, notes: 'Vigorous fermentation - heritage variety character emerging' },
      { days: 9, sg: 1.025, abv: 4.8, ph: 3.4, temp: 23, notes: 'Fermentation steady - spice notes developing' },
      { days: 13, sg: 1.015, abv: 6.0, ph: 3.3, temp: 21, notes: 'Fermentation slowing - complexity building' },
      { days: 17, sg: 1.008, abv: 6.5, ph: 3.2, temp: 19, notes: 'Approaching completion - excellent balance' },
      { days: 21, sg: 1.002, abv: 6.7, ph: 3.2, temp: 18, notes: 'Near final gravity - heritage character prominent' },
      { days: 25, sg: 1.000, abv: 6.8, ph: 3.1, temp: 17, notes: 'Fermentation complete - exceptional complexity achieved' }
    ];

    for (const measurement of fermentationProfile) {
      await batchPage.addMeasurement({
        date: new Date(Date.now() + measurement.days * 24 * 60 * 60 * 1000).toISOString().split('T')[0],
        specificGravity: measurement.sg.toString(),
        abv: measurement.abv.toString(),
        ph: measurement.ph.toString(),
        temperature: measurement.temp.toString(),
        notes: measurement.notes
      });
    }

    console.log('✅ Complex fermentation profile completed - 25 day cycle');

    // ==== CONDITIONING AND CLARIFICATION ====
    console.log('🔄 Phase 5: Conditioning and Clarification');

    // Transfer to conditioning
    const conditioningVolume = parseFloat(batchDetails.initialVolume) * 0.96; // Account for CO2 and evaporation
    await batchPage.transferBatch({
      targetVessel: testData.vessels[1].name,
      transferVolume: conditioningVolume.toString(),
      notes: 'Transfer to conditioning - cold stabilization and natural clarification'
    });

    // Extended conditioning period
    await batchPage.addMeasurement({
      date: new Date(Date.now() + 35 * 24 * 60 * 60 * 1000).toISOString().split('T')[0],
      specificGravity: '1.000',
      abv: '6.8',
      ph: '3.0',
      temperature: '4',
      notes: 'Cold conditioning complete - brilliant clarity, exceptional character'
    });

    // Final transfer to bright tank
    const finalVolume = conditioningVolume * 0.98; // Final volume loss
    await batchPage.transferBatch({
      targetVessel: testData.vessels[2].name,
      transferVolume: finalVolume.toString(),
      notes: 'Final transfer - ready for premium packaging'
    });

    console.log(`✅ Conditioning complete - ${finalVolume.toFixed(0)}L ready for packaging`);

    // ==== PREMIUM PACKAGING STRATEGY ====
    console.log('📦 Phase 6: Premium Multi-Format Packaging');

    await dashboardPage.navigateToPackaging();

    const packagingStrategy = [
      {
        bottleSize: '750ml',
        volume: Math.floor(finalVolume * 0.4),
        location: 'Premium Cold Storage A',
        notes: 'Limited edition 750ml - retail and restaurant',
        qc: { abv: '6.8', ph: '3.0', clarity: 'brilliant', tasteNotes: 'Complex, heritage character, exceptional quality', approved: true }
      },
      {
        bottleSize: '500ml',
        volume: Math.floor(finalVolume * 0.35),
        location: 'Standard Warehouse B',
        notes: 'Standard format - broad distribution',
        qc: { abv: '6.8', ph: '3.0', clarity: 'brilliant', tasteNotes: 'Well-balanced, food-friendly', approved: true }
      },
      {
        bottleSize: '375ml',
        volume: Math.floor(finalVolume * 0.15),
        location: 'Premium Cold Storage A',
        notes: 'Small format - tasting rooms and gifts',
        qc: { abv: '6.8', ph: '3.0', clarity: 'brilliant', tasteNotes: 'Elegant presentation format', approved: true }
      },
      {
        bottleSize: '1000ml',
        volume: Math.floor(finalVolume * 0.1),
        location: 'Premium Cold Storage A',
        notes: 'Magnum format - special occasions',
        qc: { abv: '6.8', ph: '3.0', clarity: 'brilliant', tasteNotes: 'Premium magnum presentation', approved: true }
      }
    ];

    let totalBottlesPackaged = 0;
    let totalVolumePackaged = 0;

    for (const packaging of packagingStrategy) {
      await packagingPage.createBottleRun({
        batchNumber: batchNumber,
        bottleSize: packaging.bottleSize,
        volumeToPackage: packaging.volume.toString(),
        location: packaging.location,
        notes: packaging.notes,
        qualityControl: packaging.qc
      });

      await expect(page.locator('[data-testid="packaging-success-message"]')).toBeVisible();

      const packagingResults = await packagingPage.getPackagingResults();
      totalBottlesPackaged += packagingResults.totalBottlesPackaged;
      totalVolumePackaged += parseFloat(packagingResults.totalVolumePackaged);

      console.log(`  ✅ ${packaging.bottleSize}: ${packagingResults.totalBottlesPackaged} bottles (${packaging.volume}L)`);
    }

    console.log(`✅ Total packaged: ${totalBottlesPackaged} bottles, ${totalVolumePackaged.toFixed(0)}L`);

    // ==== COMPREHENSIVE COGS ANALYSIS ====
    console.log('📈 Phase 7: Comprehensive COGS Analysis');

    await dashboardPage.navigateToReports();

    await reportsPage.generateCOGSReport({
      batchNumber: batchNumber,
      reportPeriod: 'batch',
      includeDetails: true
    });

    const cogsData = await reportsPage.getCOGSData();
    const profitability = await reportsPage.getProfitabilityMetrics();

    // Validate COGS accuracy for complex scenario
    expect(parseFloat(cogsData.totalAppleCost)).toBeCloseTo(totalAppleCost, 1);
    expect(parseFloat(cogsData.costPerBottle)).toBeGreaterThan(0);
    expect(profitability.breakEvenPrice).toBeGreaterThan(0);

    const harvestResult = harvestTimer.stop();

    // ==== SCENARIO COMPLETION ANALYSIS ====
    console.log('\n🍂 FALL HARVEST SCENARIO COMPLETED');
    console.log('═══════════════════════════════════════════════════════');
    console.log(`⏱️  Total Workflow Time: ${(harvestResult.duration / 1000 / 60).toFixed(1)} minutes`);
    console.log('');
    console.log('📊 PRODUCTION SUMMARY:');
    console.log(`   🍎 Apple Input: ${totalAppleKg}kg (6 varieties)`);
    console.log(`   💰 Apple Cost: $${totalAppleCost.toFixed(2)}`);
    console.log(`   🧃 Juice Produced: ${totalJuiceProduced.toFixed(0)}L`);
    console.log(`   📦 Final Packaged: ${totalVolumePackaged.toFixed(0)}L → ${totalBottlesPackaged} bottles`);
    console.log(`   🍷 Final ABV: 6.8%`);
    console.log('');
    console.log('💰 FINANCIAL ANALYSIS:');
    console.log(`   📊 Total Production Cost: $${cogsData.totalCost}`);
    console.log(`   💵 Cost per Liter: $${cogsData.costPerLiter}`);
    console.log(`   🍾 Cost per Bottle: $${cogsData.costPerBottle}`);
    console.log(`   📈 Break-even Price: $${profitability.breakEvenPrice.toFixed(2)}`);
    console.log(`   💎 Recommended Retail: $${profitability.recommendedSalePrice.toFixed(2)}`);
    console.log('');
    console.log('⚡ EFFICIENCY METRICS:');
    const extractionRate = (totalJuiceProduced / totalAppleKg) * 100;
    const packagingRate = (totalVolumePackaged / totalJuiceProduced) * 100;
    const overallEfficiency = (extractionRate / 100) * (packagingRate / 100) * 100;
    console.log(`   🍎 Extraction: ${extractionRate.toFixed(1)}%`);
    console.log(`   📦 Packaging: ${packagingRate.toFixed(1)}%`);
    console.log(`   ⚡ Overall: ${overallEfficiency.toFixed(1)}%`);
    console.log('═══════════════════════════════════════════════════════');

    // Validate realistic scenario metrics
    expect(extractionRate).toBeGreaterThan(65);
    expect(packagingRate).toBeGreaterThan(92);
    expect(overallEfficiency).toBeGreaterThan(60);
    expect(parseFloat(cogsData.costPerBottle)).toBeLessThan(10); // Reasonable cost per bottle
    expect(profitability.recommendedSalePrice).toBeGreaterThan(parseFloat(cogsData.costPerBottle) * 2); // Healthy margin
  });

  test('should handle craft production limited release workflow', async ({ page }) => {
    console.log('🎨 SCENARIO: Craft Production Limited Release');
    console.log('Small batch artisanal cider with premium positioning');

    const craftTimer = performanceMonitor.startTimer('craft-production-workflow');

    await authHelper.loginAs('admin');
    await dashboardPage.waitForDashboardLoad();
    const testData = await testDataFactory.createCompleteTestScenario();

    // ==== PREMIUM INGREDIENT SOURCING ====
    console.log('🌟 Phase 1: Premium Ingredient Sourcing');

    const craftPurchase = {
      vendor: testData.vendors[0].name,
      invoiceNumber: 'CRAFT-LIMITED-001',
      purchaseDate: new Date().toISOString().split('T')[0],
      items: [
        { appleVariety: 'Newton Pippin', quantity: '500', unit: 'kg', pricePerUnit: '4.50', notes: 'Heritage variety - estate grown' },
        { appleVariety: 'Esopus Spitzenburg', quantity: '300', unit: 'kg', pricePerUnit: '5.20', notes: 'Rare heirloom - hand picked' },
        { appleVariety: 'Ashmead\'s Kernel', quantity: '200', unit: 'kg', pricePerUnit: '4.80', notes: 'English heritage - exceptional character' }
      ]
    };

    await dashboardPage.navigateToPurchases();
    await purchasePage.createPurchase(craftPurchase);
    await expect(page.locator('[data-testid="purchase-success-message"]')).toBeVisible();
    const purchaseNumber = await purchasePage.getCurrentPurchaseNumber();

    const totalPremiumCost = 500 * 4.50 + 300 * 5.20 + 200 * 4.80;
    console.log(`✅ Premium heritage apples: 1000kg, $${totalPremiumCost.toFixed(2)}`);

    // ==== ARTISANAL PRESSING ====
    console.log('🎨 Phase 2: Artisanal Small Batch Pressing');

    await dashboardPage.navigateToPress();

    await pressPage.createPressRun({
      runDate: new Date().toISOString().split('T')[0],
      purchaseNumbers: [purchaseNumber],
      expectedExtractionRate: 0.65, // Lower extraction for quality
      notes: 'Artisanal press - gentle extraction for heritage varieties'
    });

    await expect(page.locator('[data-testid="press-success-message"]')).toBeVisible();
    const pressResults = await pressPage.getPressResults();

    console.log(`✅ Artisanal pressing: ${pressResults.totalJuiceProduced}L (${pressResults.extractionRate}% extraction)`);

    // ==== LIMITED EDITION BATCH ====
    console.log('🍺 Phase 3: Limited Edition Batch Creation');

    await dashboardPage.navigateToBatches();

    const limitedBatch = {
      batchNumber: 'LE-HERITAGE-001',
      vesselName: testData.vessels[0].name,
      targetAbv: '7.5', // Higher ABV for premium positioning
      notes: 'Limited Edition Heritage Blend - 500 bottle run'
    };

    await batchPage.createBatch(limitedBatch);
    await expect(page.locator('[data-testid="batch-success-message"]')).toBeVisible();
    const batchNumber = await batchPage.getCurrentBatchNumber();

    // ==== EXTENDED FERMENTATION AND AGING ====
    console.log('⏳ Phase 4: Extended Fermentation and Aging');

    const extendedFermentation = [
      { days: 0, sg: 1.068, abv: 0.0, ph: 3.9, temp: 18, notes: 'Wild yeast fermentation started - heritage varieties' },
      { days: 5, sg: 1.055, abv: 1.8, ph: 3.8, temp: 20, notes: 'Slow wild fermentation - complex development' },
      { days: 12, sg: 1.038, abv: 4.1, ph: 3.6, temp: 19, notes: 'Primary fermentation active - unique terroir expression' },
      { days: 21, sg: 1.018, abv: 6.5, ph: 3.4, temp: 17, notes: 'Extended primary - heritage character developing' },
      { days: 35, sg: 1.008, abv: 7.2, ph: 3.2, temp: 15, notes: 'Secondary fermentation - exceptional complexity' },
      { days: 49, sg: 1.002, abv: 7.4, ph: 3.1, temp: 14, notes: 'Approaching completion - outstanding character' },
      { days: 60, sg: 1.000, abv: 7.5, ph: 3.0, temp: 12, notes: 'Fermentation complete - ready for extended aging' }
    ];

    for (const measurement of extendedFermentation) {
      await batchPage.addMeasurement({
        date: new Date(Date.now() + measurement.days * 24 * 60 * 60 * 1000).toISOString().split('T')[0],
        specificGravity: measurement.sg.toString(),
        abv: measurement.abv.toString(),
        ph: measurement.ph.toString(),
        temperature: measurement.temp.toString(),
        notes: measurement.notes
      });
    }

    console.log('✅ Extended 60-day fermentation completed');

    // ==== PREMIUM PACKAGING STRATEGY ====
    console.log('💎 Phase 5: Ultra-Premium Limited Edition Packaging');

    await dashboardPage.navigateToPackaging();

    const batchDetails = await batchPage.getBatchDetails();
    const limitedVolume = parseFloat(batchDetails.currentVolume) * 0.95; // Minimal losses for craft production

    await packagingPage.createBottleRun({
      batchNumber: batchNumber,
      bottleSize: '750ml',
      volumeToPackage: limitedVolume.toString(),
      location: 'Premium Climate Controlled',
      notes: 'Limited Edition - hand-numbered bottles, premium cork and capsule',
      qualityControl: {
        abv: '7.5',
        ph: '3.0',
        clarity: 'brilliant',
        tasteNotes: 'Exceptional heritage character, complex minerality, long finish, cellar-worthy',
        approved: true
      }
    });

    await expect(page.locator('[data-testid="packaging-success-message"]')).toBeVisible();
    const packagingResults = await packagingPage.getPackagingResults();

    console.log(`✅ Limited edition: ${packagingResults.totalBottlesPackaged} bottles packaged`);

    // ==== PREMIUM COGS ANALYSIS ====
    console.log('💰 Phase 6: Premium Product COGS Analysis');

    await dashboardPage.navigateToReports();

    await reportsPage.generateCOGSReport({
      batchNumber: batchNumber,
      reportPeriod: 'batch',
      includeDetails: true
    });

    const cogsData = await reportsPage.getCOGSData();
    const profitability = await reportsPage.getProfitabilityMetrics();

    const craftResult = craftTimer.stop();

    console.log('\n🎨 CRAFT LIMITED EDITION COMPLETED');
    console.log('═══════════════════════════════════════════════════');
    console.log(`⏱️  Total Workflow Time: ${(craftResult.duration / 1000 / 60).toFixed(1)} minutes`);
    console.log('');
    console.log('🌟 PREMIUM PRODUCTION SUMMARY:');
    console.log(`   🍎 Heritage Apples: 1000kg (3 rare varieties)`);
    console.log(`   💰 Premium Cost: $${totalPremiumCost.toFixed(2)}`);
    console.log(`   🍾 Limited Bottles: ${packagingResults.totalBottlesPackaged}`);
    console.log(`   🍷 Premium ABV: 7.5%`);
    console.log(`   ⏳ Extended Process: 60+ days fermentation`);
    console.log('');
    console.log('💎 PREMIUM ECONOMICS:');
    console.log(`   💵 Cost per Bottle: $${cogsData.costPerBottle}`);
    console.log(`   📈 Premium Break-even: $${profitability.breakEvenPrice.toFixed(2)}`);
    console.log(`   💎 Recommended Premium Price: $${profitability.recommendedSalePrice.toFixed(2)}`);
    console.log(`   📊 Premium Margin: ${((profitability.recommendedSalePrice - parseFloat(cogsData.costPerBottle)) / profitability.recommendedSalePrice * 100).toFixed(1)}%`);
    console.log('═══════════════════════════════════════════════════');

    // Validate premium product metrics
    expect(parseFloat(cogsData.costPerBottle)).toBeGreaterThan(5); // Premium cost structure
    expect(profitability.recommendedSalePrice).toBeGreaterThan(15); // Premium retail price
    expect(packagingResults.totalBottlesPackaged).toBeLessThan(1000); // Limited production
    expect(parseFloat(packagingResults.finalAbv)).toBeGreaterThan(7); // Premium strength
  });

  test('should validate COGS calculation accuracy across different production scenarios', async ({ page }) => {
    console.log('🧮 SCENARIO: COGS Calculation Validation');
    console.log('Comprehensive cost analysis accuracy testing');

    await authHelper.loginAs('admin');
    await dashboardPage.waitForDashboardLoad();
    const testData = await testDataFactory.createCompleteTestScenario();

    // ==== TEST SCENARIO: KNOWN COST STRUCTURE ====
    const knownCosts = {
      apples: {
        honeycrisp: { quantity: 1000, pricePerKg: 2.50 },
        grannySmith: { quantity: 600, pricePerKg: 2.00 }
      },
      expectedExtraction: 0.70,
      expectedPackagingEfficiency: 0.95,
      expectedBottleSize: '750ml'
    };

    const totalAppleCost = (knownCosts.apples.honeycrisp.quantity * knownCosts.apples.honeycrisp.pricePerKg) +
                          (knownCosts.apples.grannySmith.quantity * knownCosts.apples.grannySmith.pricePerKg);

    console.log(`📊 Test scenario: $${totalAppleCost} apple cost, ${knownCosts.apples.honeycrisp.quantity + knownCosts.apples.grannySmith.quantity}kg total`);

    // Create test purchase
    await dashboardPage.navigateToPurchases();

    const cogsPurchase = {
      vendor: testData.vendors[0].name,
      invoiceNumber: 'COGS-VALIDATION-001',
      purchaseDate: new Date().toISOString().split('T')[0],
      items: [
        {
          appleVariety: 'Honeycrisp',
          quantity: knownCosts.apples.honeycrisp.quantity.toString(),
          unit: 'kg',
          pricePerUnit: knownCosts.apples.honeycrisp.pricePerKg.toString(),
          notes: 'COGS validation test'
        },
        {
          appleVariety: 'Granny Smith',
          quantity: knownCosts.apples.grannySmith.quantity.toString(),
          unit: 'kg',
          pricePerUnit: knownCosts.apples.grannySmith.pricePerKg.toString(),
          notes: 'COGS validation test'
        }
      ]
    };

    await purchasePage.createPurchase(cogsPurchase);
    const purchaseNumber = await purchasePage.getCurrentPurchaseNumber();

    // Process through to packaging
    await dashboardPage.navigateToPress();
    await pressPage.createPressRun({
      runDate: new Date().toISOString().split('T')[0],
      purchaseNumbers: [purchaseNumber],
      expectedExtractionRate: knownCosts.expectedExtraction
    });

    const pressResults = await pressPage.getPressResults();
    const actualJuiceL = parseFloat(pressResults.totalJuiceProduced);

    await dashboardPage.navigateToBatches();
    await batchPage.createBatch({
      batchNumber: 'COGS-BATCH-001',
      vesselName: testData.vessels[0].name,
      targetAbv: '6.5'
    });

    // Add final measurement
    await batchPage.addMeasurement({
      date: new Date().toISOString().split('T')[0],
      specificGravity: '1.000',
      abv: '6.5',
      ph: '3.3',
      temperature: '18',
      notes: 'Fermentation complete'
    });

    // Package the batch
    await dashboardPage.navigateToPackaging();
    const packageVolume = actualJuiceL * knownCosts.expectedPackagingEfficiency;

    await packagingPage.createBottleRun({
      batchNumber: 'COGS-BATCH-001',
      bottleSize: knownCosts.expectedBottleSize,
      volumeToPackage: packageVolume.toString(),
      location: 'COGS Test Warehouse',
      qualityControl: {
        abv: '6.5',
        ph: '3.3',
        clarity: 'clear',
        approved: true
      }
    });

    const packagingResults = await packagingPage.getPackagingResults();

    // Generate and validate COGS report
    await dashboardPage.navigateToReports();
    await reportsPage.generateCOGSReport({
      batchNumber: 'COGS-BATCH-001',
      includeDetails: true
    });

    const cogsData = await reportsPage.getCOGSData();

    console.log('\n🧮 COGS VALIDATION RESULTS');
    console.log('═════════════════════════════════════════');

    // Validate apple cost accuracy
    const reportedAppleCost = parseFloat(cogsData.totalAppleCost);
    console.log(`🍎 Apple Cost - Expected: $${totalAppleCost.toFixed(2)}, Reported: $${reportedAppleCost.toFixed(2)}`);
    expect(reportedAppleCost).toBeCloseTo(totalAppleCost, 2);

    // Validate extraction efficiency
    const reportedExtraction = parseFloat(cogsData.extractionEfficiency);
    const expectedExtractionPercent = knownCosts.expectedExtraction * 100;
    console.log(`⚗️ Extraction - Expected: ${expectedExtractionPercent}%, Reported: ${reportedExtraction}%`);
    expect(reportedExtraction).toBeCloseTo(expectedExtractionPercent, 1);

    // Validate cost per liter
    const expectedCostPerLiter = totalAppleCost / packageVolume;
    const reportedCostPerLiter = parseFloat(cogsData.costPerLiter);
    console.log(`🧃 Cost/Liter - Expected: $${expectedCostPerLiter.toFixed(2)}, Reported: $${reportedCostPerLiter.toFixed(2)}`);
    expect(reportedCostPerLiter).toBeCloseTo(expectedCostPerLiter, 2);

    // Validate cost per bottle
    const bottleSize = parseFloat(knownCosts.expectedBottleSize.replace('ml', '')) / 1000; // Convert to liters
    const expectedCostPerBottle = expectedCostPerLiter * bottleSize;
    const reportedCostPerBottle = parseFloat(cogsData.costPerBottle);
    console.log(`🍾 Cost/Bottle - Expected: $${expectedCostPerBottle.toFixed(2)}, Reported: $${reportedCostPerBottle.toFixed(2)}`);
    expect(reportedCostPerBottle).toBeCloseTo(expectedCostPerBottle, 2);

    // Validate packaging efficiency
    const reportedPackagingEfficiency = parseFloat(cogsData.packagingEfficiency);
    const expectedPackagingPercent = knownCosts.expectedPackagingEfficiency * 100;
    console.log(`📦 Packaging - Expected: ${expectedPackagingPercent}%, Reported: ${reportedPackagingEfficiency}%`);
    expect(reportedPackagingEfficiency).toBeCloseTo(expectedPackagingPercent, 1);

    // Validate bottle count accuracy
    const expectedBottles = Math.floor(packageVolume / bottleSize);
    const reportedBottles = packagingResults.totalBottlesPackaged;
    console.log(`🔢 Bottles - Expected: ${expectedBottles}, Reported: ${reportedBottles}`);
    expect(reportedBottles).toBeCloseTo(expectedBottles, 1);

    console.log('═════════════════════════════════════════');
    console.log('✅ ALL COGS CALCULATIONS VALIDATED');

    // Additional validation: Profitability calculations
    const profitability = await reportsPage.getProfitabilityMetrics();
    expect(profitability.breakEvenPrice).toBeGreaterThan(0);
    expect(profitability.recommendedSalePrice).toBeGreaterThan(profitability.breakEvenPrice);

    console.log('✅ Profitability calculations validated');
  });
});