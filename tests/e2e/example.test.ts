import { test, expect } from './utils/test-helpers';

/**
 * Example E2E test to validate the setup
 * This test should be removed once real tests are implemented
 */
test.describe('E2E Setup Validation', () => {
  test('should load login page', async ({ page, loginPage }) => {
    await loginPage.navigate();

    // Check that we can load the login page
    expect(await loginPage.isOnLoginPage()).toBe(true);

    // Take screenshot for visual validation
    await expect(page).toHaveScreenshot('login-page-example.png', {
      threshold: 0.3
    });
  });

  test('should authenticate successfully', async ({ authHelper, dashboardPage }) => {
    // Login with test admin user
    await authHelper.loginAs('admin');

    // Verify we're on the dashboard
    await dashboardPage.waitForDashboardLoad();
    expect(await dashboardPage.isOnDashboard()).toBe(true);

    // Get dashboard title
    const title = await dashboardPage.getHeaderTitle();
    expect(title).toBeTruthy();
  });

  test('should create test data successfully', async ({ testDataFactory }) => {
    // Create test vendor
    const vendor = await testDataFactory.createVendor({
      name: 'E2E Test Vendor'
    });

    expect(vendor).toBeTruthy();
    expect(vendor.id).toBeTruthy();
    expect(vendor.name).toBe('E2E Test Vendor');

    // Create test user
    const user = await testDataFactory.createUser({
      role: 'operator',
      name: 'E2E Test User'
    });

    expect(user).toBeTruthy();
    expect(user.role).toBe('operator');
  });

  test('should handle visual regression testing', async ({ page, visualHelpers }) => {
    await page.goto('/');

    // Set standard viewport
    await visualHelpers.setStandardViewport();

    // Wait for visual stability
    await visualHelpers.waitForVisualStability();

    // This will create or compare against baseline
    await visualHelpers.compareFullPage('homepage-example');
  });
});