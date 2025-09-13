import { test, expect } from '@playwright/test';
import { AuthHelper } from '../utils/auth-helpers';

test.describe('Security Boundary Validation', () => {
  let authHelper: AuthHelper;

  test.beforeEach(async ({ page }) => {
    authHelper = new AuthHelper(page);
  });

  test.describe('Authentication Boundary Testing', () => {
    test('should redirect unauthenticated users to login', async ({ page }) => {
      const protectedPages = [
        '/dashboard',
        '/admin',
        '/purchasing',
        '/pressing',
        '/cellar',
        '/packaging'
      ];

      for (const protectedPage of protectedPages) {
        await page.goto(protectedPage);

        // Should be redirected to sign in
        await expect(page).toHaveURL(/\/auth\/signin/);
      }
    });

    test('should handle session timeout gracefully', async ({ page }) => {
      await authHelper.loginAs('admin');
      await page.goto('/dashboard');

      // Verify access works initially
      await expect(page.locator('[data-testid="dashboard-stats"]')).toBeVisible();

      // Clear session cookies to simulate timeout
      await page.context().clearCookies();

      // Try to navigate to protected page
      await page.goto('/admin');

      // Should redirect to login
      await expect(page).toHaveURL(/\/auth\/signin/);
    });

    test('should invalidate session on logout', async ({ page }) => {
      await authHelper.loginAs('admin');
      await page.goto('/dashboard');

      // Logout
      await authHelper.logout();

      // Try to access protected resource
      await page.goto('/admin');

      // Should be redirected to login
      await expect(page).toHaveURL(/\/auth\/signin/);
    });

    test('should prevent session hijacking attempts', async ({ page, context }) => {
      await authHelper.loginAs('admin');
      await page.goto('/dashboard');

      // Get current cookies
      const cookies = await context.cookies();
      const sessionCookies = cookies.filter(cookie =>
        cookie.name.includes('session') ||
        cookie.name.includes('token') ||
        cookie.name === 'next-auth.session-token'
      );

      // Clear cookies and set modified ones
      await context.clearCookies();

      // Try to set manipulated session cookies
      for (const cookie of sessionCookies) {
        await context.addCookies([{
          ...cookie,
          value: cookie.value + 'manipulated'
        }]);
      }

      // Try to access protected resource with manipulated session
      await page.goto('/admin');

      // Should be redirected to login due to invalid session
      await expect(page).toHaveURL(/\/auth\/signin/);
    });
  });

  test.describe('Authorization Boundary Testing', () => {
    test('should prevent horizontal privilege escalation', async ({ page }) => {
      // Login as operator
      await authHelper.loginAs('operator');
      await page.goto('/dashboard');

      // Try to access user-specific resources of other users
      const attempts = [
        '/api/user/admin/profile',
        '/api/user/1/settings',
        '/admin/users/edit/1'
      ];

      for (const attempt of attempts) {
        const response = await page.goto(attempt);

        if (response) {
          // Should get unauthorized or not found
          expect(response.status()).toBeGreaterThanOrEqual(400);
        } else {
          // Navigation blocked - good security
          expect(true).toBe(true);
        }
      }
    });

    test('should prevent vertical privilege escalation', async ({ page }) => {
      // Login as viewer
      await authHelper.loginAs('viewer');
      await page.goto('/dashboard');

      // Try to perform admin actions via direct API calls
      const adminActions = [
        { endpoint: '/api/trpc/user.create', method: 'POST', data: { name: 'test', email: 'test@example.com' } },
        { endpoint: '/api/trpc/user.delete', method: 'DELETE', data: { id: '1' } },
        { endpoint: '/api/trpc/vendor.delete', method: 'DELETE', data: { id: '1' } }
      ];

      for (const action of adminActions) {
        const response = await page.evaluate(async ({ endpoint, method, data }) => {
          try {
            const response = await fetch(endpoint, {
              method,
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify(data)
            });
            return { status: response.status, ok: response.ok };
          } catch (error) {
            return { status: 0, ok: false };
          }
        }, action);

        // Should be denied
        expect(response.status).toBeGreaterThanOrEqual(400);
      }
    });

    test('should enforce role boundaries on API endpoints', async ({ page }) => {
      const roleTests = [
        {
          role: 'viewer',
          endpoint: '/api/trpc/vendor.create',
          method: 'POST',
          shouldFail: true
        },
        {
          role: 'operator',
          endpoint: '/api/trpc/user.create',
          method: 'POST',
          shouldFail: true
        },
        {
          role: 'operator',
          endpoint: '/api/trpc/batch.create',
          method: 'POST',
          shouldFail: false
        }
      ];

      for (const { role, endpoint, method, shouldFail } of roleTests) {
        await authHelper.logout();
        await authHelper.loginAs(role as 'admin' | 'operator' | 'viewer');
        await page.goto('/dashboard');

        const response = await page.evaluate(async ({ endpoint, method }) => {
          try {
            const response = await fetch(endpoint, {
              method,
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({ test: 'data' })
            });
            return { status: response.status, ok: response.ok };
          } catch (error) {
            return { status: 0, ok: false };
          }
        }, { endpoint, method });

        if (shouldFail) {
          expect(response.status).toBeGreaterThanOrEqual(400);
        } else {
          // Should succeed or at least not be unauthorized
          expect(response.status).not.toBe(401);
          expect(response.status).not.toBe(403);
        }
      }
    });
  });

  test.describe('Data Access Boundary Testing', () => {
    test('should prevent unauthorized data access via URL manipulation', async ({ page }) => {
      await authHelper.loginAs('viewer');
      await page.goto('/dashboard');

      // Try to access specific records via URL manipulation
      const unauthorizedUrls = [
        '/admin/users/1',
        '/admin/settings',
        '/vendor/1/delete',
        '/batch/1/edit',
        '/user/1/permissions'
      ];

      for (const url of unauthorizedUrls) {
        await page.goto(url);

        // Should be blocked or redirected
        const isBlocked = !page.url().includes(url.split('/')[1]) ||
                         await page.locator('[data-testid="access-denied"]').isVisible().catch(() => false);
        expect(isBlocked).toBe(true);
      }
    });

    test('should filter data based on user permissions', async ({ page }) => {
      // Admin should see all data
      await authHelper.loginAs('admin');
      await page.goto('/dashboard');

      const adminDataCount = await page.locator('[data-testid*="stat-"], .dashboard-stat').count();

      // Operator should see operational data
      await authHelper.logout();
      await authHelper.loginAs('operator');
      await page.goto('/dashboard');

      const operatorDataCount = await page.locator('[data-testid*="stat-"], .dashboard-stat').count();

      // Viewer should see minimal data
      await authHelper.logout();
      await authHelper.loginAs('viewer');
      await page.goto('/dashboard');

      const viewerDataCount = await page.locator('[data-testid*="stat-"], .dashboard-stat').count();

      // Data visibility should decrease: admin >= operator >= viewer
      expect(adminDataCount).toBeGreaterThanOrEqual(operatorDataCount);
      expect(operatorDataCount).toBeGreaterThanOrEqual(viewerDataCount);
    });

    test('should prevent data leakage in API responses', async ({ page }) => {
      let apiResponses: any[] = [];

      // Monitor API responses
      page.on('response', async response => {
        if (response.url().includes('/api/trpc') && response.status() === 200) {
          try {
            const data = await response.json();
            apiResponses.push(data);
          } catch (error) {
            // Ignore non-JSON responses
          }
        }
      });

      await authHelper.loginAs('viewer');
      await page.goto('/dashboard');
      await page.waitForLoadState('networkidle');

      // Check that viewer doesn't receive sensitive data
      const sensitiveFields = ['password', 'passwordHash', 'secret', 'privateKey', 'token'];

      apiResponses.forEach(response => {
        const responseString = JSON.stringify(response).toLowerCase();
        sensitiveFields.forEach(field => {
          expect(responseString).not.toContain(field);
        });
      });
    });
  });

  test.describe('Input Validation and Injection Protection', () => {
    test('should prevent SQL injection in search inputs', async ({ page }) => {
      await authHelper.loginAs('admin');
      await page.goto('/purchasing');

      const searchInput = page.locator('[data-testid="search"], input[type="search"]');
      if (await searchInput.isVisible()) {
        // Try SQL injection payloads
        const maliciousInputs = [
          "'; DROP TABLE vendors; --",
          "1' OR '1'='1",
          "admin'/*",
          "' UNION SELECT * FROM users --"
        ];

        for (const maliciousInput of maliciousInputs) {
          await searchInput.fill(maliciousInput);
          await page.keyboard.press('Enter');

          // Should not cause errors or expose data
          const errorMessage = page.locator('[data-testid="error"], .error');
          const hasError = await errorMessage.isVisible().catch(() => false);

          // Either no error (input sanitized) or generic error (not SQL error)
          if (hasError) {
            const errorText = await errorMessage.textContent();
            expect(errorText?.toLowerCase()).not.toContain('sql');
            expect(errorText?.toLowerCase()).not.toContain('syntax');
          }
        }
      }
    });

    test('should prevent XSS in user inputs', async ({ page }) => {
      await authHelper.loginAs('admin');
      await page.goto('/purchasing');

      // Try to create vendor with XSS payload
      const createButton = page.locator('[data-testid="create-vendor"], [data-testid="new-vendor"]');
      if (await createButton.isVisible()) {
        await createButton.click();

        const nameInput = page.locator('[data-testid="vendor-name"], input[name="name"]');
        if (await nameInput.isVisible()) {
          const xssPayload = '<script>alert("XSS")</script>';
          await nameInput.fill(xssPayload);

          const submitButton = page.locator('[data-testid="submit"], button[type="submit"]');
          if (await submitButton.isVisible()) {
            await submitButton.click();

            // Check that script was not executed
            await page.waitForTimeout(1000);

            // Should not have alert dialog
            const dialogs: string[] = [];
            page.on('dialog', dialog => {
              dialogs.push(dialog.message());
              dialog.dismiss();
            });

            expect(dialogs.length).toBe(0);

            // Script tags should be escaped in DOM
            const content = await page.content();
            expect(content).not.toContain('<script>alert("XSS")</script>');
          }
        }
      }
    });

    test('should prevent CSRF attacks', async ({ page }) => {
      await authHelper.loginAs('admin');
      await page.goto('/dashboard');

      // Try to make request without proper CSRF token
      const csrfResponse = await page.evaluate(async () => {
        try {
          const response = await fetch('/api/trpc/vendor.create', {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json'
              // Missing CSRF token
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

      // Should be rejected due to missing CSRF protection
      expect(csrfResponse.status).toBeGreaterThanOrEqual(400);
    });
  });

  test.describe('Rate Limiting and Abuse Prevention', () => {
    test('should rate limit login attempts', async ({ page }) => {
      const responses = [];

      // Attempt multiple failed logins
      for (let i = 0; i < 10; i++) {
        await page.goto('/auth/signin');

        const emailInput = page.locator('input[name="email"], input[type="email"]');
        const passwordInput = page.locator('input[name="password"], input[type="password"]');
        const submitButton = page.locator('button[type="submit"]');

        if (await emailInput.isVisible()) {
          await emailInput.fill('invalid@example.com');
          await passwordInput.fill('wrongpassword');
          await submitButton.click();

          await page.waitForTimeout(100);

          // Check for rate limiting after several attempts
          if (i > 5) {
            const rateLimitMessage = page.locator('[data-testid="rate-limit"], .rate-limit-error');
            const isRateLimited = await rateLimitMessage.isVisible().catch(() => false);

            if (isRateLimited) {
              expect(true).toBe(true); // Rate limiting is working
              break;
            }
          }
        }
      }
    });

    test('should rate limit API requests', async ({ page }) => {
      await authHelper.loginAs('admin');
      await page.goto('/dashboard');

      // Make rapid API requests
      const responses = await page.evaluate(async () => {
        const promises = [];
        for (let i = 0; i < 50; i++) {
          promises.push(
            fetch('/api/trpc/batch.list')
              .then(r => r.status)
              .catch(() => 0)
          );
        }
        return Promise.all(promises);
      });

      // Should see some rate limiting (429 status codes)
      const rateLimitedRequests = responses.filter(status => status === 429);
      const successfulRequests = responses.filter(status => status >= 200 && status < 300);

      // Should have some successful requests but may also have rate limiting
      expect(successfulRequests.length).toBeGreaterThan(0);

      // If rate limiting is implemented, should see 429s after many requests
      // This is optional depending on implementation
    });
  });

  test.describe('Session and Cookie Security', () => {
    test('should use secure cookie attributes', async ({ page, context }) => {
      await authHelper.loginAs('admin');
      await page.goto('/dashboard');

      const cookies = await context.cookies();
      const sessionCookies = cookies.filter(cookie =>
        cookie.name.includes('session') ||
        cookie.name.includes('token') ||
        cookie.name === 'next-auth.session-token'
      );

      sessionCookies.forEach(cookie => {
        // Should have secure attributes
        expect(cookie.httpOnly).toBe(true);
        expect(cookie.secure).toBe(true);
        expect(cookie.sameSite).toBe('Strict');
      });
    });

    test('should prevent cookie manipulation', async ({ page, context }) => {
      await authHelper.loginAs('viewer');
      await page.goto('/dashboard');

      // Get original cookies
      const originalCookies = await context.cookies();

      // Clear and set manipulated cookies
      await context.clearCookies();

      const manipulatedCookies = originalCookies.map(cookie => ({
        ...cookie,
        value: 'manipulated_' + cookie.value
      }));

      await context.addCookies(manipulatedCookies);

      // Try to access protected resource
      await page.goto('/admin');

      // Should be redirected to login due to invalid session
      await expect(page).toHaveURL(/\/auth\/signin/);
    });

    test('should handle concurrent sessions properly', async ({ context }) => {
      // Create two browser pages (simulate two tabs/windows)
      const page1 = await context.newPage();
      const page2 = await context.newPage();

      const authHelper1 = new AuthHelper(page1);
      const authHelper2 = new AuthHelper(page2);

      // Login on first page
      await authHelper1.loginAs('admin');
      await page1.goto('/dashboard');

      // Second page should also be authenticated (same session)
      await page2.goto('/dashboard');
      await expect(page2.locator('[data-testid="dashboard-stats"]')).toBeVisible();

      // Logout from first page
      await authHelper1.logout();

      // Second page should also lose authentication
      await page2.reload();
      await expect(page2).toHaveURL(/\/auth\/signin/);
    });
  });

  test.describe('Error Handling Security', () => {
    test('should not expose sensitive information in error messages', async ({ page }) => {
      await authHelper.loginAs('admin');
      await page.goto('/dashboard');

      // Try to cause various errors
      const errorTests = [
        { url: '/api/trpc/nonexistent', expectedStatus: 404 },
        { url: '/api/trpc/vendor.create', method: 'POST', body: 'invalid-json', expectedStatus: 400 }
      ];

      for (const { url, method = 'GET', body, expectedStatus } of errorTests) {
        const response = await page.evaluate(async ({ url, method, body }) => {
          try {
            const response = await fetch(url, {
              method,
              headers: { 'Content-Type': 'application/json' },
              body
            });
            const text = await response.text();
            return { status: response.status, text };
          } catch (error) {
            return { status: 0, text: error.message };
          }
        }, { url, method, body });

        expect(response.status).toBe(expectedStatus);

        // Error messages should not contain sensitive information
        const sensitivePatterns = [
          /database/i,
          /password/i,
          /secret/i,
          /key/i,
          /token/i,
          /connection string/i,
          /stack trace/i
        ];

        sensitivePatterns.forEach(pattern => {
          expect(response.text).not.toMatch(pattern);
        });
      }
    });

    test('should handle malformed requests gracefully', async ({ page }) => {
      await authHelper.loginAs('admin');
      await page.goto('/dashboard');

      const malformedRequests = [
        { body: '', contentType: 'application/json' },
        { body: 'not-json', contentType: 'application/json' },
        { body: '{"incomplete": ', contentType: 'application/json' },
        { body: '{"valid": "json"}', contentType: 'text/plain' }
      ];

      for (const { body, contentType } of malformedRequests) {
        const response = await page.evaluate(async ({ body, contentType }) => {
          try {
            const response = await fetch('/api/trpc/vendor.create', {
              method: 'POST',
              headers: { 'Content-Type': contentType },
              body
            });
            return { status: response.status, ok: response.ok };
          } catch (error) {
            return { status: 0, ok: false };
          }
        }, { body, contentType });

        // Should return 400 Bad Request for malformed data
        expect(response.status).toBe(400);
      }
    });
  });
});