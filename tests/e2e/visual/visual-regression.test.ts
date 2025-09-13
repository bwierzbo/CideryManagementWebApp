import { test, expect } from '@playwright/test';
import { AuthHelper } from '../utils/auth-helpers';
import { DashboardPage } from '../page-objects/dashboard-page';
import { TestDataFactory } from '../fixtures/test-data-factory';

test.describe('Visual Regression Tests', () => {
  let authHelper: AuthHelper;
  let dashboardPage: DashboardPage;
  let testDataFactory: TestDataFactory;

  test.beforeEach(async ({ page }) => {
    authHelper = new AuthHelper(page);
    dashboardPage = new DashboardPage(page);
    testDataFactory = new TestDataFactory();

    // Set viewport for consistent screenshots
    await page.setViewportSize({ width: 1280, height: 720 });
  });

  test.afterEach(async () => {
    await testDataFactory.close();
  });

  test('should match dashboard layout for admin user', async ({ page }) => {
    await authHelper.loginAs('admin');
    await dashboardPage.waitForDashboardLoad();

    // Take screenshot of full dashboard
    await expect(page).toHaveScreenshot('dashboard-admin.png', {
      fullPage: true,
      threshold: 0.3, // Allow for minor differences
    });
  });

  test('should match dashboard layout for operator user', async ({ page }) => {
    await authHelper.loginAs('operator');
    await dashboardPage.waitForDashboardLoad();

    // Take screenshot of operator dashboard
    await expect(page).toHaveScreenshot('dashboard-operator.png', {
      fullPage: true,
      threshold: 0.3,
    });
  });

  test('should match dashboard layout for viewer user', async ({ page }) => {
    await authHelper.loginAs('viewer');
    await dashboardPage.waitForDashboardLoad();

    // Take screenshot of viewer dashboard
    await expect(page).toHaveScreenshot('dashboard-viewer.png', {
      fullPage: true,
      threshold: 0.3,
    });
  });

  test('should match login page layout', async ({ page }) => {
    await page.goto('/auth/signin');
    await page.waitForLoadState('networkidle');

    // Take screenshot of login page
    await expect(page).toHaveScreenshot('login-page.png', {
      threshold: 0.3,
    });
  });

  test('should match navigation menu layout', async ({ page }) => {
    await authHelper.loginAs('admin');
    await dashboardPage.waitForDashboardLoad();

    // Focus on navigation menu
    const navMenu = page.locator('[data-testid="navigation-menu"]');
    await expect(navMenu).toHaveScreenshot('navigation-menu.png', {
      threshold: 0.3,
    });
  });

  test('should match user menu dropdown', async ({ page }) => {
    await authHelper.loginAs('admin');
    await dashboardPage.waitForDashboardLoad();

    // Open user menu
    await dashboardPage.openUserMenu();

    // Screenshot the user menu
    const userMenu = page.locator('[data-testid="user-menu-dropdown"]');
    await expect(userMenu).toHaveScreenshot('user-menu-dropdown.png', {
      threshold: 0.3,
    });
  });

  test('should match dashboard stats widgets', async ({ page }) => {
    // Create some test data for stats
    await testDataFactory.createCompleteTestScenario();

    await authHelper.loginAs('admin');
    await dashboardPage.waitForDashboardLoad();

    // Screenshot the stats section
    const statsSection = page.locator('[data-testid="dashboard-stats"]');
    await expect(statsSection).toHaveScreenshot('dashboard-stats.png', {
      threshold: 0.3,
    });
  });

  test('should match responsive layout on mobile viewport', async ({ page }) => {
    // Set mobile viewport
    await page.setViewportSize({ width: 375, height: 667 });

    await authHelper.loginAs('admin');
    await dashboardPage.waitForDashboardLoad();

    // Take mobile screenshot
    await expect(page).toHaveScreenshot('dashboard-mobile.png', {
      fullPage: true,
      threshold: 0.3,
    });
  });

  test('should match responsive layout on tablet viewport', async ({ page }) => {
    // Set tablet viewport
    await page.setViewportSize({ width: 768, height: 1024 });

    await authHelper.loginAs('admin');
    await dashboardPage.waitForDashboardLoad();

    // Take tablet screenshot
    await expect(page).toHaveScreenshot('dashboard-tablet.png', {
      fullPage: true,
      threshold: 0.3,
    });
  });

  test('should match error page layout', async ({ page }) => {
    // Try to access a non-existent page
    await page.goto('/non-existent-page');

    // Wait for error page to load
    await page.waitForLoadState('networkidle');

    // Take screenshot of error page
    await expect(page).toHaveScreenshot('error-page.png', {
      threshold: 0.3,
    });
  });

  test('should match form layouts', async ({ page }) => {
    await authHelper.loginAs('admin');

    // Navigate to a form page (e.g., create vendor)
    await page.goto('/vendors/new');
    await page.waitForLoadState('networkidle');

    // Screenshot the form
    await expect(page).toHaveScreenshot('vendor-form.png', {
      fullPage: true,
      threshold: 0.3,
    });
  });

  test('should match table layouts with data', async ({ page }) => {
    // Create test data for tables
    await testDataFactory.createWorkflowTestData(3);

    await authHelper.loginAs('admin');

    // Navigate to a table view (e.g., vendors list)
    await page.goto('/vendors');
    await page.waitForLoadState('networkidle');

    // Screenshot the table
    await expect(page).toHaveScreenshot('vendors-table.png', {
      fullPage: true,
      threshold: 0.3,
    });
  });

  test('should match loading states', async ({ page }) => {
    await authHelper.loginAs('admin');

    // Navigate to page and try to capture loading state
    await page.goto('/batches');

    // Try to capture loading spinner if it appears
    const loadingSpinner = page.locator('[data-testid="loading"]');
    if (await loadingSpinner.isVisible({ timeout: 1000 }).catch(() => false)) {
      await expect(loadingSpinner).toHaveScreenshot('loading-spinner.png');
    }

    // Wait for full load and screenshot final state
    await page.waitForLoadState('networkidle');
    await expect(page).toHaveScreenshot('batches-page.png', {
      fullPage: true,
      threshold: 0.3,
    });
  });

  test('should match modal dialogs', async ({ page }) => {
    await authHelper.loginAs('admin');
    await page.goto('/vendors');

    // Try to open a modal (e.g., delete confirmation)
    const deleteButton = page.locator('[data-testid="delete-vendor"]').first();
    if (await deleteButton.isVisible({ timeout: 5000 }).catch(() => false)) {
      await deleteButton.click();

      // Screenshot the modal
      const modal = page.locator('[data-testid="confirmation-modal"]');
      await expect(modal).toHaveScreenshot('delete-confirmation-modal.png');
    }
  });

  test('should match notification/toast messages', async ({ page }) => {
    await authHelper.loginAs('admin');

    // Trigger an action that shows a notification
    await page.goto('/vendors/new');

    // Fill and submit form to trigger success notification
    await page.fill('[data-testid="vendor-name"]', 'Test Vendor');
    await page.fill('[data-testid="vendor-email"]', 'test@vendor.com');
    await page.click('[data-testid="save-vendor"]');

    // Try to capture notification
    const notification = page.locator('[data-testid="notification"]');
    if (await notification.isVisible({ timeout: 5000 }).catch(() => false)) {
      await expect(notification).toHaveScreenshot('success-notification.png');
    }
  });
});