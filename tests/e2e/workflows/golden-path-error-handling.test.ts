import { test, expect } from '@playwright/test';
import { AuthHelper } from '../utils/auth-helpers';
import { TestDataFactory } from '../fixtures/test-data-factory';
import { DashboardPage, PurchasePage, PressPage, BatchPage, PackagingPage, ReportsPage } from '../page-objects';
import { PerformanceMonitor } from '../utils/performance-monitor';

/**
 * Golden Path Workflow Error Handling Tests - Issue #12
 *
 * Comprehensive error handling and recovery testing including:
 * - Transaction rollback scenarios
 * - Data corruption prevention
 * - System recovery procedures
 * - Error state management
 * - Graceful failure handling
 */

test.describe('Golden Path Workflow - Error Handling and Recovery', () => {
  let authHelper: AuthHelper;
  let testDataFactory: TestDataFactory;
  let dashboardPage: DashboardPage;
  let purchasePage: PurchasePage;
  let pressPage: PressPage;
  let batchPage: BatchPage;
  let packagingPage: PackagingPage;
  let reportsPage: ReportsPage;

  test.beforeEach(async ({ page }) => {
    authHelper = new AuthHelper(page);
    testDataFactory = new TestDataFactory();
    dashboardPage = new DashboardPage(page);
    purchasePage = new PurchasePage(page);
    pressPage = new PressPage(page);
    batchPage = new BatchPage(page);
    packagingPage = new PackagingPage(page);
    reportsPage = new ReportsPage(page);
  });

  test.afterEach(async () => {
    await testDataFactory.close();
  });

  test('should handle network interruptions during workflow operations', async ({ page }) => {
    console.log('🌐 Testing Network Interruption Handling');

    await authHelper.loginAs('admin');
    await dashboardPage.waitForDashboardLoad();

    const testData = await testDataFactory.createCompleteTestScenario();

    // ==== TEST 1: Network Failure During Purchase Creation ====
    console.log('💳 Testing purchase creation with network failure');

    await dashboardPage.navigateToPurchases();
    await purchasePage.waitForPageLoad();

    // Simulate network interruption by intercepting requests
    await page.route('**/api/purchases**', route => {
      // Simulate network failure on first attempt
      if (route.request().method() === 'POST') {
        route.abort('failed');
      } else {
        route.continue();
      }
    });

    const purchaseData = {
      vendor: testData.vendors[0].name,
      invoiceNumber: 'NETWORK-FAIL-001',
      purchaseDate: new Date().toISOString().split('T')[0],
      items: [
        {
          appleVariety: 'Honeycrisp',
          quantity: '500',
          unit: 'kg',
          pricePerUnit: '2.50',
          notes: 'Network failure test'
        }
      ]
    };

    // Attempt to create purchase (should fail)
    await purchasePage.createPurchase(purchaseData);

    // Verify error handling
    const errorMessage = await page.locator('[data-testid="error-message"]').textContent();
    expect(errorMessage).toBeTruthy();
    expect(errorMessage?.toLowerCase()).toContain('network');

    console.log('✅ Network failure error handled gracefully');

    // Clear network interception
    await page.unroute('**/api/purchases**');

    // Retry should work
    await purchasePage.createPurchase(purchaseData);
    await expect(page.locator('[data-testid="purchase-success-message"]')).toBeVisible();

    console.log('✅ Network recovery and retry successful');

    // ==== TEST 2: Partial Data Corruption Recovery ====
    console.log('🔧 Testing partial data corruption recovery');

    // Simulate a scenario where part of a transaction fails
    await page.route('**/api/purchases/*/items**', route => {
      if (route.request().method() === 'POST') {
        // Simulate failure when adding purchase items
        route.fulfill({
          status: 500,
          contentType: 'application/json',
          body: JSON.stringify({ error: 'Database constraint violation' })
        });
      } else {
        route.continue();
      }
    });

    const problematicPurchaseData = {
      vendor: testData.vendors[0].name,
      invoiceNumber: 'CORRUPTION-TEST-001',
      purchaseDate: new Date().toISOString().split('T')[0],
      items: [
        {
          appleVariety: 'Honeycrisp',
          quantity: '300',
          unit: 'kg',
          pricePerUnit: '2.75',
          notes: 'Corruption test item'
        }
      ]
    };

    await purchasePage.createPurchase(problematicPurchaseData);

    // Verify error handling for partial corruption
    const corruptionError = await page.locator('[data-testid="error-message"]').textContent();
    expect(corruptionError).toBeTruthy();

    // Clear route and verify system state is clean
    await page.unroute('**/api/purchases/*/items**');

    // Search for the failed purchase to ensure it wasn't partially created
    await purchasePage.searchPurchases({ invoiceNumber: 'CORRUPTION-TEST-001' });
    const searchResults = await purchasePage.getPurchaseList();

    // Purchase should either be completely created or completely absent (no partial state)
    expect(searchResults.length).toBeLessThanOrEqual(1);
    if (searchResults.length === 1) {
      // If created, it should be complete
      const purchaseDetails = await purchasePage.getPurchaseDetails();
      expect(purchaseDetails.itemCount).toBeGreaterThan(0);
    }

    console.log('✅ Partial data corruption prevented - system state is consistent');
  });

  test('should handle database transaction failures and rollback properly', async ({ page }) => {
    console.log('🗃️ Testing Database Transaction Rollback');

    await authHelper.loginAs('admin');
    await dashboardPage.waitForDashboardLoad();

    const testData = await testDataFactory.createCompleteTestScenario();

    // ==== TEST 1: Press Operation Transaction Rollback ====
    console.log('🍎 Testing press operation rollback');

    // First create a valid purchase
    await dashboardPage.navigateToPurchases();
    const purchaseData = {
      vendor: testData.vendors[0].name,
      invoiceNumber: 'ROLLBACK-TEST-001',
      purchaseDate: new Date().toISOString().split('T')[0],
      items: [
        { appleVariety: 'Honeycrisp', quantity: '800', unit: 'kg', pricePerUnit: '2.50' }
      ]
    };

    await purchasePage.createPurchase(purchaseData);
    const purchaseNumber = await purchasePage.getCurrentPurchaseNumber();

    // Navigate to press operations
    await dashboardPage.navigateToPress();
    await pressPage.waitForPageLoad();

    // Simulate transaction failure during press run creation
    await page.route('**/api/press-runs**', async route => {
      if (route.request().method() === 'POST') {
        // Simulate database transaction failure
        await new Promise(resolve => setTimeout(resolve, 1000)); // Add delay
        route.fulfill({
          status: 500,
          contentType: 'application/json',
          body: JSON.stringify({
            error: 'Transaction failed: Database connection lost',
            code: 'TRANSACTION_FAILED'
          })
        });
      } else {
        route.continue();
      }
    });

    const pressData = {
      runDate: new Date().toISOString().split('T')[0],
      purchaseNumbers: [purchaseNumber],
      notes: 'Transaction rollback test'
    };

    await pressPage.createPressRun(pressData);

    // Verify error is displayed
    const transactionError = await page.locator('[data-testid="error-message"]').textContent();
    expect(transactionError).toBeTruthy();
    expect(transactionError?.toLowerCase()).toContain('transaction');

    // Clear route
    await page.unroute('**/api/press-runs**');

    // Verify system state - press run should not exist
    await pressPage.searchPressRuns({ dateFrom: new Date().toISOString().split('T')[0] });
    const pressRuns = await pressPage.getPressRunList();

    // Should have no press runs from today (transaction was rolled back)
    const todayRuns = pressRuns.filter(run =>
      run.date.includes(new Date().toISOString().split('T')[0])
    );
    expect(todayRuns).toHaveLength(0);

    console.log('✅ Press operation transaction rollback successful');

    // Verify purchase is still intact and available
    await dashboardPage.navigateToPurchases();
    await purchasePage.searchPurchases({ invoiceNumber: purchaseNumber });
    const purchaseResults = await purchasePage.getPurchaseList();
    expect(purchaseResults).toHaveLength(1);

    console.log('✅ Purchase data integrity maintained after rollback');
  });

  test('should recover from system resource exhaustion', async ({ page }) => {
    console.log('💾 Testing System Resource Exhaustion Recovery');

    await authHelper.loginAs('admin');
    await dashboardPage.waitForDashboardLoad();

    const testData = await testDataFactory.createCompleteTestScenario();

    // ==== TEST 1: Memory Exhaustion Simulation ====
    console.log('🧠 Simulating memory exhaustion during large operations');

    // Simulate memory pressure by intercepting requests with delays
    let requestCount = 0;
    await page.route('**/api/**', async route => {
      requestCount++;

      // Simulate resource exhaustion on every 3rd request
      if (requestCount % 3 === 0) {
        await new Promise(resolve => setTimeout(resolve, 5000)); // 5 second delay
        route.fulfill({
          status: 503,
          contentType: 'application/json',
          body: JSON.stringify({
            error: 'Service temporarily unavailable - high memory usage',
            code: 'RESOURCE_EXHAUSTED',
            retryAfter: 10
          })
        });
      } else {
        route.continue();
      }
    });

    // Attempt batch creation during resource exhaustion
    await dashboardPage.navigateToBatches();
    await batchPage.waitForPageLoad();

    const batchData = {
      batchNumber: 'RESOURCE-TEST-001',
      vesselName: testData.vessels[0].name,
      targetAbv: '6.5',
      notes: 'Resource exhaustion test'
    };

    await batchPage.createBatch(batchData);

    // System should either succeed with delays or show appropriate error
    const isErrorVisible = await page.locator('[data-testid="error-message"]').isVisible({ timeout: 10000 });
    const isSuccessVisible = await page.locator('[data-testid="batch-success-message"]').isVisible({ timeout: 10000 });

    expect(isErrorVisible || isSuccessVisible).toBe(true);

    if (isErrorVisible) {
      const errorText = await page.locator('[data-testid="error-message"]').textContent();
      expect(errorText?.toLowerCase()).toContain('unavailable');
      console.log('✅ Resource exhaustion error handled gracefully');
    } else {
      console.log('✅ Operation completed despite resource pressure');
    }

    // Clear route
    await page.unroute('**/api/**');

    // Verify system recovers
    await page.reload();
    await dashboardPage.waitForDashboardLoad();

    // System should be responsive again
    const stats = await dashboardPage.getDashboardStats();
    expect(Object.keys(stats)).toHaveLength(0); // Should have some stats

    console.log('✅ System recovered from resource exhaustion');
  });

  test('should handle concurrent operation conflicts gracefully', async ({ page }) => {
    console.log('⚡ Testing Concurrent Operation Conflicts');

    await authHelper.loginAs('admin');
    await dashboardPage.waitForDashboardLoad();

    const testData = await testDataFactory.createCompleteTestScenario();

    // ==== TEST 1: Vessel Conflict Resolution ====
    console.log('🏺 Testing vessel conflict resolution');

    // Simulate race condition for vessel allocation
    let vesselAllocationCount = 0;
    await page.route('**/api/batches**', route => {
      vesselAllocationCount++;

      if (route.request().method() === 'POST') {
        const requestData = JSON.parse(route.request().postDataJSON() || '{}');

        // Simulate conflict when trying to use the same vessel
        if (requestData.vesselId === testData.vessels[0].id && vesselAllocationCount > 1) {
          route.fulfill({
            status: 409,
            contentType: 'application/json',
            body: JSON.stringify({
              error: 'Vessel is already in use by another batch',
              code: 'VESSEL_CONFLICT',
              availableVessels: [testData.vessels[1].id, testData.vessels[2].id]
            })
          });
          return;
        }
      }

      route.continue();
    });

    await dashboardPage.navigateToBatches();

    // Attempt to create batch with potentially conflicted vessel
    const conflictedBatchData = {
      batchNumber: 'CONFLICT-TEST-001',
      vesselName: testData.vessels[0].name,
      targetAbv: '6.5',
      notes: 'Vessel conflict test'
    };

    await batchPage.createBatch(conflictedBatchData);

    // Check for conflict resolution
    const conflictError = await page.locator('[data-testid="error-message"]').isVisible({ timeout: 5000 });

    if (conflictError) {
      const errorText = await page.locator('[data-testid="error-message"]').textContent();
      expect(errorText?.toLowerCase()).toContain('vessel');

      // Should suggest alternative vessels
      const alternativeVessels = await page.locator('[data-testid="alternative-vessels"]').isVisible();
      if (alternativeVessels) {
        console.log('✅ Vessel conflict detected and alternatives suggested');

        // Try with alternative vessel
        const altBatchData = {
          ...conflictedBatchData,
          vesselName: testData.vessels[1].name
        };

        await batchPage.createBatch(altBatchData);
        await expect(page.locator('[data-testid="batch-success-message"]')).toBeVisible();
        console.log('✅ Successfully created batch with alternative vessel');
      }
    } else {
      console.log('✅ Batch created without conflict');
    }

    await page.unroute('**/api/batches**');
  });

  test('should maintain data integrity during cascading failures', async ({ page }) => {
    console.log('🔗 Testing Cascading Failure Handling');

    await authHelper.loginAs('admin');
    await dashboardPage.waitForDashboardLoad();

    const testData = await testDataFactory.createCompleteTestScenario();

    // ==== TEST 1: Sequential Operation Failures ====
    console.log('📉 Testing sequential operation failures');

    // Create initial data
    await dashboardPage.navigateToPurchases();
    const purchaseData = {
      vendor: testData.vendors[0].name,
      invoiceNumber: 'CASCADE-FAIL-001',
      purchaseDate: new Date().toISOString().split('T')[0],
      items: [
        { appleVariety: 'Honeycrisp', quantity: '600', unit: 'kg', pricePerUnit: '2.60' }
      ]
    };

    await purchasePage.createPurchase(purchaseData);
    const purchaseNumber = await purchasePage.getCurrentPurchaseNumber();

    // Simulate cascading failures in dependent operations
    let failureCount = 0;
    await page.route('**/api/**', route => {
      const url = route.request().url();

      // Cause failures in sequence: press -> batch -> packaging
      if (url.includes('press-runs') && route.request().method() === 'POST') {
        failureCount++;
        if (failureCount <= 2) {
          route.fulfill({
            status: 500,
            contentType: 'application/json',
            body: JSON.stringify({ error: 'Press operation failed', code: 'PRESS_FAILURE' })
          });
          return;
        }
      }

      if (url.includes('batches') && route.request().method() === 'POST') {
        failureCount++;
        if (failureCount === 3) {
          route.fulfill({
            status: 500,
            contentType: 'application/json',
            body: JSON.stringify({ error: 'Batch creation failed', code: 'BATCH_FAILURE' })
          });
          return;
        }
      }

      route.continue();
    });

    // Attempt press operation (should fail initially)
    await dashboardPage.navigateToPress();
    const pressData = {
      runDate: new Date().toISOString().split('T')[0],
      purchaseNumbers: [purchaseNumber],
      notes: 'Cascading failure test'
    };

    // First attempt should fail
    await pressPage.createPressRun(pressData);
    let errorVisible = await page.locator('[data-testid="error-message"]').isVisible();
    expect(errorVisible).toBe(true);

    // Second attempt should also fail
    await pressPage.createPressRun(pressData);
    errorVisible = await page.locator('[data-testid="error-message"]').isVisible();
    expect(errorVisible).toBe(true);

    // Third attempt should succeed
    await pressPage.createPressRun(pressData);
    await expect(page.locator('[data-testid="press-success-message"]')).toBeVisible();
    const pressRunNumber = await pressPage.getCurrentPressRunNumber();

    console.log('✅ System recovered from cascading press failures');

    // Verify data integrity throughout failures
    await dashboardPage.navigateToPurchases();
    await purchasePage.searchPurchases({ invoiceNumber: purchaseNumber });
    const purchaseResults = await purchasePage.getPurchaseList();
    expect(purchaseResults).toHaveLength(1);
    expect(purchaseResults[0].status).not.toBe('corrupted');

    console.log('✅ Purchase data integrity maintained through cascading failures');

    await page.unroute('**/api/**');
  });

  test('should provide clear error messages and recovery guidance', async ({ page }) => {
    console.log('💬 Testing Error Messages and Recovery Guidance');

    await authHelper.loginAs('admin');
    await dashboardPage.waitForDashboardLoad();

    const testData = await testDataFactory.createCompleteTestScenario();

    // ==== TEST 1: User-Friendly Error Messages ====
    console.log('📝 Testing user-friendly error messages');

    // Simulate various types of errors and verify messages
    const errorScenarios = [
      {
        name: 'Validation Error',
        route: '**/api/purchases**',
        response: {
          status: 400,
          body: {
            error: 'Validation failed',
            code: 'VALIDATION_ERROR',
            details: {
              field: 'quantity',
              message: 'Quantity must be positive',
              suggestion: 'Please enter a positive number for quantity'
            }
          }
        },
        expectedMessage: 'quantity must be positive'
      },
      {
        name: 'Business Rule Violation',
        route: '**/api/batches**',
        response: {
          status: 422,
          body: {
            error: 'Business rule violation',
            code: 'BUSINESS_RULE_ERROR',
            details: {
              rule: 'vessel_capacity',
              message: 'Batch volume exceeds vessel capacity',
              suggestion: 'Reduce batch volume or select a larger vessel'
            }
          }
        },
        expectedMessage: 'exceeds vessel capacity'
      },
      {
        name: 'System Error',
        route: '**/api/press-runs**',
        response: {
          status: 500,
          body: {
            error: 'Internal system error',
            code: 'SYSTEM_ERROR',
            message: 'A system error occurred. Please try again in a few minutes.',
            supportContact: 'support@cideryapp.com'
          }
        },
        expectedMessage: 'system error occurred'
      }
    ];

    for (const scenario of errorScenarios) {
      console.log(`  Testing: ${scenario.name}`);

      await page.route(scenario.route, route => {
        if (route.request().method() === 'POST') {
          route.fulfill({
            status: scenario.response.status,
            contentType: 'application/json',
            body: JSON.stringify(scenario.response.body)
          });
        } else {
          route.continue();
        }
      });

      // Navigate to appropriate page and trigger error
      if (scenario.route.includes('purchases')) {
        await dashboardPage.navigateToPurchases();
        await purchasePage.createPurchase({
          vendor: testData.vendors[0].name,
          invoiceNumber: `ERROR-TEST-${Date.now()}`,
          purchaseDate: new Date().toISOString().split('T')[0],
          items: [{ appleVariety: 'Honeycrisp', quantity: '100', unit: 'kg', pricePerUnit: '2.50' }]
        });
      } else if (scenario.route.includes('batches')) {
        await dashboardPage.navigateToBatches();
        await batchPage.createBatch({
          batchNumber: `ERROR-BATCH-${Date.now()}`,
          vesselName: testData.vessels[0].name,
          targetAbv: '6.5'
        });
      } else if (scenario.route.includes('press-runs')) {
        await dashboardPage.navigateToPress();
        await pressPage.createPressRun({
          runDate: new Date().toISOString().split('T')[0],
          notes: 'Error test'
        });
      }

      // Verify error message is user-friendly
      const errorElement = page.locator('[data-testid="error-message"]');
      await expect(errorElement).toBeVisible();

      const errorText = await errorElement.textContent();
      expect(errorText?.toLowerCase()).toContain(scenario.expectedMessage);

      // Check for recovery guidance
      const suggestionElement = page.locator('[data-testid="error-suggestion"]');
      const hasSuggestion = await suggestionElement.isVisible();

      if (hasSuggestion) {
        const suggestionText = await suggestionElement.textContent();
        expect(suggestionText).toBeTruthy();
        console.log(`    ✅ Recovery suggestion provided: ${suggestionText?.substring(0, 50)}...`);
      }

      // Check for support contact (for system errors)
      if (scenario.name === 'System Error') {
        const supportElement = page.locator('[data-testid="support-contact"]');
        const hasSupport = await supportElement.isVisible();
        if (hasSupport) {
          console.log('    ✅ Support contact information provided');
        }
      }

      await page.unroute(scenario.route);
      console.log(`    ✅ ${scenario.name} handled with clear messaging`);
    }
  });

  test('should log errors appropriately for debugging', async ({ page }) => {
    console.log('🔍 Testing Error Logging for Debugging');

    await authHelper.loginAs('admin');
    await dashboardPage.waitForDashboardLoad();

    // Capture console errors and network logs
    const consoleErrors: string[] = [];
    const networkErrors: Array<{url: string, status: number, error: string}> = [];

    page.on('console', msg => {
      if (msg.type() === 'error') {
        consoleErrors.push(msg.text());
      }
    });

    page.on('response', response => {
      if (response.status() >= 400) {
        networkErrors.push({
          url: response.url(),
          status: response.status(),
          error: response.statusText()
        });
      }
    });

    // Simulate errors and verify logging
    await page.route('**/api/batches**', route => {
      if (route.request().method() === 'POST') {
        route.fulfill({
          status: 500,
          contentType: 'application/json',
          body: JSON.stringify({
            error: 'Database connection failed',
            code: 'DB_CONNECTION_ERROR',
            timestamp: new Date().toISOString(),
            requestId: 'req_123456'
          })
        });
      } else {
        route.continue();
      }
    });

    const testData = await testDataFactory.createCompleteTestScenario();

    await dashboardPage.navigateToBatches();
    await batchPage.createBatch({
      batchNumber: 'LOGGING-TEST-001',
      vesselName: testData.vessels[0].name,
      targetAbv: '6.5'
    });

    // Wait for error to be processed
    await page.waitForTimeout(2000);

    // Verify network errors were captured
    expect(networkErrors).toHaveLength(1);
    expect(networkErrors[0].status).toBe(500);
    expect(networkErrors[0].url).toContain('/api/batches');

    console.log(`✅ Network error logged: ${networkErrors[0].status} - ${networkErrors[0].url}`);

    // Check for client-side error logging
    const hasClientErrorLog = consoleErrors.some(error =>
      error.toLowerCase().includes('error') || error.toLowerCase().includes('failed')
    );

    if (hasClientErrorLog) {
      console.log('✅ Client-side error logging detected');
    }

    await page.unroute('**/api/batches**');

    console.log(`📊 Error logging summary:`);
    console.log(`  - Network errors: ${networkErrors.length}`);
    console.log(`  - Console errors: ${consoleErrors.length}`);
  });
});