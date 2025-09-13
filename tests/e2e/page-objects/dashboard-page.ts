import { Page, expect } from '@playwright/test';
import { BasePage } from './base-page';

/**
 * Page Object for the main dashboard page
 */
export class DashboardPage extends BasePage {
  // Selectors
  private readonly headerTitle = '[data-testid="header-title"]';
  private readonly userMenu = '[data-testid="user-menu"]';
  private readonly logoutButton = '[data-testid="logout-button"]';
  private readonly navigationMenu = '[data-testid="navigation-menu"]';
  private readonly dashboardStats = '[data-testid="dashboard-stats"]';

  // Navigation links
  private readonly vendorsLink = '[data-testid="nav-vendors"]';
  private readonly purchasesLink = '[data-testid="nav-purchases"]';
  private readonly pressLink = '[data-testid="nav-press"]';
  private readonly batchesLink = '[data-testid="nav-batches"]';
  private readonly inventoryLink = '[data-testid="nav-inventory"]';
  private readonly reportsLink = '[data-testid="nav-reports"]';

  constructor(page: Page) {
    super(page);
  }

  /**
   * Navigate to dashboard
   */
  async navigate(): Promise<void> {
    await this.goto('/dashboard');
    await this.waitForLoad();
  }

  /**
   * Check if we're on the dashboard page
   */
  async isOnDashboard(): Promise<boolean> {
    return await this.isVisible(this.dashboardStats);
  }

  /**
   * Get the header title
   */
  async getHeaderTitle(): Promise<string | null> {
    return await this.getTextContent(this.headerTitle);
  }

  /**
   * Open user menu
   */
  async openUserMenu(): Promise<void> {
    await this.page.locator(this.userMenu).click();
  }

  /**
   * Logout user
   */
  async logout(): Promise<void> {
    await this.openUserMenu();
    await this.page.locator(this.logoutButton).click();
    await this.waitForLoadingToComplete();
  }

  /**
   * Navigate to vendors page
   */
  async navigateToVendors(): Promise<void> {
    await this.page.locator(this.vendorsLink).click();
    await this.waitForLoadingToComplete();
  }

  /**
   * Navigate to purchases page
   */
  async navigateToPurchases(): Promise<void> {
    await this.page.locator(this.purchasesLink).click();
    await this.waitForLoadingToComplete();
  }

  /**
   * Navigate to press page
   */
  async navigateToPress(): Promise<void> {
    await this.page.locator(this.pressLink).click();
    await this.waitForLoadingToComplete();
  }

  /**
   * Navigate to batches page
   */
  async navigateToBatches(): Promise<void> {
    await this.page.locator(this.batchesLink).click();
    await this.waitForLoadingToComplete();
  }

  /**
   * Navigate to inventory page
   */
  async navigateToInventory(): Promise<void> {
    await this.page.locator(this.inventoryLink).click();
    await this.waitForLoadingToComplete();
  }

  /**
   * Navigate to reports page
   */
  async navigateToReports(): Promise<void> {
    await this.page.locator(this.reportsLink).click();
    await this.waitForLoadingToComplete();
  }

  /**
   * Check if navigation menu is visible
   */
  async hasNavigationMenu(): Promise<boolean> {
    return await this.isVisible(this.navigationMenu);
  }

  /**
   * Get dashboard statistics
   */
  async getDashboardStats(): Promise<Record<string, string>> {
    const stats: Record<string, string> = {};

    // Wait for stats to load
    await this.waitForElement(this.dashboardStats);

    // Extract common dashboard metrics
    const statElements = await this.page.locator(`${this.dashboardStats} [data-testid*="stat-"]`).all();

    for (const element of statElements) {
      const testId = await element.getAttribute('data-testid');
      const value = await element.textContent();
      if (testId && value) {
        const key = testId.replace('stat-', '');
        stats[key] = value.trim();
      }
    }

    return stats;
  }

  /**
   * Check if user has access to a specific navigation item
   */
  async hasAccessToNavigation(navigationItem: string): Promise<boolean> {
    const selector = `[data-testid="nav-${navigationItem}"]`;
    return await this.isVisible(selector);
  }

  /**
   * Get all visible navigation items
   */
  async getVisibleNavigationItems(): Promise<string[]> {
    const navItems: string[] = [];
    const navElements = await this.page.locator(`${this.navigationMenu} [data-testid^="nav-"]`).all();

    for (const element of navElements) {
      const testId = await element.getAttribute('data-testid');
      if (testId && await element.isVisible()) {
        navItems.push(testId.replace('nav-', ''));
      }
    }

    return navItems;
  }

  /**
   * Wait for dashboard to fully load
   */
  async waitForDashboardLoad(): Promise<void> {
    await this.waitForElement(this.dashboardStats);
    await this.waitForLoadingToComplete();
  }

  /**
   * Check if a specific statistic is displayed
   */
  async hasStatistic(statName: string): Promise<boolean> {
    return await this.isVisible(`[data-testid="stat-${statName}"]`);
  }

  /**
   * Get specific statistic value
   */
  async getStatisticValue(statName: string): Promise<string | null> {
    const selector = `[data-testid="stat-${statName}"]`;
    if (await this.isVisible(selector)) {
      return await this.getTextContent(selector);
    }
    return null;
  }
}