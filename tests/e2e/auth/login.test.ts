import { test, expect } from '@playwright/test';
import { LoginPage } from '../page-objects/login-page';
import { DashboardPage } from '../page-objects/dashboard-page';
import { AuthHelper, TEST_USERS } from '../utils/auth-helpers';

test.describe('Authentication', () => {
  let loginPage: LoginPage;
  let dashboardPage: DashboardPage;
  let authHelper: AuthHelper;

  test.beforeEach(async ({ page }) => {
    loginPage = new LoginPage(page);
    dashboardPage = new DashboardPage(page);
    authHelper = new AuthHelper(page);
  });

  test('should display login form correctly', async ({ page }) => {
    await loginPage.navigate();

    // Check that login form is displayed
    expect(await loginPage.isOnLoginPage()).toBe(true);

    // Check form elements are present
    await expect(page.locator('[data-testid="email-input"]')).toBeVisible();
    await expect(page.locator('[data-testid="password-input"]')).toBeVisible();
    await expect(page.locator('[data-testid="login-button"]')).toBeVisible();
  });

  test('should login successfully with valid admin credentials', async ({ page }) => {
    await authHelper.loginAs('admin');

    // Should be redirected to dashboard
    await expect(page).toHaveURL(/\/dashboard/);
    expect(await dashboardPage.isOnDashboard()).toBe(true);
  });

  test('should login successfully with valid operator credentials', async ({ page }) => {
    await authHelper.loginAs('operator');

    // Should be redirected to dashboard
    await expect(page).toHaveURL(/\/dashboard/);
    expect(await dashboardPage.isOnDashboard()).toBe(true);
  });

  test('should login successfully with valid viewer credentials', async ({ page }) => {
    await authHelper.loginAs('viewer');

    // Should be redirected to dashboard
    await expect(page).toHaveURL(/\/dashboard/);
    expect(await dashboardPage.isOnDashboard()).toBe(true);
  });

  test('should show error with invalid credentials', async () => {
    await authHelper.testInvalidLogin('invalid@example.com', 'wrongpassword');
  });

  test('should show error with empty credentials', async ({ page }) => {
    await loginPage.navigate();

    // Try to login without entering credentials
    await loginPage.clickLogin();

    // Should show validation errors or remain on login page
    expect(await loginPage.isOnLoginPage()).toBe(true);
  });

  test('should show error with invalid email format', async ({ page }) => {
    await loginPage.navigate();
    await loginPage.enterEmail('invalid-email');
    await loginPage.enterPassword('password');

    // Check if login button is disabled or error is shown
    const isButtonEnabled = await loginPage.isLoginButtonEnabled();
    const hasError = await loginPage.hasErrorMessage();

    expect(isButtonEnabled === false || hasError === true).toBe(true);
  });

  test('should logout successfully', async ({ page }) => {
    // Login first
    await authHelper.loginAs('admin');

    // Then logout
    await authHelper.logout();

    // Should be redirected to login page
    await expect(page).toHaveURL(/\/auth\/signin/);
  });

  test('should maintain session on page refresh', async () => {
    await authHelper.loginAs('admin');
    await authHelper.testSessionPersistence();
  });

  test('should redirect to login when accessing protected page without authentication', async () => {
    await authHelper.testUnauthorizedAccess('/dashboard');
  });

  test('should clear form fields correctly', async () => {
    await loginPage.navigate();

    // Fill form
    await loginPage.enterEmail('test@example.com');
    await loginPage.enterPassword('password');

    // Verify form is filled
    const formValues = await loginPage.getFormValues();
    expect(formValues.email).toBe('test@example.com');
    expect(formValues.password).toBe('password');

    // Clear form
    await loginPage.clearForm();

    // Verify form is cleared
    const clearedValues = await loginPage.getFormValues();
    expect(clearedValues.email).toBe('');
    expect(clearedValues.password).toBe('');
  });
});