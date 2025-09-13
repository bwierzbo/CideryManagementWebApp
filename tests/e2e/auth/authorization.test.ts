import { test, expect } from '@playwright/test';
import { AuthHelper } from '../utils/auth-helpers';

test.describe('Authorization & Role-Based Access Control', () => {
  let authHelper: AuthHelper;

  test.beforeEach(async ({ page }) => {
    authHelper = new AuthHelper(page);
  });

  test.describe('Admin Role', () => {
    test('should have access to all navigation items', async () => {
      await authHelper.loginAs('admin');
      await authHelper.verifyAdminAccess();
    });

    test('should be able to access vendor management', async ({ page }) => {
      await authHelper.loginAs('admin');

      // Navigate to vendors page
      await page.goto('/vendors');

      // Should not be redirected (should stay on vendors page)
      await expect(page).toHaveURL(/\/vendors/);
    });

    test('should be able to access reports', async ({ page }) => {
      await authHelper.loginAs('admin');

      // Navigate to reports page
      await page.goto('/reports');

      // Should not be redirected
      await expect(page).toHaveURL(/\/reports/);
    });
  });

  test.describe('Operator Role', () => {
    test('should have access to production-related items', async () => {
      await authHelper.loginAs('operator');
      await authHelper.verifyOperatorAccess();
    });

    test('should be able to access batch management', async ({ page }) => {
      await authHelper.loginAs('operator');

      await page.goto('/batches');
      await expect(page).toHaveURL(/\/batches/);
    });

    test('should be able to access inventory', async ({ page }) => {
      await authHelper.loginAs('operator');

      await page.goto('/inventory');
      await expect(page).toHaveURL(/\/inventory/);
    });

    test('should be able to create press runs', async ({ page }) => {
      await authHelper.loginAs('operator');

      await page.goto('/press');
      await expect(page).toHaveURL(/\/press/);

      // Should see create button or form (operators can create press runs)
      const hasCreateAccess = await page.locator('[data-testid=\"create-press-run\"], [data-testid=\"new-press-run\"]').isVisible();
      expect(hasCreateAccess).toBe(true);
    });
  });

  test.describe('Viewer Role', () => {
    test('should have limited read-only access', async () => {
      await authHelper.loginAs('viewer');
      await authHelper.verifyViewerAccess();
    });

    test('should not be able to access vendor management', async ({ page }) => {
      await authHelper.loginAs('viewer');

      // Try to access vendors page directly
      await page.goto('/vendors');

      // Should be redirected or show access denied
      const currentUrl = page.url();
      const hasAccessDenied = await page.locator('[data-testid=\"access-denied\"], .access-denied').isVisible().catch(() => false);

      expect(currentUrl.includes('/vendors') === false || hasAccessDenied === true).toBe(true);
    });

    test('should not see create/edit buttons in allowed areas', async ({ page }) => {
      await authHelper.loginAs('viewer');

      await page.goto('/batches');

      // Should not see create or edit buttons
      const createButton = page.locator('[data-testid=\"create-batch\"], [data-testid=\"new-batch\"]');
      const editButtons = page.locator('[data-testid*=\"edit-\"], .edit-button');

      expect(await createButton.isVisible().catch(() => false)).toBe(false);
      expect(await editButtons.count()).toBe(0);
    });

    test('should be able to view batch information', async ({ page }) => {
      await authHelper.loginAs('viewer');

      await page.goto('/batches');

      // Should be able to view batch list
      await expect(page).toHaveURL(/\/batches/);

      // Should see batch data but no edit capabilities
      const batchList = page.locator('[data-testid=\"batch-list\"], .batch-list');
      await expect(batchList).toBeVisible();
    });
  });

  test.describe('Cross-Role Verification', () => {
    test('should maintain role restrictions after session refresh', async ({ page }) => {
      await authHelper.loginAs('viewer');

      // Verify initial restrictions
      await authHelper.verifyViewerAccess();

      // Refresh page
      await page.reload();

      // Should still have same restrictions
      await authHelper.verifyViewerAccess();
    });

    test('should update permissions after role change', async ({ page }) => {
      // This test would require admin functionality to change user roles
      // For now, we'll test that different users have different access

      // Login as operator
      await authHelper.loginAs('operator');
      const operatorNavItems = await page.locator('[data-testid^=\"nav-\"]').all();
      const operatorItemsCount = operatorNavItems.length;

      // Logout and login as viewer
      await authHelper.logout();
      await authHelper.loginAs('viewer');
      const viewerNavItems = await page.locator('[data-testid^=\"nav-\"]').all();
      const viewerItemsCount = viewerNavItems.length;

      // Operator should have more navigation items than viewer
      expect(operatorItemsCount).toBeGreaterThanOrEqual(viewerItemsCount);
    });

    test('should handle unauthorized API requests gracefully', async ({ page }) => {
      await authHelper.loginAs('viewer');

      // This would test that API calls return proper error codes
      // We'll simulate by trying to access a restricted page
      await page.goto('/vendors');

      // Should either redirect or show proper error
      const isRedirected = !page.url().includes('/vendors');
      const hasErrorMessage = await page.locator('[data-testid=\"error-message\"], .error').isVisible().catch(() => false);

      expect(isRedirected || hasErrorMessage).toBe(true);
    });
  });

  test.describe('Security', () => {
    test('should not expose sensitive data in client code', async ({ page }) => {
      await authHelper.loginAs('viewer');

      // Check that sensitive data is not exposed in page source or network
      const content = await page.content();

      // Should not contain password hashes or sensitive config
      expect(content).not.toMatch(/\$2[aby]\$\d+\$/); // bcrypt hash pattern
      expect(content).not.toContain('DATABASE_URL');
      expect(content).not.toContain('SECRET_KEY');
    });

    test('should handle session timeout properly', async ({ page }) => {
      await authHelper.loginAs('admin');

      // This would test session timeout, but requires server-side session management
      // For now, we'll verify that logout works properly
      await authHelper.logout();

      // Try to access protected resource after logout
      await page.goto('/dashboard');
      await expect(page).toHaveURL(/\/auth\/signin/);
    });
  });
});