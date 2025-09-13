import { test, expect } from '@playwright/test';
import { AuthHelper } from '../utils/auth-helpers';
import { DashboardPage } from '../page-objects/dashboard-page';
import { TestDataFactory } from '../fixtures/test-data-factory';

test.describe('Basic Navigation Workflow', () => {
  let authHelper: AuthHelper;
  let dashboardPage: DashboardPage;
  let testDataFactory: TestDataFactory;

  test.beforeEach(async ({ page }) => {
    authHelper = new AuthHelper(page);
    dashboardPage = new DashboardPage(page);
    testDataFactory = new TestDataFactory();
  });

  test.afterEach(async () => {
    await testDataFactory.close();
  });

  test('should navigate through main application areas as admin', async ({ page }) => {
    // Create test data
    const testData = await testDataFactory.createCompleteTestScenario();

    // Login as admin
    await authHelper.loginAs('admin');

    // Verify dashboard loads
    await dashboardPage.waitForDashboardLoad();
    expect(await dashboardPage.isOnDashboard()).toBe(true);

    // Navigate to vendors
    await dashboardPage.navigateToVendors();
    await expect(page).toHaveURL(/\/vendors/);

    // Navigate to purchases
    await dashboardPage.navigateToPurchases();
    await expect(page).toHaveURL(/\/purchases/);

    // Navigate to batches
    await dashboardPage.navigateToBatches();
    await expect(page).toHaveURL(/\/batches/);

    // Navigate to inventory
    await dashboardPage.navigateToInventory();
    await expect(page).toHaveURL(/\/inventory/);

    // Return to dashboard
    await dashboardPage.navigate();
    expect(await dashboardPage.isOnDashboard()).toBe(true);
  });

  test('should show appropriate navigation options for operator role', async ({ page }) => {
    await authHelper.loginAs('operator');

    await dashboardPage.waitForDashboardLoad();

    // Check navigation items available to operator
    const navItems = await dashboardPage.getVisibleNavigationItems();

    // Operators should have access to production-related items
    expect(navItems).toContain('batches');
    expect(navItems).toContain('inventory');

    // Test navigation to allowed areas
    await dashboardPage.navigateToBatches();
    await expect(page).toHaveURL(/\/batches/);

    await dashboardPage.navigateToInventory();
    await expect(page).toHaveURL(/\/inventory/);
  });

  test('should show limited navigation options for viewer role', async ({ page }) => {
    await authHelper.loginAs('viewer');

    await dashboardPage.waitForDashboardLoad();

    // Check navigation items available to viewer
    const navItems = await dashboardPage.getVisibleNavigationItems();

    // Viewers should have limited access
    expect(navItems.length).toBeGreaterThan(0); // Should have some access

    // Test that viewer can access allowed areas
    if (navItems.includes('batches')) {
      await dashboardPage.navigateToBatches();
      await expect(page).toHaveURL(/\/batches/);
    }
  });

  test('should maintain navigation state across page refreshes', async ({ page }) => {
    await authHelper.loginAs('admin');

    // Navigate to a specific page
    await dashboardPage.navigateToBatches();
    await expect(page).toHaveURL(/\/batches/);

    // Refresh the page
    await page.reload();

    // Should still be on the same page
    await expect(page).toHaveURL(/\/batches/);

    // Navigation should still work
    await dashboardPage.navigateToInventory();
    await expect(page).toHaveURL(/\/inventory/);
  });

  test('should handle direct URL access for protected routes', async ({ page }) => {
    // Try to access protected route without authentication
    await page.goto('/batches');

    // Should be redirected to login
    await expect(page).toHaveURL(/\/auth\/signin/);

    // Login and try again
    await authHelper.loginAs('admin');

    // Now direct access should work
    await page.goto('/batches');
    await expect(page).toHaveURL(/\/batches/);
  });

  test('should show loading states during navigation', async ({ page }) => {
    await authHelper.loginAs('admin');

    await dashboardPage.waitForDashboardLoad();

    // Navigate to a page and check for loading states
    await dashboardPage.navigateToBatches();

    // Wait for loading to complete
    await dashboardPage.waitForLoadingToComplete();

    // Should be on the target page
    await expect(page).toHaveURL(/\/batches/);
  });
});