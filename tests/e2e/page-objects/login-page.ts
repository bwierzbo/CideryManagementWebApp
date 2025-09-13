import { Page, expect } from '@playwright/test';
import { BasePage } from './base-page';

/**
 * Page Object for the login page
 */
export class LoginPage extends BasePage {
  // Selectors
  private readonly emailInput = '[data-testid="email-input"]';
  private readonly passwordInput = '[data-testid="password-input"]';
  private readonly loginButton = '[data-testid="login-button"]';
  private readonly errorMessage = '[data-testid="error-message"]';
  private readonly forgotPasswordLink = '[data-testid="forgot-password-link"]';

  constructor(page: Page) {
    super(page);
  }

  /**
   * Navigate to login page
   */
  async navigate(): Promise<void> {
    await this.goto('/auth/signin');
    await this.waitForLoad();
  }

  /**
   * Check if we're on the login page
   */
  async isOnLoginPage(): Promise<boolean> {
    return await this.isVisible(this.emailInput) && await this.isVisible(this.passwordInput);
  }

  /**
   * Enter email address
   */
  async enterEmail(email: string): Promise<void> {
    await this.clearAndFill(this.emailInput, email);
  }

  /**
   * Enter password
   */
  async enterPassword(password: string): Promise<void> {
    await this.clearAndFill(this.passwordInput, password);
  }

  /**
   * Click login button
   */
  async clickLogin(): Promise<void> {
    await this.page.locator(this.loginButton).click();
  }

  /**
   * Perform complete login flow
   */
  async login(email: string, password: string): Promise<void> {
    await this.enterEmail(email);
    await this.enterPassword(password);
    await this.clickLogin();
    await this.waitForLoadingToComplete();
  }

  /**
   * Get error message if login fails
   */
  async getErrorMessage(): Promise<string | null> {
    if (await this.isVisible(this.errorMessage)) {
      return await this.getTextContent(this.errorMessage);
    }
    return null;
  }

  /**
   * Check if error message is displayed
   */
  async hasErrorMessage(): Promise<boolean> {
    return await this.isVisible(this.errorMessage);
  }

  /**
   * Click forgot password link
   */
  async clickForgotPassword(): Promise<void> {
    await this.page.locator(this.forgotPasswordLink).click();
  }

  /**
   * Check if login form is valid (both fields filled)
   */
  async isFormValid(): Promise<boolean> {
    const emailValue = await this.page.locator(this.emailInput).inputValue();
    const passwordValue = await this.page.locator(this.passwordInput).inputValue();
    return emailValue.length > 0 && passwordValue.length > 0;
  }

  /**
   * Clear all form fields
   */
  async clearForm(): Promise<void> {
    await this.page.locator(this.emailInput).clear();
    await this.page.locator(this.passwordInput).clear();
  }

  /**
   * Check if login button is enabled
   */
  async isLoginButtonEnabled(): Promise<boolean> {
    return await this.page.locator(this.loginButton).isEnabled();
  }

  /**
   * Wait for successful login (redirect away from login page)
   */
  async waitForSuccessfulLogin(): Promise<void> {
    // Wait for navigation away from login page
    await expect(this.page).toHaveURL(/^(?!.*\/auth\/signin).*/);
  }

  /**
   * Get current form values
   */
  async getFormValues(): Promise<{ email: string; password: string }> {
    return {
      email: await this.page.locator(this.emailInput).inputValue(),
      password: await this.page.locator(this.passwordInput).inputValue()
    };
  }
}