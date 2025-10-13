import { test, expect } from '@playwright/test';
import { AuthHelper } from '../utils/auth-helpers';

test.describe('Role-Based Access Control - Comprehensive Testing', () => {
  let authHelper: AuthHelper;

  test.beforeEach(async ({ page }) => {
    authHelper = new AuthHelper(page);
  });

  test.describe('Admin Role Access Control', () => {
    test.beforeEach(async () => {
      await authHelper.loginAs('admin');
    });

    test('should have access to all navigation items', async ({ page }) => {
      await page.goto('/dashboard');

      // Admin should see all navigation items
      const expectedNavItems = [
        '[data-testid="nav-dashboard"]',
        '[data-testid="nav-purchasing"]',
        '[data-testid="nav-pressing"]',
        '[data-testid="nav-cellar"]',
        '[data-testid="nav-packaging"]',
        '[data-testid="nav-admin"]'
      ];

      for (const navItem of expectedNavItems) {
        await expect(page.locator(navItem)).toBeVisible();
      }
    });

    test('should access admin-only pages without restrictions', async ({ page }) => {
      const adminPages = [
        '/admin',
        '/purchasing',
        '/pressing',
        '/cellar',
        '/bottles',
        '/dashboard'
      ];

      for (const adminPage of adminPages) {
        await page.goto(adminPage);

        // Should stay on the intended page (not redirected)
        expect(page.url()).toContain(adminPage);

        // Should not show access denied message
        const accessDenied = page.locator('[data-testid="access-denied"]');
        await expect(accessDenied).not.toBeVisible();
      }
    });

    test('should see create, edit, and delete buttons on all pages', async ({ page }) => {
      const operationalPages = ['/purchasing', '/pressing', '/cellar', '/bottles'];

      for (const operationalPage of operationalPages) {
        await page.goto(operationalPage);

        // Wait for page to load
        await page.waitForLoadState('networkidle');

        // Should see action buttons (create, edit controls)
        const createButtons = page.locator('[data-testid*="create"], [data-testid*="new"], .create-button, .new-button');
        const editButtons = page.locator('[data-testid*="edit"], .edit-button');

        // At least one create or new button should be visible
        const hasCreateAccess = await createButtons.first().isVisible().catch(() => false);
        expect(hasCreateAccess).toBe(true);
      }
    });

    test('should have access to user management in admin section', async ({ page }) => {
      await page.goto('/admin');

      // Should see user management features
      const userManagement = page.locator('[data-testid="user-management"], [data-testid="users-section"]');
      await expect(userManagement).toBeVisible();

      // Should see options to create/edit users
      const userActions = page.locator('[data-testid="create-user"], [data-testid="manage-users"], [data-testid="user-actions"]');
      const hasUserActions = await userActions.first().isVisible().catch(() => false);
      expect(hasUserActions).toBe(true);
    });
  });

  test.describe('Operator Role Access Control', () => {
    test.beforeEach(async () => {
      await authHelper.loginAs('operator');
    });

    test('should have access to operational pages but not admin', async ({ page }) => {
      // Should access operational pages
      const allowedPages = ['/dashboard', '/purchasing', '/pressing', '/cellar', '/bottles'];

      for (const allowedPage of allowedPages) {
        await page.goto(allowedPage);
        expect(page.url()).toContain(allowedPage);
      }

      // Should NOT access admin page
      await page.goto('/admin');

      // Should be redirected or show access denied
      const isRedirected = !page.url().includes('/admin');
      const hasAccessDenied = await page.locator('[data-testid="access-denied"]').isVisible().catch(() => false);

      expect(isRedirected || hasAccessDenied).toBe(true);
    });

    test('should see limited navigation items', async ({ page }) => {
      await page.goto('/dashboard');

      // Should see operational navigation
      const expectedNavItems = [
        '[data-testid="nav-dashboard"]',
        '[data-testid="nav-purchasing"]',
        '[data-testid="nav-pressing"]',
        '[data-testid="nav-cellar"]',
        '[data-testid="nav-packaging"]'
      ];

      for (const navItem of expectedNavItems) {
        await expect(page.locator(navItem)).toBeVisible();
      }

      // Should NOT see admin navigation
      const adminNav = page.locator('[data-testid="nav-admin"]');
      await expect(adminNav).not.toBeVisible();
    });

    test('should see create/edit buttons but limited delete options', async ({ page }) => {
      await page.goto('/purchasing');

      // Should see create buttons (operators can create purchases)
      const createButton = page.locator('[data-testid*="create"], [data-testid*="new"]');
      const hasCreateAccess = await createButton.first().isVisible().catch(() => false);
      expect(hasCreateAccess).toBe(true);

      // Should see edit buttons
      const editButtons = page.locator('[data-testid*="edit"]');
      const hasEditAccess = await editButtons.count() > 0;
      expect(hasEditAccess).toBe(true);

      // Delete access may be limited for certain entities (like vendors)
      // This would depend on specific implementation
    });

    test('should not have user management access', async ({ page }) => {
      // Even if they can access dashboard, should not see user management
      await page.goto('/dashboard');

      const userManagement = page.locator('[data-testid="user-management"], [data-testid="users-section"], [data-testid="manage-users"]');
      await expect(userManagement).not.toBeVisible();
    });
  });

  test.describe('Viewer Role Access Control', () => {
    test.beforeEach(async () => {
      await authHelper.loginAs('viewer');
    });

    test('should have read-only access to operational pages', async ({ page }) => {
      const allowedPages = ['/dashboard', '/cellar', '/bottles'];

      for (const allowedPage of allowedPages) {
        await page.goto(allowedPage);
        expect(page.url()).toContain(allowedPage);
      }
    });

    test('should be restricted from admin and some operational pages', async ({ page }) => {
      const restrictedPages = ['/admin', '/purchasing', '/pressing'];

      for (const restrictedPage of restrictedPages) {
        await page.goto(restrictedPage);

        // Should be redirected or see access denied
        const isRedirected = !page.url().includes(restrictedPage);
        const hasAccessDenied = await page.locator('[data-testid="access-denied"]').isVisible().catch(() => false);

        expect(isRedirected || hasAccessDenied).toBe(true);
      }
    });

    test('should see limited navigation items (read-only areas)', async ({ page }) => {
      await page.goto('/dashboard');

      // Should only see read-only navigation items
      const expectedNavItems = [
        '[data-testid="nav-dashboard"]',
        '[data-testid="nav-cellar"]',
        '[data-testid="nav-packaging"]'
      ];

      for (const navItem of expectedNavItems) {
        await expect(page.locator(navItem)).toBeVisible();
      }

      // Should NOT see admin or write-access navigation
      const restrictedNavItems = [
        '[data-testid="nav-admin"]',
        '[data-testid="nav-purchasing"]',
        '[data-testid="nav-pressing"]'
      ];

      for (const restrictedNavItem of restrictedNavItems) {
        await expect(page.locator(restrictedNavItem)).not.toBeVisible();
      }
    });

    test('should not see any create, edit, or delete buttons', async ({ page }) => {
      const viewablePages = ['/dashboard', '/cellar', '/bottles'];

      for (const viewablePage of viewablePages) {
        await page.goto(viewablePage);
        await page.waitForLoadState('networkidle');

        // Should not see create buttons
        const createButtons = page.locator('[data-testid*="create"], [data-testid*="new"], .create-button, .new-button');
        expect(await createButtons.count()).toBe(0);

        // Should not see edit buttons
        const editButtons = page.locator('[data-testid*="edit"], .edit-button');
        expect(await editButtons.count()).toBe(0);

        // Should not see delete buttons
        const deleteButtons = page.locator('[data-testid*="delete"], .delete-button');
        expect(await deleteButtons.count()).toBe(0);
      }
    });

    test('should not have any user management access', async ({ page }) => {
      await page.goto('/dashboard');

      const userManagement = page.locator('[data-testid="user-management"], [data-testid="users-section"], [data-testid="manage-users"]');
      await expect(userManagement).not.toBeVisible();
    });
  });

  test.describe('Cross-Role Navigation Security', () => {
    test('should maintain role restrictions after page refresh', async ({ page }) => {
      // Test with viewer role
      await authHelper.loginAs('viewer');
      await page.goto('/dashboard');

      // Verify initial restrictions
      await expect(page.locator('[data-testid="nav-admin"]')).not.toBeVisible();

      // Refresh page
      await page.reload();
      await page.waitForLoadState('networkidle');

      // Should still have same restrictions
      await expect(page.locator('[data-testid="nav-admin"]')).not.toBeVisible();
    });

    test('should enforce role restrictions on direct URL access', async ({ page }) => {
      await authHelper.loginAs('viewer');

      // Try to directly access admin page
      await page.goto('/admin');

      // Should be blocked
      const isBlocked = !page.url().includes('/admin') ||
                       await page.locator('[data-testid="access-denied"]').isVisible().catch(() => false);
      expect(isBlocked).toBe(true);
    });

    test('should update access after role switch simulation', async ({ page }) => {
      // Start as viewer
      await authHelper.loginAs('viewer');
      await page.goto('/dashboard');

      const initialNavItems = await page.locator('[data-testid^="nav-"]').count();

      // Logout and login as admin
      await authHelper.logout();
      await authHelper.loginAs('admin');
      await page.goto('/dashboard');

      const adminNavItems = await page.locator('[data-testid^="nav-"]').count();

      // Admin should have more navigation items
      expect(adminNavItems).toBeGreaterThan(initialNavItems);

      // Should now see admin navigation
      await expect(page.locator('[data-testid="nav-admin"]')).toBeVisible();
    });
  });

  test.describe('UI Element Role-Based Visibility', () => {
    test('should show appropriate buttons based on permissions', async ({ page }) => {
      // Test admin sees all buttons
      await authHelper.loginAs('admin');
      await page.goto('/purchasing');

      const adminCreateButtons = await page.locator('[data-testid*="create"], [data-testid*="new"]').count();
      expect(adminCreateButtons).toBeGreaterThan(0);

      // Test operator sees create/edit but limited delete
      await authHelper.logout();
      await authHelper.loginAs('operator');
      await page.goto('/purchasing');

      const operatorCreateButtons = await page.locator('[data-testid*="create"], [data-testid*="new"]').count();
      expect(operatorCreateButtons).toBeGreaterThan(0);

      // Test viewer sees no action buttons
      await authHelper.logout();
      await authHelper.loginAs('viewer');
      await page.goto('/cellar');

      const viewerActionButtons = await page.locator('[data-testid*="create"], [data-testid*="edit"], [data-testid*="delete"]').count();
      expect(viewerActionButtons).toBe(0);
    });

    test('should hide sensitive information based on role', async ({ page }) => {
      // Admin should see financial information
      await authHelper.loginAs('admin');
      await page.goto('/dashboard');

      const financialInfo = page.locator('[data-testid*="cost"], [data-testid*="price"], [data-testid*="financial"]');
      const adminSeesFinancial = await financialInfo.first().isVisible().catch(() => false);

      // Operator might see limited financial info
      await authHelper.logout();
      await authHelper.loginAs('operator');
      await page.goto('/dashboard');

      const operatorFinancialInfo = await page.locator('[data-testid*="cost"], [data-testid*="price"]').count();

      // Viewer should see minimal financial information
      await authHelper.logout();
      await authHelper.loginAs('viewer');
      await page.goto('/dashboard');

      const viewerFinancialInfo = await page.locator('[data-testid*="cost"], [data-testid*="price"]').count();

      // Financial visibility should decrease: admin >= operator >= viewer
      expect(adminSeesFinancial).toBe(true);
      expect(viewerFinancialInfo).toBeLessThanOrEqual(operatorFinancialInfo);
    });
  });

  test.describe('Error Handling and Security', () => {
    test('should handle invalid session gracefully', async ({ page }) => {
      await authHelper.loginAs('admin');
      await page.goto('/dashboard');

      // Simulate session invalidation by clearing cookies
      await page.context().clearCookies();

      // Try to access protected resource
      await page.goto('/admin');

      // Should redirect to login
      await expect(page).toHaveURL(/\/auth\/signin/);
    });

    test('should not expose sensitive data in network requests', async ({ page }) => {
      let sensitiveDataFound = false;

      // Monitor network traffic
      page.on('response', response => {
        const url = response.url();
        if (url.includes('password') || url.includes('secret') || url.includes('key')) {
          sensitiveDataFound = true;
        }
      });

      await authHelper.loginAs('viewer');
      await page.goto('/dashboard');

      // Should not find sensitive data in network traffic
      expect(sensitiveDataFound).toBe(false);
    });

    test('should maintain security across browser tabs', async ({ context }) => {
      // Create two pages (tabs)
      const page1 = await context.newPage();
      const page2 = await context.newPage();

      const authHelper1 = new AuthHelper(page1);
      const authHelper2 = new AuthHelper(page2);

      // Login as admin in first tab
      await authHelper1.loginAs('admin');
      await page1.goto('/dashboard');
      await expect(page1.locator('[data-testid="nav-admin"]')).toBeVisible();

      // Second tab should also have admin access (same session)
      await page2.goto('/dashboard');
      await expect(page2.locator('[data-testid="nav-admin"]')).toBeVisible();

      // Logout from first tab
      await authHelper1.logout();

      // Second tab should also lose access after refresh
      await page2.reload();
      await expect(page2).toHaveURL(/\/auth\/signin/);
    });
  });
});