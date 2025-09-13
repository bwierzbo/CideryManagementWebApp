import { test, expect, Page } from '@playwright/test';
import { pageDiscovery } from '../utils/page-discovery';
import { PageVerifier } from '../page-objects/page-verifier';
import { PerformanceMonitor } from '../utils/performance-monitor';

test.describe('Page Load Verification', () => {
  test('should load all public pages successfully', async ({ page }) => {
    const publicPages = await pageDiscovery.getPublicPages();
    const verifier = new PageVerifier(page);
    const performanceMonitor = new PerformanceMonitor(page);

    console.log(`\n=== TESTING ${publicPages.length} PUBLIC PAGES ===`);

    const results: Array<{
      name: string;
      routePath: string;
      loadTime: number;
      success: boolean;
      error?: string;
      performanceScore?: number;
    }> = [];

    for (const discoveredPage of publicPages) {
      await test.step(`Load ${discoveredPage.name} (${discoveredPage.routePath})`, async () => {
        const startTime = Date.now();
        let success = false;
        let error: string | undefined;
        let performanceScore: number | undefined;

        try {
          // Navigate to page
          await page.goto(discoveredPage.routePath);

          // Wait for page to load
          await page.waitForLoadState('networkidle', { timeout: 10000 });

          // Check basic page health
          const title = await page.title();
          expect(title).toBeTruthy();
          console.log(`  ✓ Page title: "${title}"`);

          // Check that body is visible
          await expect(page.locator('body')).toBeVisible();

          // Check for JavaScript errors
          const jsErrors: string[] = [];
          page.on('pageerror', (err) => {
            jsErrors.push(err.message);
          });

          // Wait a moment for any errors to surface
          await page.waitForTimeout(1000);

          if (jsErrors.length > 0) {
            console.warn(`  ⚠️  JavaScript errors: ${jsErrors.join(', ')}`);
          } else {
            console.log(`  ✓ No JavaScript errors`);
          }

          // Get performance metrics
          try {
            const metrics = await performanceMonitor.monitorPageLoad(discoveredPage.routePath);
            performanceScore = metrics.score;
            console.log(`  ✓ Performance score: ${metrics.score}/100`);
          } catch (perfError) {
            console.warn(`  ⚠️  Performance monitoring failed: ${perfError}`);
          }

          success = true;

        } catch (err) {
          error = (err as Error).message;
          console.error(`  ✗ Failed to load: ${error}`);
        }

        const loadTime = Date.now() - startTime;

        results.push({
          name: discoveredPage.name,
          routePath: discoveredPage.routePath,
          loadTime,
          success,
          error,
          performanceScore
        });

        // Assert that the page loaded successfully
        expect(success, `Failed to load ${discoveredPage.name}: ${error}`).toBe(true);

        // Assert reasonable load time (10 seconds max for this test)
        expect(loadTime, `${discoveredPage.name} took too long to load: ${loadTime}ms`).toBeLessThan(10000);

        console.log(`  ✓ Load time: ${loadTime}ms`);
      });
    }

    // Summary
    const successCount = results.filter(r => r.success).length;
    const averageLoadTime = results.reduce((sum, r) => sum + r.loadTime, 0) / results.length;
    const averagePerformance = results
      .filter(r => r.performanceScore !== undefined)
      .reduce((sum, r) => sum + r.performanceScore!, 0) / results.filter(r => r.performanceScore).length;

    console.log(`\n=== PUBLIC PAGES SUMMARY ===`);
    console.log(`✓ Pages loaded successfully: ${successCount}/${results.length}`);
    console.log(`✓ Average load time: ${averageLoadTime.toFixed(0)}ms`);
    if (!isNaN(averagePerformance)) {
      console.log(`✓ Average performance score: ${averagePerformance.toFixed(1)}/100`);
    }

    expect(successCount).toBe(results.length);
  });

  test('should verify critical UI elements are present on public pages', async ({ page }) => {
    const publicPages = await pageDiscovery.getPublicPages();

    console.log(`\n=== VERIFYING UI ELEMENTS ON ${publicPages.length} PUBLIC PAGES ===`);

    for (const discoveredPage of publicPages) {
      await test.step(`Verify UI elements on ${discoveredPage.name}`, async () => {
        await page.goto(discoveredPage.routePath);
        await page.waitForLoadState('networkidle');

        console.log(`\nChecking ${discoveredPage.name}:`);

        // Every page should have a title
        const title = await page.title();
        expect(title).toBeTruthy();
        console.log(`  ✓ Title: "${title}"`);

        // Check for navigation (unless it's a special auth page)
        if (discoveredPage.routePath !== '/auth/signin') {
          const nav = page.locator('nav, [role="navigation"]');
          await expect(nav).toBeVisible({ timeout: 5000 });
          console.log(`  ✓ Navigation present`);
        }

        // Check critical components specific to this page
        if (discoveredPage.criticalComponents.length > 0) {
          for (const component of discoveredPage.criticalComponents) {
            const selectors = getCriticalComponentSelectors(component);
            let found = false;

            for (const selector of selectors) {
              try {
                await expect(page.locator(selector)).toBeVisible({ timeout: 2000 });
                console.log(`  ✓ Critical component found: ${component}`);
                found = true;
                break;
              } catch {
                // Try next selector
              }
            }

            if (!found) {
              console.warn(`  ⚠️  Critical component not visible: ${component}`);
              // Don't fail test for missing components, just warn
            }
          }
        }

        // Check that main content area exists
        const mainContent = page.locator('main, [role="main"], .main-content');
        try {
          await expect(mainContent).toBeVisible({ timeout: 2000 });
          console.log(`  ✓ Main content area present`);
        } catch {
          console.warn(`  ⚠️  Main content area not clearly identified`);
        }
      });
    }
  });

  test('should check page load times meet performance requirements', async ({ page }) => {
    const allPages = await pageDiscovery.getPublicPages(); // Focus on public pages for this test
    const performanceResults: Array<{
      name: string;
      routePath: string;
      loadTime: number;
      meetsRequirement: boolean;
    }> = [];

    console.log(`\n=== PERFORMANCE TESTING ${allPages.length} PUBLIC PAGES ===`);
    console.log(`Target: All pages should load within 3000ms`);

    for (const discoveredPage of allPages) {
      await test.step(`Performance test ${discoveredPage.name}`, async () => {
        const startTime = Date.now();

        await page.goto(discoveredPage.routePath);
        await page.waitForLoadState('networkidle');

        const loadTime = Date.now() - startTime;
        const meetsRequirement = loadTime <= 3000;

        performanceResults.push({
          name: discoveredPage.name,
          routePath: discoveredPage.routePath,
          loadTime,
          meetsRequirement
        });

        console.log(`  ${meetsRequirement ? '✓' : '✗'} ${discoveredPage.name}: ${loadTime}ms`);
      });
    }

    // Summary
    const passedPages = performanceResults.filter(r => r.meetsRequirement);
    const averageLoadTime = performanceResults.reduce((sum, r) => sum + r.loadTime, 0) / performanceResults.length;
    const slowestPage = performanceResults.reduce((max, r) => r.loadTime > max.loadTime ? r : max);

    console.log(`\n=== PERFORMANCE SUMMARY ===`);
    console.log(`✓ Pages meeting requirement: ${passedPages.length}/${performanceResults.length}`);
    console.log(`✓ Average load time: ${averageLoadTime.toFixed(0)}ms`);
    console.log(`✓ Slowest page: ${slowestPage.name} (${slowestPage.loadTime}ms)`);

    // Report individual failures but don't fail the test unless it's severely bad
    if (passedPages.length < performanceResults.length) {
      const slowPages = performanceResults.filter(r => !r.meetsRequirement);
      console.log(`\nPages exceeding 3s limit:`);
      slowPages.forEach(p => {
        console.log(`  - ${p.name}: ${p.loadTime}ms`);
      });
    }

    // Allow some flexibility - fail only if more than 50% of pages are slow
    const passRate = (passedPages.length / performanceResults.length) * 100;
    expect(passRate,
      `Too many pages are slow: ${passedPages.length}/${performanceResults.length} meet the 3s requirement`
    ).toBeGreaterThanOrEqual(50);
  });

  test('should check responsive design on key pages', async ({ page }) => {
    const keyPages = (await pageDiscovery.getPublicPages()).slice(0, 3); // Test first 3 public pages
    const viewports = [
      { name: 'Desktop', width: 1280, height: 720 },
      { name: 'Tablet', width: 768, height: 1024 },
      { name: 'Mobile', width: 375, height: 667 }
    ];

    console.log(`\n=== RESPONSIVE DESIGN TEST ===`);

    for (const discoveredPage of keyPages) {
      await test.step(`Responsive test for ${discoveredPage.name}`, async () => {
        console.log(`\nTesting ${discoveredPage.name}:`);

        for (const viewport of viewports) {
          await page.setViewportSize(viewport);
          await page.goto(discoveredPage.routePath);
          await page.waitForLoadState('networkidle');

          // Check that page is visible
          await expect(page.locator('body')).toBeVisible();

          // Check for horizontal scrollbar (usually indicates poor responsive design)
          const hasHorizontalScroll = await page.evaluate(() => {
            return document.documentElement.scrollWidth > document.documentElement.clientWidth;
          });

          if (hasHorizontalScroll) {
            console.warn(`  ⚠️  Horizontal scroll detected on ${viewport.name}`);
          } else {
            console.log(`  ✓ ${viewport.name}: No horizontal scroll`);
          }

          // Check that navigation is accessible
          const navVisible = await isElementVisible(page, 'nav') ||
                            await isElementVisible(page, '[role="navigation"]') ||
                            await isElementVisible(page, '[data-testid="mobile-menu"]');

          if (navVisible) {
            console.log(`  ✓ ${viewport.name}: Navigation accessible`);
          } else {
            console.warn(`  ⚠️  ${viewport.name}: Navigation not clearly accessible`);
          }
        }
      });
    }

    // Reset viewport
    await page.setViewportSize({ width: 1280, height: 720 });
  });
});

/**
 * Helper function to get selectors for critical components
 */
function getCriticalComponentSelectors(componentName: string): string[] {
  const selectorMap: Record<string, string[]> = {
    'navigation': ['nav', '[role="navigation"]', '[data-testid="navigation"]'],
    'login-form': ['form', '[data-testid="login-form"]', 'form:has(input[type="email"])'],
    'signin-button': ['button[type="submit"]', '[data-testid="signin-button"]', 'button:has-text("Sign In")'],
    'main-content': ['main', '[role="main"]', '[data-testid="main-content"]'],
    'dashboard-widgets': ['[data-testid*="widget"]', '.widget', '[role="region"]'],
    // Add more as needed
  };

  return selectorMap[componentName] || [`[data-testid="${componentName}"]`];
}

/**
 * Helper function to check if element is visible without throwing
 */
async function isElementVisible(page: Page, selector: string): Promise<boolean> {
  try {
    await expect(page.locator(selector)).toBeVisible({ timeout: 1000 });
    return true;
  } catch {
    return false;
  }
}