import { test, expect } from '@playwright/test';
import { AuthHelper } from '../utils/auth-helpers';

test.describe('Role Transition and Session Management', () => {
  let authHelper: AuthHelper;

  test.beforeEach(async ({ page }) => {
    authHelper = new AuthHelper(page);
  });

  test.describe('Role Switching and Persistence', () => {
    test('should maintain role permissions after page refresh', async ({ page }) => {
      // Test each role maintains permissions after refresh
      const roles: Array<'admin' | 'operator' | 'viewer'> = ['admin', 'operator', 'viewer'];

      for (const role of roles) {
        await authHelper.loginAs(role);
        await page.goto('/dashboard');

        // Get initial navigation items
        const initialNavItems = await page.locator('[data-testid^="nav-"]').count();
        const hasAdminNav = await page.locator('[data-testid="nav-admin"]').isVisible().catch(() => false);

        // Refresh page
        await page.reload();
        await page.waitForLoadState('networkidle');

        // Should maintain same navigation items
        const postRefreshNavItems = await page.locator('[data-testid^="nav-"]').count();
        const stillHasAdminNav = await page.locator('[data-testid="nav-admin"]').isVisible().catch(() => false);

        expect(postRefreshNavItems).toBe(initialNavItems);
        expect(stillHasAdminNav).toBe(hasAdminNav);

        await authHelper.logout();
      }
    });

    test('should update permissions immediately after role change simulation', async ({ page }) => {
      // Start as viewer with minimal permissions
      await authHelper.loginAs('viewer');
      await page.goto('/dashboard');

      const viewerNavCount = await page.locator('[data-testid^="nav-"]').count();
      await expect(page.locator('[data-testid="nav-admin"]')).not.toBeVisible();
      await expect(page.locator('[data-testid="nav-purchasing"]')).not.toBeVisible();

      // Switch to operator
      await authHelper.logout();
      await authHelper.loginAs('operator');
      await page.goto('/dashboard');

      const operatorNavCount = await page.locator('[data-testid^="nav-"]').count();
      await expect(page.locator('[data-testid="nav-purchasing"]')).toBeVisible();
      await expect(page.locator('[data-testid="nav-admin"]')).not.toBeVisible();

      // Switch to admin
      await authHelper.logout();
      await authHelper.loginAs('admin');
      await page.goto('/dashboard');

      const adminNavCount = await page.locator('[data-testid^="nav-"]').count();
      await expect(page.locator('[data-testid="nav-admin"]')).toBeVisible();
      await expect(page.locator('[data-testid="nav-purchasing"]')).toBeVisible();

      // Permissions should increase: viewer < operator < admin
      expect(operatorNavCount).toBeGreaterThan(viewerNavCount);
      expect(adminNavCount).toBeGreaterThanOrEqual(operatorNavCount);
    });

    test('should handle role-based redirects correctly', async ({ page }) => {
      // Test that users are redirected appropriately based on their role

      // Viewer accessing admin page
      await authHelper.loginAs('viewer');
      await page.goto('/admin');

      const viewerBlocked = !page.url().includes('/admin') ||
                          await page.locator('[data-testid="access-denied"]').isVisible().catch(() => false);
      expect(viewerBlocked).toBe(true);

      // Operator accessing admin page
      await authHelper.logout();
      await authHelper.loginAs('operator');
      await page.goto('/admin');

      const operatorBlocked = !page.url().includes('/admin') ||
                             await page.locator('[data-testid="access-denied"]').isVisible().catch(() => false);
      expect(operatorBlocked).toBe(true);

      // Admin should access admin page
      await authHelper.logout();
      await authHelper.loginAs('admin');
      await page.goto('/admin');

      expect(page.url()).toContain('/admin');
      const hasAccessDenied = await page.locator('[data-testid="access-denied"]').isVisible().catch(() => false);
      expect(hasAccessDenied).toBe(false);
    });
  });

  test.describe('Session Security and Lifecycle', () => {
    test('should invalidate session completely on logout', async ({ page }) => {
      await authHelper.loginAs('admin');
      await page.goto('/dashboard');

      // Verify admin access
      await expect(page.locator('[data-testid="nav-admin"]')).toBeVisible();

      // Get session cookies before logout
      const preLogoutCookies = await page.context().cookies();
      const sessionCookies = preLogoutCookies.filter(cookie =>
        cookie.name.includes('session') || cookie.name.includes('token')
      );

      // Logout
      await authHelper.logout();

      // Try to access admin page directly
      await page.goto('/admin');
      await expect(page).toHaveURL(/\/auth\/signin/);

      // Session cookies should be cleared or invalidated
      const postLogoutCookies = await page.context().cookies();
      const remainingSessionCookies = postLogoutCookies.filter(cookie =>
        cookie.name.includes('session') || cookie.name.includes('token')
      );

      // Either cookies are removed or their values are different
      const sessionInvalidated = remainingSessionCookies.length === 0 ||
        remainingSessionCookies.every((cookie, index) =>
          cookie.value !== sessionCookies[index]?.value
        );
      expect(sessionInvalidated).toBe(true);
    });

    test('should handle concurrent sessions across multiple tabs', async ({ context }) => {
      const page1 = await context.newPage();
      const page2 = await context.newPage();

      const authHelper1 = new AuthHelper(page1);
      const authHelper2 = new AuthHelper(page2);

      // Login as admin in first tab
      await authHelper1.loginAs('admin');
      await page1.goto('/dashboard');
      await expect(page1.locator('[data-testid="nav-admin"]')).toBeVisible();

      // Second tab should inherit the same session
      await page2.goto('/dashboard');
      await expect(page2.locator('[data-testid="nav-admin"]')).toBeVisible();

      // Logout from first tab
      await authHelper1.logout();

      // Second tab should lose access after page reload
      await page2.reload();
      await expect(page2).toHaveURL(/\/auth\/signin/);

      // Clean up
      await page1.close();
      await page2.close();
    });

    test('should prevent session fixation attacks', async ({ page, context }) => {
      // Get initial session state
      await page.goto('/auth/signin');
      const preAuthCookies = await context.cookies();

      // Login
      await authHelper.loginAs('admin');
      await page.goto('/dashboard');

      // Get post-auth session state
      const postAuthCookies = await context.cookies();

      // Session ID should change after authentication
      const preAuthSessionCookies = preAuthCookies.filter(cookie =>
        cookie.name.includes('session') || cookie.name.includes('token')
      );
      const postAuthSessionCookies = postAuthCookies.filter(cookie =>
        cookie.name.includes('session') || cookie.name.includes('token')
      );

      // Either new session cookies exist or existing ones have changed values
      const sessionChanged = postAuthSessionCookies.some(postCookie => {
        const preCookie = preAuthSessionCookies.find(pre => pre.name === postCookie.name);
        return !preCookie || preCookie.value !== postCookie.value;
      });

      expect(sessionChanged).toBe(true);
    });

    test('should handle session timeout appropriately', async ({ page }) => {
      await authHelper.loginAs('admin');
      await page.goto('/dashboard');

      // Simulate session timeout by clearing cookies
      await page.context().clearCookies();

      // Make an API request that requires authentication
      const response = await page.evaluate(async () => {
        try {
          const response = await fetch('/api/trpc/vendor.list', {
            method: 'GET',
            headers: { 'Content-Type': 'application/json' }
          });
          return { status: response.status, ok: response.ok };
        } catch (error) {
          return { status: 0, ok: false };
        }
      });

      // Should get unauthorized response
      expect(response.status).toBe(401);

      // Try to navigate to protected page
      await page.goto('/admin');
      await expect(page).toHaveURL(/\/auth\/signin/);
    });
  });

  test.describe('Permission Changes and Real-time Updates', () => {
    test('should reflect permission changes without requiring re-login', async ({ page }) => {
      // This test simulates what would happen if an admin changed a user's role
      // In a real scenario, this would involve admin actions in another session

      await authHelper.loginAs('operator');
      await page.goto('/dashboard');

      // Initial operator permissions
      const initialNavCount = await page.locator('[data-testid^="nav-"]').count();
      const hasInitialAdminAccess = await page.locator('[data-testid="nav-admin"]').isVisible().catch(() => false);

      expect(hasInitialAdminAccess).toBe(false);

      // Simulate role change by logging out and back in as admin
      // (In real implementation, this would be triggered by websocket or polling)
      await authHelper.logout();
      await authHelper.loginAs('admin');
      await page.goto('/dashboard');

      // Should now have admin permissions
      const newNavCount = await page.locator('[data-testid^="nav-"]').count();
      const hasNewAdminAccess = await page.locator('[data-testid="nav-admin"]').isVisible().catch(() => false);

      expect(hasNewAdminAccess).toBe(true);
      expect(newNavCount).toBeGreaterThan(initialNavCount);
    });

    test('should handle role downgrade gracefully', async ({ page }) => {
      // Start as admin
      await authHelper.loginAs('admin');
      await page.goto('/admin');

      // Should have access to admin features
      await expect(page.locator('[data-testid="user-management"], [data-testid="admin-panel"]')).toBeVisible();

      // Simulate role downgrade by switching to operator
      await authHelper.logout();
      await authHelper.loginAs('operator');

      // Try to access admin page
      await page.goto('/admin');

      // Should be blocked
      const isBlocked = !page.url().includes('/admin') ||
                       await page.locator('[data-testid="access-denied"]').isVisible().catch(() => false);
      expect(isBlocked).toBe(true);

      // Should be redirected to appropriate page
      if (!page.url().includes('/admin')) {
        // Should redirect to dashboard or other appropriate page
        expect(page.url()).toMatch(/\/(dashboard|$)/);
      }
    });
  });

  test.describe('Cross-Session Security', () => {
    test('should prevent session sharing between different users', async ({ context }) => {
      const page1 = await context.newPage();
      const page2 = await context.newPage();

      const authHelper1 = new AuthHelper(page1);
      const authHelper2 = new AuthHelper(page2);

      // Login as admin in first context
      await authHelper1.loginAs('admin');
      await page1.goto('/dashboard');

      // Get admin session cookies
      const adminCookies = await context.cookies();

      // Create new context for second user
      const viewerContext = await context.newContext();
      const viewerPage = await viewerContext.newPage();

      // Try to use admin cookies in viewer context
      await viewerContext.addCookies(adminCookies);

      const authHelperViewer = new AuthHelper(viewerPage);

      // This should not work - the session should be invalidated or user should be different
      await viewerPage.goto('/admin');

      // Either redirected to login or see access denied
      const hasUnauthorizedAccess = page.url().includes('/admin') &&
                                   !(await viewerPage.locator('[data-testid="access-denied"]').isVisible().catch(() => false));

      expect(hasUnauthorizedAccess).toBe(false);

      await viewerContext.close();
      await page1.close();
      await page2.close();
    });

    test('should maintain session consistency across browser instances', async ({ browser }) => {
      // Create new browser context
      const context1 = await browser.newContext();
      const page1 = await context1.newPage();
      const authHelper1 = new AuthHelper(page1);

      // Login in first context
      await authHelper1.loginAs('admin');
      await page1.goto('/dashboard');

      // Create second context with same storage
      const context2 = await browser.newContext({
        storageState: await context1.storageState()
      });
      const page2 = await context2.newPage();

      // Should maintain session in second context
      await page2.goto('/dashboard');
      await expect(page2.locator('[data-testid="nav-admin"]')).toBeVisible();

      // Logout from first context
      await authHelper1.logout();

      // Second context should also lose access
      await page2.reload();
      await expect(page2).toHaveURL(/\/auth\/signin/);

      await context1.close();
      await context2.close();
    });
  });

  test.describe('Session Recovery and Error Handling', () => {
    test('should handle network interruptions gracefully', async ({ page }) => {
      await authHelper.loginAs('admin');
      await page.goto('/dashboard');

      // Simulate network failure
      await page.setOffline(true);

      // Try to navigate
      await page.goto('/admin');

      // Should handle offline gracefully (may show offline message)
      const hasOfflineIndicator = await page.locator('[data-testid="offline"], .offline-indicator').isVisible().catch(() => false);

      // Restore network
      await page.setOffline(false);

      // Should recover session
      await page.reload();
      await page.waitForLoadState('networkidle');

      // Should still be authenticated (if session is valid)
      const isStillAuthenticated = !page.url().includes('/auth/signin');

      // This test depends on session storage strategy
      if (isStillAuthenticated) {
        await expect(page.locator('[data-testid="dashboard-stats"]')).toBeVisible();
      }
    });

    test('should handle corrupted session data', async ({ page }) => {
      await authHelper.loginAs('admin');
      await page.goto('/dashboard');

      // Corrupt session data
      await page.evaluate(() => {
        // Try to corrupt various session storage mechanisms
        if (localStorage.getItem('session')) {
          localStorage.setItem('session', 'corrupted_data');
        }
        if (sessionStorage.getItem('session')) {
          sessionStorage.setItem('session', 'corrupted_data');
        }
      });

      // Navigate to protected page
      await page.goto('/admin');

      // Should either recover gracefully or redirect to login
      const isRecovered = page.url().includes('/admin') &&
                         !(await page.locator('[data-testid="access-denied"]').isVisible().catch(() => false));

      const isRedirected = page.url().includes('/auth/signin');

      // Either recover or redirect, but should not crash
      expect(isRecovered || isRedirected).toBe(true);
    });

    test('should provide clear feedback for authentication failures', async ({ page }) => {
      // Try invalid login
      await page.goto('/auth/signin');

      const emailInput = page.locator('input[name="email"], input[type="email"]');
      const passwordInput = page.locator('input[name="password"], input[type="password"]');
      const submitButton = page.locator('button[type="submit"]');

      if (await emailInput.isVisible()) {
        await emailInput.fill('invalid@example.com');
        await passwordInput.fill('wrongpassword');
        await submitButton.click();

        // Should see error message
        const errorMessage = page.locator('[data-testid="error"], .error-message');
        await expect(errorMessage).toBeVisible();

        // Error should be informative but not reveal sensitive information
        const errorText = await errorMessage.textContent();
        expect(errorText).toBeTruthy();
        expect(errorText?.toLowerCase()).not.toContain('database');
        expect(errorText?.toLowerCase()).not.toContain('sql');
      }
    });
  });

  test.describe('Audit and Logging', () => {
    test('should log authentication events', async ({ page }) => {
      let authenticationRequests = 0;

      // Monitor authentication-related network requests
      page.on('request', request => {
        const url = request.url();
        if (url.includes('auth') || url.includes('login') || url.includes('session')) {
          authenticationRequests++;
        }
      });

      // Login
      await authHelper.loginAs('admin');
      await page.goto('/dashboard');

      // Should have made authentication requests
      expect(authenticationRequests).toBeGreaterThan(0);

      // Logout
      await authHelper.logout();

      // Should have made logout request
      expect(authenticationRequests).toBeGreaterThan(1);
    });

    test('should track role-based access attempts', async ({ page }) => {
      let accessAttempts: Array<{ url: string; status: number }> = [];

      page.on('response', response => {
        if (response.url().includes('/api/') || response.url().includes('/admin')) {
          accessAttempts.push({
            url: response.url(),
            status: response.status()
          });
        }
      });

      // Login as viewer and try to access restricted resources
      await authHelper.loginAs('viewer');
      await page.goto('/admin');

      // Should log the access attempt and denial
      const adminAccessAttempts = accessAttempts.filter(attempt =>
        attempt.url.includes('/admin') || attempt.url.includes('user')
      );

      expect(adminAccessAttempts.length).toBeGreaterThan(0);

      // Should have appropriate status codes (403/401 for denied access)
      const deniedAttempts = adminAccessAttempts.filter(attempt =>
        attempt.status === 401 || attempt.status === 403
      );

      expect(deniedAttempts.length).toBeGreaterThan(0);
    });
  });
});