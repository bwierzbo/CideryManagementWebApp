import { Page, expect } from '@playwright/test';
import { BasePage } from './base-page';

/**
 * Page Object for Purchase management pages
 */
export class PurchasePage extends BasePage {
  // Selectors
  private readonly createPurchaseButton = '[data-testid="create-purchase-button"]';
  private readonly purchaseForm = '[data-testid="purchase-form"]';
  private readonly vendorSelect = '[data-testid="vendor-select"]';
  private readonly invoiceNumberInput = '[data-testid="invoice-number-input"]';
  private readonly purchaseDateInput = '[data-testid="purchase-date-input"]';
  private readonly notesInput = '[data-testid="notes-input"]';
  private readonly addItemButton = '[data-testid="add-item-button"]';
  private readonly submitPurchaseButton = '[data-testid="submit-purchase-button"]';
  private readonly successMessage = '[data-testid="purchase-success-message"]';
  private readonly totalCostDisplay = '[data-testid="total-cost-display"]';
  private readonly currentPurchaseNumber = '[data-testid="current-purchase-number"]';

  // Item form selectors
  private readonly itemForm = '[data-testid="purchase-item-form"]';
  private readonly appleVarietySelect = '[data-testid="apple-variety-select"]';
  private readonly quantityInput = '[data-testid="quantity-input"]';
  private readonly unitSelect = '[data-testid="unit-select"]';
  private readonly pricePerUnitInput = '[data-testid="price-per-unit-input"]';
  private readonly itemNotesInput = '[data-testid="item-notes-input"]';
  private readonly saveItemButton = '[data-testid="save-item-button"]';

  constructor(page: Page) {
    super(page);
  }

  /**
   * Navigate to purchases page
   */
  async navigate(): Promise<void> {
    await this.goto('/purchases');
    await this.waitForLoad();
  }

  /**
   * Wait for purchases page to load
   */
  async waitForPageLoad(): Promise<void> {
    await this.waitForElement('[data-testid="purchases-page"]');
    await this.waitForLoadingToComplete();
  }

  /**
   * Create a new purchase with items
   */
  async createPurchase(purchaseData: {
    vendor: string;
    invoiceNumber: string;
    purchaseDate: string;
    notes?: string;
    items: Array<{
      appleVariety: string;
      quantity: string;
      unit: string;
      pricePerUnit: string;
      notes?: string;
    }>;
  }): Promise<void> {
    // Click create purchase button
    await this.page.locator(this.createPurchaseButton).click();
    await this.waitForElement(this.purchaseForm);

    // Fill purchase details
    await this.page.locator(this.vendorSelect).selectOption({ label: purchaseData.vendor });
    await this.page.locator(this.invoiceNumberInput).fill(purchaseData.invoiceNumber);
    await this.page.locator(this.purchaseDateInput).fill(purchaseData.purchaseDate);

    if (purchaseData.notes) {
      await this.page.locator(this.notesInput).fill(purchaseData.notes);
    }

    // Add each item
    for (const item of purchaseData.items) {
      await this.addPurchaseItem(item);
    }

    // Submit purchase
    await this.page.locator(this.submitPurchaseButton).click();
    await this.waitForLoadingToComplete();
  }

  /**
   * Add a single purchase item
   */
  async addPurchaseItem(itemData: {
    appleVariety: string;
    quantity: string;
    unit: string;
    pricePerUnit: string;
    notes?: string;
  }): Promise<void> {
    // Click add item button
    await this.page.locator(this.addItemButton).click();
    await this.waitForElement(this.itemForm);

    // Fill item details
    await this.page.locator(this.appleVarietySelect).selectOption({ label: itemData.appleVariety });
    await this.page.locator(this.quantityInput).fill(itemData.quantity);
    await this.page.locator(this.unitSelect).selectOption({ value: itemData.unit });
    await this.page.locator(this.pricePerUnitInput).fill(itemData.pricePerUnit);

    if (itemData.notes) {
      await this.page.locator(this.itemNotesInput).fill(itemData.notes);
    }

    // Save item
    await this.page.locator(this.saveItemButton).click();
    await this.waitForLoadingToComplete();
  }

  /**
   * Get the current purchase number after creation
   */
  async getCurrentPurchaseNumber(): Promise<string> {
    await this.waitForElement(this.currentPurchaseNumber);
    const number = await this.getTextContent(this.currentPurchaseNumber);
    return number || '';
  }

  /**
   * Get the total cost of the purchase
   */
  async getTotalCost(): Promise<string> {
    await this.waitForElement(this.totalCostDisplay);
    const cost = await this.getTextContent(this.totalCostDisplay);
    return cost?.replace(/[^\d.]/g, '') || '0';
  }

  /**
   * Get purchase details from the current page
   */
  async getPurchaseDetails(): Promise<{
    vendor: string;
    invoiceNumber: string;
    purchaseDate: string;
    totalCost: string;
    itemCount: number;
  }> {
    const vendor = await this.getTextContent('[data-testid="purchase-vendor"]') || '';
    const invoiceNumber = await this.getTextContent('[data-testid="purchase-invoice-number"]') || '';
    const purchaseDate = await this.getTextContent('[data-testid="purchase-date"]') || '';
    const totalCost = await this.getTotalCost();
    const itemCount = await this.page.locator('[data-testid="purchase-item"]').count();

    return {
      vendor,
      invoiceNumber,
      purchaseDate,
      totalCost,
      itemCount
    };
  }

  /**
   * Search for purchases by criteria
   */
  async searchPurchases(criteria: {
    vendor?: string;
    invoiceNumber?: string;
    dateFrom?: string;
    dateTo?: string;
  }): Promise<void> {
    if (criteria.vendor) {
      await this.page.locator('[data-testid="search-vendor"]').fill(criteria.vendor);
    }

    if (criteria.invoiceNumber) {
      await this.page.locator('[data-testid="search-invoice"]').fill(criteria.invoiceNumber);
    }

    if (criteria.dateFrom) {
      await this.page.locator('[data-testid="search-date-from"]').fill(criteria.dateFrom);
    }

    if (criteria.dateTo) {
      await this.page.locator('[data-testid="search-date-to"]').fill(criteria.dateTo);
    }

    await this.page.locator('[data-testid="search-button"]').click();
    await this.waitForLoadingToComplete();
  }

  /**
   * Get list of purchases from search results
   */
  async getPurchaseList(): Promise<Array<{
    id: string;
    vendor: string;
    invoiceNumber: string;
    date: string;
    totalCost: string;
    status: string;
  }>> {
    const purchases = [];
    const purchaseElements = await this.page.locator('[data-testid="purchase-row"]').all();

    for (const element of purchaseElements) {
      const id = await element.getAttribute('data-purchase-id') || '';
      const vendor = await element.locator('[data-testid="purchase-vendor"]').textContent() || '';
      const invoiceNumber = await element.locator('[data-testid="purchase-invoice"]').textContent() || '';
      const date = await element.locator('[data-testid="purchase-date"]').textContent() || '';
      const totalCost = await element.locator('[data-testid="purchase-total"]').textContent() || '';
      const status = await element.locator('[data-testid="purchase-status"]').textContent() || '';

      purchases.push({
        id,
        vendor,
        invoiceNumber,
        date,
        totalCost,
        status
      });
    }

    return purchases;
  }

  /**
   * View purchase details by ID
   */
  async viewPurchase(purchaseId: string): Promise<void> {
    await this.page.locator(`[data-testid="view-purchase-${purchaseId}"]`).click();
    await this.waitForLoadingToComplete();
  }

  /**
   * Edit an existing purchase
   */
  async editPurchase(purchaseId: string, updates: {
    notes?: string;
    items?: Array<{
      appleVariety: string;
      quantity: string;
      unit: string;
      pricePerUnit: string;
      notes?: string;
    }>;
  }): Promise<void> {
    await this.page.locator(`[data-testid="edit-purchase-${purchaseId}"]`).click();
    await this.waitForElement(this.purchaseForm);

    if (updates.notes) {
      await this.page.locator(this.notesInput).clear();
      await this.page.locator(this.notesInput).fill(updates.notes);
    }

    if (updates.items) {
      for (const item of updates.items) {
        await this.addPurchaseItem(item);
      }
    }

    await this.page.locator(this.submitPurchaseButton).click();
    await this.waitForLoadingToComplete();
  }

  /**
   * Delete a purchase (if allowed by permissions)
   */
  async deletePurchase(purchaseId: string): Promise<void> {
    await this.page.locator(`[data-testid="delete-purchase-${purchaseId}"]`).click();

    // Confirm deletion
    await this.page.locator('[data-testid="confirm-delete-button"]').click();
    await this.waitForLoadingToComplete();
  }

  /**
   * Verify purchase was created successfully
   */
  async verifyPurchaseCreated(): Promise<boolean> {
    return await this.isVisible(this.successMessage);
  }

  /**
   * Get validation errors if any
   */
  async getValidationErrors(): Promise<string[]> {
    const errors = [];
    const errorElements = await this.page.locator('[data-testid="validation-error"]').all();

    for (const element of errorElements) {
      const error = await element.textContent();
      if (error) {
        errors.push(error.trim());
      }
    }

    return errors;
  }

  /**
   * Check if purchase form has unsaved changes
   */
  async hasUnsavedChanges(): Promise<boolean> {
    return await this.isVisible('[data-testid="unsaved-changes-warning"]');
  }

  /**
   * Export purchases to CSV/Excel
   */
  async exportPurchases(format: 'csv' | 'excel' = 'csv'): Promise<void> {
    await this.page.locator(`[data-testid="export-${format}-button"]`).click();
    await this.waitForLoadingToComplete();
  }

  /**
   * Get purchase statistics from dashboard
   */
  async getPurchaseStatistics(): Promise<{
    totalPurchases: number;
    totalValue: string;
    averageValue: string;
    topVendor: string;
  }> {
    const totalPurchases = await this.getTextContent('[data-testid="stat-total-purchases"]') || '0';
    const totalValue = await this.getTextContent('[data-testid="stat-total-value"]') || '0';
    const averageValue = await this.getTextContent('[data-testid="stat-average-value"]') || '0';
    const topVendor = await this.getTextContent('[data-testid="stat-top-vendor"]') || '';

    return {
      totalPurchases: parseInt(totalPurchases),
      totalValue,
      averageValue,
      topVendor
    };
  }
}