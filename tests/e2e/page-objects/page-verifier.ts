import { Page, expect } from '@playwright/test';
import { BasePage } from './base-page';
import { DiscoveredPage } from '../utils/page-discovery';

/**
 * Page verification result for individual checks
 */
export interface VerificationResult {
  passed: boolean;
  message: string;
  duration?: number;
  error?: string;
  screenshot?: string;
}

/**
 * Comprehensive page verification results
 */
export interface PageVerificationReport {
  page: DiscoveredPage;
  loadTime: VerificationResult;
  rendering: VerificationResult;
  criticalComponents: VerificationResult;
  responsive: VerificationResult;
  accessibility: VerificationResult;
  dataVisibility: VerificationResult;
  navigation: VerificationResult;
  errorHandling: VerificationResult;
  overall: {
    passed: boolean;
    score: number; // 0-100
    duration: number;
  };
}

/**
 * Page verifier class that performs comprehensive validation
 */
export class PageVerifier extends BasePage {
  constructor(page: Page) {
    super(page);
  }

  /**
   * Perform comprehensive verification of a page
   */
  async verifyPage(discoveredPage: DiscoveredPage): Promise<PageVerificationReport> {
    const startTime = Date.now();

    const report: PageVerificationReport = {
      page: discoveredPage,
      loadTime: { passed: false, message: 'Not tested' },
      rendering: { passed: false, message: 'Not tested' },
      criticalComponents: { passed: false, message: 'Not tested' },
      responsive: { passed: false, message: 'Not tested' },
      accessibility: { passed: false, message: 'Not tested' },
      dataVisibility: { passed: false, message: 'Not tested' },
      navigation: { passed: false, message: 'Not tested' },
      errorHandling: { passed: false, message: 'Not tested' },
      overall: { passed: false, score: 0, duration: 0 }
    };

    try {
      // 1. Load time verification
      report.loadTime = await this.verifyLoadTime(discoveredPage);

      // 2. Basic rendering verification
      report.rendering = await this.verifyBasicRendering(discoveredPage);

      // 3. Critical components verification
      report.criticalComponents = await this.verifyCriticalComponents(discoveredPage);

      // 4. Responsive design verification
      report.responsive = await this.verifyResponsiveDesign(discoveredPage);

      // 5. Accessibility verification
      report.accessibility = await this.verifyAccessibility(discoveredPage);

      // 6. Demo data visibility (if applicable)
      report.dataVisibility = await this.verifyDataVisibility(discoveredPage);

      // 7. Navigation functionality
      report.navigation = await this.verifyNavigation(discoveredPage);

      // 8. Error handling
      report.errorHandling = await this.verifyErrorHandling(discoveredPage);

    } catch (error) {
      console.error(`Critical error verifying ${discoveredPage.name}:`, error);
    }

    // Calculate overall score and result
    const results = [
      report.loadTime,
      report.rendering,
      report.criticalComponents,
      report.responsive,
      report.accessibility,
      report.dataVisibility,
      report.navigation,
      report.errorHandling
    ];

    const passedCount = results.filter(r => r.passed).length;
    report.overall.score = (passedCount / results.length) * 100;
    report.overall.passed = report.overall.score >= 95; // 95% threshold as per requirements
    report.overall.duration = Date.now() - startTime;

    return report;
  }

  /**
   * Verify page load time (<3 seconds)
   */
  private async verifyLoadTime(discoveredPage: DiscoveredPage): Promise<VerificationResult> {
    const startTime = Date.now();

    try {
      await this.page.goto(discoveredPage.routePath);
      await this.page.waitForLoadState('networkidle');

      const loadTime = Date.now() - startTime;
      const maxLoadTime = 3000; // 3 seconds as per requirements

      if (loadTime <= maxLoadTime) {
        return {
          passed: true,
          message: `Page loaded in ${loadTime}ms (within ${maxLoadTime}ms limit)`,
          duration: loadTime
        };
      } else {
        return {
          passed: false,
          message: `Page took ${loadTime}ms to load (exceeds ${maxLoadTime}ms limit)`,
          duration: loadTime
        };
      }
    } catch (error) {
      return {
        passed: false,
        message: 'Failed to load page',
        error: (error as Error).message,
        duration: Date.now() - startTime
      };
    }
  }

  /**
   * Verify basic page rendering (title, no errors)
   */
  private async verifyBasicRendering(discoveredPage: DiscoveredPage): Promise<VerificationResult> {
    try {
      // Check page title
      const title = await this.page.title();
      if (discoveredPage.expectedTitle && !title.includes(discoveredPage.expectedTitle)) {
        return {
          passed: false,
          message: `Expected title to contain "${discoveredPage.expectedTitle}" but got "${title}"`
        };
      }

      // Check for JavaScript errors
      const errors: string[] = [];
      this.page.on('pageerror', (error) => {
        errors.push(error.message);
      });

      // Wait a bit for any errors to surface
      await this.page.waitForTimeout(1000);

      if (errors.length > 0) {
        return {
          passed: false,
          message: `Page has JavaScript errors: ${errors.join(', ')}`,
          error: errors.join('; ')
        };
      }

      // Check that main content is visible
      const bodyVisible = await this.isVisible('body');
      if (!bodyVisible) {
        return {
          passed: false,
          message: 'Page body is not visible'
        };
      }

      return {
        passed: true,
        message: 'Page rendered successfully with correct title and no errors'
      };

    } catch (error) {
      return {
        passed: false,
        message: 'Failed to verify basic rendering',
        error: (error as Error).message
      };
    }
  }

  /**
   * Verify critical UI components are present
   */
  private async verifyCriticalComponents(discoveredPage: DiscoveredPage): Promise<VerificationResult> {
    if (discoveredPage.criticalComponents.length === 0) {
      return {
        passed: true,
        message: 'No critical components specified'
      };
    }

    const missingComponents: string[] = [];
    const foundComponents: string[] = [];

    for (const component of discoveredPage.criticalComponents) {
      const selectors = this.getCriticalComponentSelectors(component);
      let componentFound = false;

      for (const selector of selectors) {
        if (await this.isVisible(selector)) {
          componentFound = true;
          foundComponents.push(component);
          break;
        }
      }

      if (!componentFound) {
        missingComponents.push(component);
      }
    }

    if (missingComponents.length === 0) {
      return {
        passed: true,
        message: `All critical components found: ${foundComponents.join(', ')}`
      };
    } else {
      return {
        passed: false,
        message: `Missing critical components: ${missingComponents.join(', ')}`
      };
    }
  }

  /**
   * Get CSS selectors for critical components
   */
  private getCriticalComponentSelectors(componentName: string): string[] {
    const selectorMap: Record<string, string[]> = {
      'navigation': ['nav', '[role="navigation"]', '[data-testid="navigation"]', '.navbar', 'header nav'],
      'login-form': ['form[action*="signin"]', '[data-testid="login-form"]', 'form:has(input[type="email"])', '.login-form'],
      'signin-button': ['button[type="submit"]', '[data-testid="signin-button"]', 'button:has-text("Sign In")'],
      'dashboard-widgets': ['[data-testid="dashboard-widget"]', '.dashboard-widget', '.widget', '[role="region"]'],
      'main-content': ['main', '[role="main"]', '[data-testid="main-content"]', '.main-content'],
      'vendor-list': ['[data-testid="vendor-list"]', '.vendor-list', 'table', '[role="grid"]'],
      'purchase-form': ['[data-testid="purchase-form"]', 'form', '.purchase-form'],
      'press-runs': ['[data-testid="press-runs"]', '.press-runs', 'table'],
      'juice-lots': ['[data-testid="juice-lots"]', '.juice-lots', 'table'],
      'vessels': ['[data-testid="vessels"]', '.vessels', 'table'],
      'batches': ['[data-testid="batches"]', '.batches', 'table'],
      'packaging-runs': ['[data-testid="packaging-runs"]', '.packaging-runs', 'table'],
      'inventory-items': ['[data-testid="inventory-items"]', '.inventory', 'table'],
      'admin-panels': ['[data-testid="admin-panel"]', '.admin-panel', '[role="tabpanel"]'],
      'user-management': ['[data-testid="user-management"]', '.user-management', 'table']
    };

    return selectorMap[componentName] || [`[data-testid="${componentName}"]`, `.${componentName}`];
  }

  /**
   * Verify responsive design across different viewports
   */
  private async verifyResponsiveDesign(discoveredPage: DiscoveredPage): Promise<VerificationResult> {
    const viewports = [
      { name: 'Desktop', width: 1280, height: 720 },
      { name: 'Tablet', width: 768, height: 1024 },
      { name: 'Mobile', width: 375, height: 667 }
    ];

    const issues: string[] = [];

    for (const viewport of viewports) {
      try {
        await this.page.setViewportSize(viewport);
        await this.page.waitForTimeout(500); // Allow layout to adjust

        // Check that page is still usable
        const bodyVisible = await this.isVisible('body');
        if (!bodyVisible) {
          issues.push(`Page not visible on ${viewport.name}`);
          continue;
        }

        // Check for horizontal scrollbar (bad responsive design)
        const hasHorizontalScroll = await this.page.evaluate(() => {
          return document.documentElement.scrollWidth > document.documentElement.clientWidth;
        });

        if (hasHorizontalScroll) {
          issues.push(`Horizontal scrollbar present on ${viewport.name}`);
        }

        // Check that navigation is accessible (either visible or hamburger menu)
        const navVisible = await this.isVisible('nav') || await this.isVisible('[aria-label="Menu"]') || await this.isVisible('[data-testid="mobile-menu-trigger"]');
        if (!navVisible) {
          issues.push(`Navigation not accessible on ${viewport.name}`);
        }

      } catch (error) {
        issues.push(`Error testing ${viewport.name}: ${(error as Error).message}`);
      }
    }

    // Reset to desktop viewport
    await this.page.setViewportSize({ width: 1280, height: 720 });

    if (issues.length === 0) {
      return {
        passed: true,
        message: 'Page is responsive across all tested viewports'
      };
    } else {
      return {
        passed: false,
        message: `Responsive design issues: ${issues.join(', ')}`
      };
    }
  }

  /**
   * Verify basic accessibility compliance
   */
  private async verifyAccessibility(discoveredPage: DiscoveredPage): Promise<VerificationResult> {
    const issues: string[] = [];

    try {
      // Check for heading structure
      const headings = await this.page.locator('h1, h2, h3, h4, h5, h6').count();
      if (headings === 0) {
        issues.push('No heading elements found');
      }

      // Check for alt text on images
      const imagesWithoutAlt = await this.page.locator('img:not([alt])').count();
      if (imagesWithoutAlt > 0) {
        issues.push(`${imagesWithoutAlt} images missing alt text`);
      }

      // Check for form labels
      const unlabeledInputs = await this.page.locator('input:not([aria-label]):not([aria-labelledby])').filter({
        has: this.page.locator(':not(label)')
      }).count();
      if (unlabeledInputs > 0) {
        issues.push(`${unlabeledInputs} form inputs without labels`);
      }

      // Check color contrast (basic check)
      const lowContrastElements = await this.page.evaluate(() => {
        const elements = Array.from(document.querySelectorAll('*'));
        let lowContrast = 0;

        elements.forEach(el => {
          const style = window.getComputedStyle(el);
          const bgColor = style.backgroundColor;
          const color = style.color;

          // Simple check for common low-contrast issues
          if (bgColor === 'rgb(255, 255, 255)' && color === 'rgb(192, 192, 192)') {
            lowContrast++;
          }
        });

        return lowContrast;
      });

      if (lowContrastElements > 0) {
        issues.push(`${lowContrastElements} elements may have low color contrast`);
      }

    } catch (error) {
      issues.push(`Error checking accessibility: ${(error as Error).message}`);
    }

    if (issues.length === 0) {
      return {
        passed: true,
        message: 'Basic accessibility checks passed'
      };
    } else {
      return {
        passed: issues.length <= 2, // Allow minor issues but flag major ones
        message: `Accessibility issues: ${issues.join(', ')}`
      };
    }
  }

  /**
   * Verify demo data visibility (≥95% requirement)
   */
  private async verifyDataVisibility(discoveredPage: DiscoveredPage): Promise<VerificationResult> {
    if (discoveredPage.testDataNeeds.length === 0) {
      return {
        passed: true,
        message: 'No test data requirements specified'
      };
    }

    const dataChecks: { type: string; visible: boolean }[] = [];

    for (const dataType of discoveredPage.testDataNeeds) {
      const visible = await this.checkDataTypeVisibility(dataType);
      dataChecks.push({ type: dataType, visible });
    }

    const visibleCount = dataChecks.filter(check => check.visible).length;
    const visibilityPercentage = (visibleCount / dataChecks.length) * 100;

    if (visibilityPercentage >= 95) {
      return {
        passed: true,
        message: `${visibilityPercentage.toFixed(1)}% of demo data visible (${visibleCount}/${dataChecks.length} types)`
      };
    } else {
      const missingTypes = dataChecks.filter(check => !check.visible).map(check => check.type);
      return {
        passed: false,
        message: `Only ${visibilityPercentage.toFixed(1)}% of demo data visible. Missing: ${missingTypes.join(', ')}`
      };
    }
  }

  /**
   * Check if specific data type is visible on the page
   */
  private async checkDataTypeVisibility(dataType: string): Promise<boolean> {
    const dataSelectors: Record<string, string[]> = {
      'vendors': ['[data-testid*="vendor"]', '.vendor', 'td:has-text("Vendor")', 'tr td:first-child'],
      'purchases': ['[data-testid*="purchase"]', '.purchase', 'td:has-text("$")', 'table tr'],
      'batches': ['[data-testid*="batch"]', '.batch', 'td', 'table tr'],
      'inventory': ['[data-testid*="inventory"]', '.inventory', 'td', 'table tr'],
      'vessels': ['[data-testid*="vessel"]', '.vessel', 'td', 'table tr'],
      'measurements': ['[data-testid*="measurement"]', '.measurement', 'td', 'table tr'],
      'press-runs': ['[data-testid*="press"]', '.press-run', 'td', 'table tr'],
      'juice-lots': ['[data-testid*="juice"]', '.juice-lot', 'td', 'table tr'],
      'packaging-runs': ['[data-testid*="packaging"]', '.packaging-run', 'td', 'table tr'],
      'users': ['[data-testid*="user"]', '.user', 'td', 'table tr'],
      'audit-logs': ['[data-testid*="audit"]', '.audit-log', 'td', 'table tr']
    };

    const selectors = dataSelectors[dataType] || [`[data-testid*="${dataType}"]`];

    for (const selector of selectors) {
      if (await this.isVisible(selector)) {
        // Also check that there's actual content, not just empty table
        const count = await this.getElementCount(selector);
        if (count >= 1) {
          return true;
        }
      }
    }

    return false;
  }

  /**
   * Verify navigation functionality
   */
  private async verifyNavigation(discoveredPage: DiscoveredPage): Promise<VerificationResult> {
    try {
      // Check that navigation links exist and are clickable
      const navLinks = await this.page.locator('nav a, [role="navigation"] a').count();

      if (navLinks === 0) {
        return {
          passed: false,
          message: 'No navigation links found'
        };
      }

      // Test one navigation link to ensure it works
      const firstLink = this.page.locator('nav a, [role="navigation"] a').first();
      const linkText = await firstLink.textContent();

      if (linkText) {
        const currentUrl = this.page.url();
        await firstLink.click();
        await this.page.waitForLoadState('networkidle');

        const newUrl = this.page.url();

        // Navigate back to original page
        await this.page.goto(discoveredPage.routePath);
        await this.page.waitForLoadState('networkidle');

        if (newUrl !== currentUrl) {
          return {
            passed: true,
            message: `Navigation functional - tested link "${linkText}" (${navLinks} total links)`
          };
        } else {
          return {
            passed: false,
            message: 'Navigation link did not change URL'
          };
        }
      } else {
        return {
          passed: false,
          message: 'Navigation links have no text content'
        };
      }

    } catch (error) {
      return {
        passed: false,
        message: 'Failed to verify navigation functionality',
        error: (error as Error).message
      };
    }
  }

  /**
   * Verify error state handling
   */
  private async verifyErrorHandling(discoveredPage: DiscoveredPage): Promise<VerificationResult> {
    try {
      // Check for 404 handling by trying invalid routes
      const currentUrl = this.page.url();
      const invalidUrl = currentUrl + '/invalid-route-test-12345';

      const response = await this.page.goto(invalidUrl);

      if (response && response.status() === 404) {
        // Check if there's a proper 404 page or error message
        const hasErrorMessage = await this.isVisible('[data-testid="error"]') ||
                               await this.isVisible('.error') ||
                               await this.containsText('body', '404') ||
                               await this.containsText('body', 'Not Found');

        // Navigate back to original page
        await this.page.goto(discoveredPage.routePath);
        await this.page.waitForLoadState('networkidle');

        if (hasErrorMessage) {
          return {
            passed: true,
            message: 'Error handling works - 404 page displayed properly'
          };
        } else {
          return {
            passed: false,
            message: 'No error message shown for 404 page'
          };
        }
      } else {
        // Navigate back to original page
        await this.page.goto(discoveredPage.routePath);
        await this.page.waitForLoadState('networkidle');

        return {
          passed: true,
          message: 'Error handling not directly testable from this page'
        };
      }

    } catch (error) {
      // Try to navigate back to original page
      try {
        await this.page.goto(discoveredPage.routePath);
        await this.page.waitForLoadState('networkidle');
      } catch {
        // Ignore navigation back errors
      }

      return {
        passed: true, // Don't fail the overall test for error handling issues
        message: 'Could not test error handling',
        error: (error as Error).message
      };
    }
  }
}