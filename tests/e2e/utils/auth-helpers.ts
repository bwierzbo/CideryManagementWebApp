import { Page, expect } from '@playwright/test';
import { LoginPage } from '../page-objects/login-page';
import { DashboardPage } from '../page-objects/dashboard-page';

export interface TestUser {
  email: string;
  password: string;
  role: 'admin' | 'operator' | 'viewer';
  name: string;
}

/**
 * Predefined test users with known credentials
 */
export const TEST_USERS: Record<string, TestUser> = {
  admin: {
    email: 'test-admin@example.com',
    password: 'password',
    role: 'admin',
    name: 'Test Admin'
  },
  operator: {
    email: 'test-operator@example.com',
    password: 'password',
    role: 'operator',
    name: 'Test Operator'
  },
  viewer: {
    email: 'test-viewer@example.com',
    password: 'password',
    role: 'viewer',
    name: 'Test Viewer'
  }
};

/**
 * Authentication helper class for E2E tests
 */
export class AuthHelper {
  private page: Page;
  private loginPage: LoginPage;
  private dashboardPage: DashboardPage;

  constructor(page: Page) {
    this.page = page;
    this.loginPage = new LoginPage(page);
    this.dashboardPage = new DashboardPage(page);
  }

  /**
   * Login with a specific user
   */
  async loginAs(userType: keyof typeof TEST_USERS): Promise<void> {
    const user = TEST_USERS[userType];
    if (!user) {
      throw new Error(`User type '${userType}' not found`);
    }

    await this.loginPage.navigate();
    await this.loginPage.login(user.email, user.password);
    await this.loginPage.waitForSuccessfulLogin();
  }

  /**
   * Login with custom credentials
   */
  async loginWithCredentials(email: string, password: string): Promise<void> {
    await this.loginPage.navigate();
    await this.loginPage.login(email, password);
    await this.loginPage.waitForSuccessfulLogin();
  }

  /**
   * Logout current user
   */
  async logout(): Promise<void> {
    await this.dashboardPage.logout();
    // Verify we're back on login page
    await expect(this.page).toHaveURL(/\/auth\/signin/);
  }

  /**
   * Check if user is currently logged in
   */
  async isLoggedIn(): Promise<boolean> {
    // Check if we're on a protected page (not login page)
    const currentUrl = this.page.url();
    return !currentUrl.includes('/auth/signin');
  }

  /**
   * Verify user has access to specific navigation items based on role
   */
  async verifyRoleBasedAccess(expectedAccess: string[]): Promise<void> {
    await this.dashboardPage.navigate();
    await this.dashboardPage.waitForDashboardLoad();

    const visibleNavItems = await this.dashboardPage.getVisibleNavigationItems();

    // Check that user has access to expected items
    for (const item of expectedAccess) {
      expect(visibleNavItems).toContain(item);
    }
  }

  /**
   * Verify user does NOT have access to specific navigation items
   */
  async verifyNoAccess(restrictedItems: string[]): Promise<void> {
    await this.dashboardPage.navigate();
    await this.dashboardPage.waitForDashboardLoad();

    const visibleNavItems = await this.dashboardPage.getVisibleNavigationItems();

    // Check that user does NOT have access to restricted items
    for (const item of restrictedItems) {
      expect(visibleNavItems).not.toContain(item);
    }
  }

  /**
   * Verify admin-specific access
   */
  async verifyAdminAccess(): Promise<void> {
    const adminAccess = ['vendors', 'purchases', 'press', 'batches', 'inventory', 'reports'];
    await this.verifyRoleBasedAccess(adminAccess);
  }

  /**
   * Verify operator-specific access
   */
  async verifyOperatorAccess(): Promise<void> {
    const operatorAccess = ['purchases', 'press', 'batches', 'inventory'];
    const restrictedAccess = ['vendors', 'reports']; // Operators might not have vendor/report access

    await this.verifyRoleBasedAccess(operatorAccess);
    // Uncomment if operators should have restricted access
    // await this.verifyNoAccess(restrictedAccess);
  }

  /**
   * Verify viewer-specific access
   */
  async verifyViewerAccess(): Promise<void> {
    const viewerAccess = ['batches', 'inventory']; // Viewers have read-only access
    const restrictedAccess = ['vendors', 'purchases', 'press']; // No write access

    await this.verifyRoleBasedAccess(viewerAccess);
    await this.verifyNoAccess(restrictedAccess);
  }

  /**
   * Test login with invalid credentials
   */
  async testInvalidLogin(email: string, password: string): Promise<void> {
    await this.loginPage.navigate();
    await this.loginPage.login(email, password);

    // Should see error message
    await expect(this.page.locator('[data-testid="error-message"]')).toBeVisible();

    // Should still be on login page
    await expect(this.page).toHaveURL(/\/auth\/signin/);
  }

  /**
   * Test session persistence (refresh page while logged in)
   */
  async testSessionPersistence(): Promise<void> {
    // Ensure we're logged in and on dashboard
    await this.dashboardPage.navigate();
    await this.dashboardPage.waitForDashboardLoad();

    // Refresh the page
    await this.page.reload();

    // Should still be on dashboard (session persisted)
    await this.dashboardPage.waitForDashboardLoad();
    expect(await this.dashboardPage.isOnDashboard()).toBe(true);
  }

  /**
   * Test unauthorized access (accessing protected page without login)
   */
  async testUnauthorizedAccess(protectedUrl: string): Promise<void> {
    // Make sure we're logged out
    await this.logout();

    // Try to access protected page directly
    await this.page.goto(protectedUrl);

    // Should be redirected to login page
    await expect(this.page).toHaveURL(/\/auth\/signin/);
  }

  /**
   * Setup authenticated state for tests (quick login without UI)
   */
  async setupAuthenticatedState(userType: keyof typeof TEST_USERS): Promise<void> {
    // This could be optimized to use API calls or browser context state
    // For now, we'll use the standard login flow
    await this.loginAs(userType);
  }

  /**
   * Get current user info from UI
   */
  async getCurrentUserInfo(): Promise<{ name?: string; role?: string }> {
    await this.dashboardPage.openUserMenu();

    // Extract user info from user menu
    const userInfo: { name?: string; role?: string } = {};

    const userNameElement = this.page.locator('[data-testid="user-name"]');
    const userRoleElement = this.page.locator('[data-testid="user-role"]');

    if (await userNameElement.isVisible()) {
      userInfo.name = await userNameElement.textContent() || undefined;
    }

    if (await userRoleElement.isVisible()) {
      userInfo.role = await userRoleElement.textContent() || undefined;
    }

    return userInfo;
  }
}