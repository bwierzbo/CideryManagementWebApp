import { Page, Locator, expect } from '@playwright/test';

/**
 * Base page class that provides common functionality for all page objects
 */
export class BasePage {
  readonly page: Page;

  constructor(page: Page) {
    this.page = page;
  }

  /**
   * Navigate to a specific URL
   */
  async goto(url: string): Promise<void> {
    await this.page.goto(url);
  }

  /**
   * Wait for page to be loaded
   */
  async waitForLoad(): Promise<void> {
    await this.page.waitForLoadState('networkidle');
  }

  /**
   * Get page title
   */
  async getTitle(): Promise<string> {
    return await this.page.title();
  }

  /**
   * Get current URL
   */
  getCurrentUrl(): string {
    return this.page.url();
  }

  /**
   * Wait for a specific element to be visible
   */
  async waitForElement(selector: string): Promise<Locator> {
    const element = this.page.locator(selector);
    await expect(element).toBeVisible();
    return element;
  }

  /**
   * Fill a form field by label or placeholder
   */
  async fillField(fieldLabel: string, value: string): Promise<void> {
    const field = this.page.getByLabel(fieldLabel).or(this.page.getByPlaceholder(fieldLabel));
    await field.fill(value);
  }

  /**
   * Click a button by text
   */
  async clickButton(buttonText: string): Promise<void> {
    await this.page.getByRole('button', { name: buttonText }).click();
  }

  /**
   * Click a link by text
   */
  async clickLink(linkText: string): Promise<void> {
    await this.page.getByRole('link', { name: linkText }).click();
  }

  /**
   * Get text content of an element
   */
  async getTextContent(selector: string): Promise<string | null> {
    return await this.page.locator(selector).textContent();
  }

  /**
   * Check if element is visible
   */
  async isVisible(selector: string): Promise<boolean> {
    try {
      await expect(this.page.locator(selector)).toBeVisible({ timeout: 1000 });
      return true;
    } catch {
      return false;
    }
  }

  /**
   * Check if element contains text
   */
  async containsText(selector: string, text: string): Promise<boolean> {
    try {
      await expect(this.page.locator(selector)).toContainText(text, { timeout: 1000 });
      return true;
    } catch {
      return false;
    }
  }

  /**
   * Wait for a toast/notification message
   */
  async waitForNotification(message?: string): Promise<void> {
    const notification = this.page.locator('[data-testid="notification"], .toast, [role="alert"]').first();
    await expect(notification).toBeVisible();

    if (message) {
      await expect(notification).toContainText(message);
    }
  }

  /**
   * Wait for and handle a loading state
   */
  async waitForLoadingToComplete(): Promise<void> {
    // Wait for any loading spinners to disappear
    const loadingSelectors = [
      '[data-testid="loading"]',
      '.loading-spinner',
      '[aria-label="Loading"]'
    ];

    for (const selector of loadingSelectors) {
      try {
        await expect(this.page.locator(selector)).toBeHidden({ timeout: 5000 });
      } catch {
        // Ignore if element doesn't exist
      }
    }
  }

  /**
   * Take a screenshot for debugging
   */
  async screenshot(name?: string): Promise<Buffer> {
    const screenshotName = name || `${Date.now()}-debug.png`;
    return await this.page.screenshot({
      path: `test-results/screenshots/${screenshotName}`,
      fullPage: true
    });
  }

  /**
   * Scroll element into view
   */
  async scrollIntoView(selector: string): Promise<void> {
    await this.page.locator(selector).scrollIntoViewIfNeeded();
  }

  /**
   * Clear and fill a field
   */
  async clearAndFill(selector: string, value: string): Promise<void> {
    await this.page.locator(selector).clear();
    await this.page.locator(selector).fill(value);
  }

  /**
   * Select option from dropdown
   */
  async selectOption(selector: string, value: string): Promise<void> {
    await this.page.locator(selector).selectOption(value);
  }

  /**
   * Double click an element
   */
  async doubleClick(selector: string): Promise<void> {
    await this.page.locator(selector).dblclick();
  }

  /**
   * Right click an element
   */
  async rightClick(selector: string): Promise<void> {
    await this.page.locator(selector).click({ button: 'right' });
  }

  /**
   * Hover over an element
   */
  async hover(selector: string): Promise<void> {
    await this.page.locator(selector).hover();
  }

  /**
   * Press keyboard key
   */
  async pressKey(key: string): Promise<void> {
    await this.page.keyboard.press(key);
  }

  /**
   * Get element count
   */
  async getElementCount(selector: string): Promise<number> {
    return await this.page.locator(selector).count();
  }
}