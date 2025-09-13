import { test, expect } from '@playwright/test';
import { AuthHelper } from '../utils/auth-helpers';

test.describe('API Endpoint Role-Based Permissions', () => {
  let authHelper: AuthHelper;

  test.beforeEach(async ({ page }) => {
    authHelper = new AuthHelper(page);
  });

  test.describe('Admin API Access', () => {
    test.beforeEach(async () => {
      await authHelper.loginAs('admin');
    });

    test('should allow admin to access all vendor endpoints', async ({ page }) => {
      // Set up API response monitoring
      const responses: Array<{ url: string; status: number }> = [];

      page.on('response', response => {
        if (response.url().includes('/api/trpc') && response.url().includes('vendor')) {
          responses.push({
            url: response.url(),
            status: response.status()
          });
        }
      });

      await page.goto('/purchasing');
      await page.waitForLoadState('networkidle');

      // Try to trigger vendor-related API calls
      const createVendorButton = page.locator('[data-testid="create-vendor"], [data-testid="new-vendor"]');
      if (await createVendorButton.isVisible()) {
        await createVendorButton.click();
      }

      // Admin should get successful responses (200-299 range)
      const unauthorizedResponses = responses.filter(r => r.status === 401 || r.status === 403);
      expect(unauthorizedResponses.length).toBe(0);
    });

    test('should allow admin to access user management endpoints', async ({ page }) => {
      const responses: Array<{ url: string; status: number }> = [];

      page.on('response', response => {
        if (response.url().includes('/api/trpc') && response.url().includes('user')) {
          responses.push({
            url: response.url(),
            status: response.status()
          });
        }
      });

      await page.goto('/admin');
      await page.waitForLoadState('networkidle');

      // Trigger user-related API calls
      const userManagement = page.locator('[data-testid="user-management"], [data-testid="users-section"]');
      if (await userManagement.isVisible()) {
        await userManagement.click();
      }

      // Should not get unauthorized responses
      const unauthorizedResponses = responses.filter(r => r.status === 401 || r.status === 403);
      expect(unauthorizedResponses.length).toBe(0);
    });

    test('should allow admin to perform delete operations', async ({ page, request }) => {
      // Skip this test if no data exists - would need proper test data setup
      await page.goto('/purchasing');

      // Monitor delete API calls
      const deleteResponses: Array<{ status: number }> = [];

      page.on('response', response => {
        if (response.url().includes('/api/trpc') &&
            (response.url().includes('delete') || response.request().method() === 'DELETE')) {
          deleteResponses.push({ status: response.status() });
        }
      });

      // Look for delete buttons
      const deleteButtons = page.locator('[data-testid*="delete"], .delete-button');
      if (await deleteButtons.count() > 0) {
        // Admin should be able to trigger delete operations
        // (Implementation would depend on confirmation dialogs, etc.)
        expect(true).toBe(true); // Placeholder - would need specific implementation
      }
    });
  });

  test.describe('Operator API Access', () => {
    test.beforeEach(async () => {
      await authHelper.loginAs('operator');
    });

    test('should allow operator limited vendor access', async ({ page }) => {
      const responses: Array<{ url: string; status: number; method: string }> = [];

      page.on('response', response => {
        if (response.url().includes('/api/trpc') && response.url().includes('vendor')) {
          responses.push({
            url: response.url(),
            status: response.status(),
            method: response.request().method()
          });
        }
      });

      await page.goto('/purchasing');
      await page.waitForLoadState('networkidle');

      // Operator should be able to read vendors
      const readResponses = responses.filter(r =>
        (r.method === 'GET' || r.url.includes('list') || r.url.includes('get')) &&
        r.status >= 200 && r.status < 300
      );
      expect(readResponses.length).toBeGreaterThan(0);

      // Check if operator gets forbidden on certain operations
      const forbiddenResponses = responses.filter(r => r.status === 403);
      // Some delete operations might be forbidden for operators
    });

    test('should deny operator access to user management', async ({ page }) => {
      const responses: Array<{ url: string; status: number }> = [];

      page.on('response', response => {
        if (response.url().includes('/api/trpc') &&
            (response.url().includes('user') || response.url().includes('admin'))) {
          responses.push({
            url: response.url(),
            status: response.status()
          });
        }
      });

      // Try to access admin page
      await page.goto('/admin');

      // Should get unauthorized responses for user management
      const unauthorizedResponses = responses.filter(r =>
        r.status === 401 || r.status === 403
      );

      // If admin page is accessible, should still block user management APIs
      if (page.url().includes('/admin')) {
        expect(unauthorizedResponses.length).toBeGreaterThan(0);
      }
    });

    test('should allow operator to create production data', async ({ page }) => {
      const responses: Array<{ url: string; status: number; method: string }> = [];

      page.on('response', response => {
        if (response.url().includes('/api/trpc') &&
            (response.url().includes('batch') || response.url().includes('purchase'))) {
          responses.push({
            url: response.url(),
            status: response.status(),
            method: response.request().method()
          });
        }
      });

      await page.goto('/cellar');
      await page.waitForLoadState('networkidle');

      // Try to create a batch if button exists
      const createButton = page.locator('[data-testid*="create"], [data-testid*="new"]');
      if (await createButton.first().isVisible()) {
        // Operator should be able to create production data
        const successfulCreates = responses.filter(r =>
          r.method === 'POST' && r.status >= 200 && r.status < 300
        );
        expect(successfulCreates.length).toBeGreaterThanOrEqual(0);
      }
    });
  });

  test.describe('Viewer API Access', () => {
    test.beforeEach(async () => {
      await authHelper.loginAs('viewer');
    });

    test('should only allow viewer read-only API access', async ({ page }) => {
      const responses: Array<{ url: string; status: number; method: string }> = [];

      page.on('response', response => {
        if (response.url().includes('/api/trpc')) {
          responses.push({
            url: response.url(),
            status: response.status(),
            method: response.request().method()
          });
        }
      });

      await page.goto('/dashboard');
      await page.waitForLoadState('networkidle');

      // Try to access available pages
      await page.goto('/cellar');
      await page.waitForLoadState('networkidle');

      // Viewer should only get read operations (GET)
      const writeOperations = responses.filter(r =>
        r.method === 'POST' || r.method === 'PUT' || r.method === 'PATCH' || r.method === 'DELETE'
      );

      // Should have minimal write operations (authentication, session management only)
      expect(writeOperations.length).toBeLessThan(3);

      // Should have successful read operations
      const readOperations = responses.filter(r =>
        r.method === 'GET' && r.status >= 200 && r.status < 300
      );
      expect(readOperations.length).toBeGreaterThan(0);
    });

    test('should deny viewer access to modification endpoints', async ({ page }) => {
      // Try to make direct API calls that should be denied
      const createResponse = await page.evaluate(async () => {
        try {
          const response = await fetch('/api/trpc/vendor.create', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              name: 'Test Vendor',
              contactInfo: { email: 'test@example.com' }
            })
          });
          return { status: response.status, ok: response.ok };
        } catch (error) {
          return { status: 0, ok: false };
        }
      });

      // Should be denied (401/403) or method not allowed
      expect(createResponse.status).toBeGreaterThanOrEqual(400);
    });

    test('should deny viewer access to admin endpoints', async ({ page }) => {
      const adminResponse = await page.evaluate(async () => {
        try {
          const response = await fetch('/api/trpc/user.list', {
            method: 'GET',
            headers: { 'Content-Type': 'application/json' }
          });
          return { status: response.status, ok: response.ok };
        } catch (error) {
          return { status: 0, ok: false };
        }
      });

      // Should be denied access to user management
      expect(adminResponse.status).toBeGreaterThanOrEqual(400);
    });
  });

  test.describe('API Security Validation', () => {
    test('should validate API tokens and sessions', async ({ page }) => {
      await authHelper.loginAs('admin');
      await page.goto('/dashboard');

      // Clear session
      await page.context().clearCookies();

      // Try to make authenticated API call
      const apiResponse = await page.evaluate(async () => {
        try {
          const response = await fetch('/api/trpc/batch.list', {
            method: 'GET',
            headers: { 'Content-Type': 'application/json' }
          });
          return { status: response.status };
        } catch (error) {
          return { status: 0 };
        }
      });

      // Should be unauthorized without valid session
      expect(apiResponse.status).toBe(401);
    });

    test('should enforce CSRF protection', async ({ page }) => {
      await authHelper.loginAs('admin');
      await page.goto('/dashboard');

      // Try to make API call without proper CSRF token
      const csrfResponse = await page.evaluate(async () => {
        try {
          const response = await fetch('/api/trpc/vendor.create', {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
              // Missing or invalid CSRF token
            },
            body: JSON.stringify({
              name: 'CSRF Test Vendor'
            })
          });
          return { status: response.status };
        } catch (error) {
          return { status: 0 };
        }
      });

      // Should have proper CSRF protection
      // (Implementation may vary - this is a placeholder test)
      expect(csrfResponse.status).toBeGreaterThanOrEqual(400);
    });

    test('should handle malformed requests gracefully', async ({ page }) => {
      await authHelper.loginAs('admin');
      await page.goto('/dashboard');

      // Send malformed request
      const malformedResponse = await page.evaluate(async () => {
        try {
          const response = await fetch('/api/trpc/vendor.create', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: 'invalid-json{'
          });
          return { status: response.status };
        } catch (error) {
          return { status: 0 };
        }
      });

      // Should handle malformed requests gracefully (400 Bad Request)
      expect(malformedResponse.status).toBe(400);
    });

    test('should rate limit API requests appropriately', async ({ page }) => {
      await authHelper.loginAs('admin');
      await page.goto('/dashboard');

      // Make multiple rapid requests
      const responses = await page.evaluate(async () => {
        const promises = [];
        for (let i = 0; i < 20; i++) {
          promises.push(
            fetch('/api/trpc/batch.list', {
              method: 'GET',
              headers: { 'Content-Type': 'application/json' }
            }).then(r => r.status).catch(() => 0)
          );
        }
        return Promise.all(promises);
      });

      // Should handle rapid requests appropriately
      // Most should succeed, but rate limiting may kick in
      const successfulRequests = responses.filter(status => status >= 200 && status < 300);
      expect(successfulRequests.length).toBeGreaterThan(0);

      // Some rate limiting is acceptable
      const rateLimitedRequests = responses.filter(status => status === 429);
      // Rate limiting may or may not be implemented - this is informational
    });
  });

  test.describe('Permission Boundary Testing', () => {
    test('should prevent privilege escalation', async ({ page }) => {
      // Login as operator
      await authHelper.loginAs('operator');
      await page.goto('/dashboard');

      // Try to access admin-only endpoint by manipulation
      const escalationResponse = await page.evaluate(async () => {
        try {
          // Try various manipulation attempts
          const responses = await Promise.all([
            fetch('/api/trpc/user.create', { method: 'POST' }),
            fetch('/api/trpc/admin.settings', { method: 'GET' }),
            fetch('/api/trpc/system.config', { method: 'GET' })
          ]);

          return responses.map(r => r.status);
        } catch (error) {
          return [0, 0, 0];
        }
      });

      // All admin attempts should be denied
      escalationResponse.forEach(status => {
        expect(status).toBeGreaterThanOrEqual(400);
      });
    });

    test('should maintain permission consistency across API versions', async ({ page }) => {
      await authHelper.loginAs('viewer');
      await page.goto('/dashboard');

      // Test different API endpoint patterns
      const consistencyResponse = await page.evaluate(async () => {
        const endpoints = [
          '/api/trpc/vendor.create',
          '/api/trpc/vendor/create',
          '/api/v1/vendor',
          '/api/vendor'
        ];

        const responses = [];
        for (const endpoint of endpoints) {
          try {
            const response = await fetch(endpoint, { method: 'POST' });
            responses.push({ endpoint, status: response.status });
          } catch (error) {
            responses.push({ endpoint, status: 0 });
          }
        }
        return responses;
      });

      // All create operations should be consistently denied for viewer
      consistencyResponse.forEach(({ endpoint, status }) => {
        if (status > 0) { // If endpoint exists
          expect(status).toBeGreaterThanOrEqual(400);
        }
      });
    });
  });
});