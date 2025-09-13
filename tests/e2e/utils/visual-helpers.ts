import { Page, expect } from '@playwright/test';

/**
 * Visual testing utilities and helpers
 */
export class VisualHelpers {
  private page: Page;

  constructor(page: Page) {
    this.page = page;
  }

  /**
   * Set standard viewport for consistent visual testing
   */
  async setStandardViewport(): Promise<void> {
    await this.page.setViewportSize({ width: 1280, height: 720 });
  }

  /**
   * Set mobile viewport
   */
  async setMobileViewport(): Promise<void> {
    await this.page.setViewportSize({ width: 375, height: 667 });
  }

  /**
   * Set tablet viewport
   */
  async setTabletViewport(): Promise<void> {
    await this.page.setViewportSize({ width: 768, height: 1024 });
  }

  /**
   * Wait for fonts and images to load
   */
  async waitForVisualStability(): Promise<void> {
    // Wait for network to be idle
    await this.page.waitForLoadState('networkidle');

    // Wait for fonts to load
    await this.page.waitForFunction(() => document.fonts.ready);

    // Wait for images to load
    await this.page.waitForFunction(() => {
      const images = Array.from(document.querySelectorAll('img'));
      return images.every(img => img.complete);
    });

    // Small delay for any CSS animations to settle
    await this.page.waitForTimeout(500);
  }

  /**
   * Hide dynamic content for consistent screenshots
   */
  async hideDynamicContent(): Promise<void> {
    // Hide timestamps, counters, and other dynamic content
    await this.page.addStyleTag({
      content: `
        [data-testid*="timestamp"],
        [data-testid*="last-updated"],
        .timestamp,
        .last-updated,
        .dynamic-counter {
          visibility: hidden !important;
        }
      `
    });
  }

  /**
   * Mask sensitive content for screenshots
   */
  async maskSensitiveContent(): Promise<void> {
    await this.page.addStyleTag({
      content: `
        [data-testid*="email"],
        [data-testid*="phone"],
        .email,
        .phone-number {
          filter: blur(3px) !important;
        }
      `
    });
  }

  /**
   * Take screenshot with standard options
   */
  async takeStandardScreenshot(name: string, options: {
    fullPage?: boolean;
    mask?: string[];
    clip?: { x: number; y: number; width: number; height: number };
  } = {}): Promise<Buffer> {
    await this.waitForVisualStability();

    const screenshotOptions = {
      threshold: 0.3,
      fullPage: options.fullPage || false,
      ...options
    };

    return await this.page.screenshot({
      path: `test-results/screenshots/${name}`,
      ...screenshotOptions
    });
  }

  /**
   * Compare element to baseline screenshot
   */
  async compareElement(selector: string, name: string): Promise<void> {
    await this.waitForVisualStability();

    const element = this.page.locator(selector);
    await expect(element).toHaveScreenshot(`${name}.png`, {
      threshold: 0.3
    });
  }

  /**
   * Compare full page to baseline screenshot
   */
  async compareFullPage(name: string): Promise<void> {
    await this.waitForVisualStability();

    await expect(this.page).toHaveScreenshot(`${name}.png`, {
      fullPage: true,
      threshold: 0.3
    });
  }

  /**
   * Test responsive design across multiple viewports
   */
  async testResponsiveDesign(name: string): Promise<void> {
    // Desktop
    await this.setStandardViewport();
    await this.compareFullPage(`${name}-desktop`);

    // Tablet
    await this.setTabletViewport();
    await this.compareFullPage(`${name}-tablet`);

    // Mobile
    await this.setMobileViewport();
    await this.compareFullPage(`${name}-mobile`);

    // Reset to standard
    await this.setStandardViewport();
  }

  /**
   * Test dark mode (if implemented)
   */
  async testDarkMode(name: string): Promise<void> {
    // Toggle dark mode if available
    const darkModeToggle = this.page.locator('[data-testid="dark-mode-toggle"]');
    if (await darkModeToggle.isVisible({ timeout: 1000 }).catch(() => false)) {
      await darkModeToggle.click();
      await this.waitForVisualStability();
      await this.compareFullPage(`${name}-dark`);
    }
  }

  /**
   * Create visual diff report
   */
  async createVisualDiffReport(testName: string, actualPath: string, expectedPath: string): Promise<void> {
    // This would integrate with a visual diff tool
    // For now, we'll just log the comparison
    console.log(`Visual diff for ${testName}:`);
    console.log(`  Expected: ${expectedPath}`);
    console.log(`  Actual: ${actualPath}`);
  }

  /**
   * Test accessibility visual indicators
   */
  async testAccessibilityVisuals(): Promise<void> {
    // Test focus indicators
    await this.page.keyboard.press('Tab');
    await this.waitForVisualStability();

    // Test high contrast mode (if supported)
    await this.page.emulateMedia({ colorScheme: 'dark' });
    await this.waitForVisualStability();
  }

  /**
   * Capture component in different states
   */
  async captureComponentStates(selector: string, name: string): Promise<void> {
    const element = this.page.locator(selector);

    // Default state
    await this.compareElement(selector, `${name}-default`);

    // Hover state
    await element.hover();
    await this.compareElement(selector, `${name}-hover`);

    // Focus state (if applicable)
    if (await element.isEnabled().catch(() => false)) {
      await element.focus();
      await this.compareElement(selector, `${name}-focus`);
    }

    // Disabled state (if applicable)
    const disabledSelector = `${selector}:disabled, ${selector}[disabled]`;
    if (await this.page.locator(disabledSelector).count() > 0) {
      await this.compareElement(disabledSelector, `${name}-disabled`);
    }
  }

  /**
   * Test print styles
   */
  async testPrintStyles(name: string): Promise<void> {
    await this.page.emulateMedia({ media: 'print' });
    await this.waitForVisualStability();
    await this.compareFullPage(`${name}-print`);

    // Reset to screen
    await this.page.emulateMedia({ media: 'screen' });
  }
}