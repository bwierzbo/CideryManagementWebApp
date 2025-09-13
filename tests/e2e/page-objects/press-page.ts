import { Page, expect } from '@playwright/test';
import { BasePage } from './base-page';

/**
 * Page Object for Press operations pages
 */
export class PressPage extends BasePage {
  // Selectors
  private readonly createPressRunButton = '[data-testid="create-press-run-button"]';
  private readonly pressRunForm = '[data-testid="press-run-form"]';
  private readonly runDateInput = '[data-testid="run-date-input"]';
  private readonly notesInput = '[data-testid="notes-input"]';
  private readonly addPurchaseButton = '[data-testid="add-purchase-button"]';
  private readonly submitPressRunButton = '[data-testid="submit-press-run-button"]';
  private readonly successMessage = '[data-testid="press-success-message"]';
  private readonly currentPressRunNumber = '[data-testid="current-press-run-number"]';

  // Purchase selection selectors
  private readonly purchaseSelector = '[data-testid="purchase-selector"]';
  private readonly purchaseSearchInput = '[data-testid="purchase-search-input"]';
  private readonly selectedPurchasesContainer = '[data-testid="selected-purchases"]';

  // Press results selectors
  private readonly totalAppleProcessed = '[data-testid="total-apple-processed"]';
  private readonly totalJuiceProduced = '[data-testid="total-juice-produced"]';
  private readonly extractionRate = '[data-testid="extraction-rate"]';
  private readonly pressResultsContainer = '[data-testid="press-results"]';

  // Press item form selectors
  private readonly pressItemForm = '[data-testid="press-item-form"]';
  private readonly purchaseItemSelect = '[data-testid="purchase-item-select"]';
  private readonly quantityUsedInput = '[data-testid="quantity-used-input"]';
  private readonly juiceProducedInput = '[data-testid="juice-produced-input"]';
  private readonly brixInput = '[data-testid="brix-input"]';
  private readonly itemNotesInput = '[data-testid="item-notes-input"]';
  private readonly savePressItemButton = '[data-testid="save-press-item-button"]';

  constructor(page: Page) {
    super(page);
  }

  /**
   * Navigate to press page
   */
  async navigate(): Promise<void> {
    await this.goto('/press');
    await this.waitForLoad();
  }

  /**
   * Wait for press page to load
   */
  async waitForPageLoad(): Promise<void> {
    await this.waitForElement('[data-testid="press-page"]');
    await this.waitForLoadingToComplete();
  }

  /**
   * Create a new press run
   */
  async createPressRun(pressData: {
    runDate: string;
    purchaseNumbers?: string[];
    notes?: string;
    expectedExtractionRate?: number;
    items?: Array<{
      purchaseItemId: string;
      quantityUsed: string;
      juiceProduced?: string;
      brixMeasured: string;
      notes?: string;
    }>;
  }): Promise<void> {
    // Click create press run button
    await this.page.locator(this.createPressRunButton).click();
    await this.waitForElement(this.pressRunForm);

    // Fill press run details
    await this.page.locator(this.runDateInput).fill(pressData.runDate);

    if (pressData.notes) {
      await this.page.locator(this.notesInput).fill(pressData.notes);
    }

    // Select purchases if provided
    if (pressData.purchaseNumbers && pressData.purchaseNumbers.length > 0) {
      for (const purchaseNumber of pressData.purchaseNumbers) {
        await this.addPurchaseToPressRun(purchaseNumber);
      }
    }

    // Add specific press items if provided
    if (pressData.items && pressData.items.length > 0) {
      for (const item of pressData.items) {
        await this.addPressItem(item);
      }
    }

    // Submit press run
    await this.page.locator(this.submitPressRunButton).click();
    await this.waitForLoadingToComplete();
  }

  /**
   * Add a purchase to the press run
   */
  async addPurchaseToPressRun(purchaseNumber: string): Promise<void> {
    await this.page.locator(this.addPurchaseButton).click();
    await this.waitForElement(this.purchaseSelector);

    // Search for the purchase
    await this.page.locator(this.purchaseSearchInput).fill(purchaseNumber);
    await this.waitForLoadingToComplete();

    // Select the purchase
    await this.page.locator(`[data-testid="select-purchase-${purchaseNumber}"]`).click();
    await this.waitForLoadingToComplete();
  }

  /**
   * Add a specific press item with measurements
   */
  async addPressItem(itemData: {
    purchaseItemId: string;
    quantityUsed: string;
    juiceProduced?: string;
    brixMeasured: string;
    notes?: string;
  }): Promise<void> {
    await this.page.locator('[data-testid="add-press-item-button"]').click();
    await this.waitForElement(this.pressItemForm);

    // Select purchase item
    await this.page.locator(this.purchaseItemSelect).selectOption({ value: itemData.purchaseItemId });

    // Fill quantities
    await this.page.locator(this.quantityUsedInput).fill(itemData.quantityUsed);

    if (itemData.juiceProduced) {
      await this.page.locator(this.juiceProducedInput).fill(itemData.juiceProduced);
    }

    // Fill measurements
    await this.page.locator(this.brixInput).fill(itemData.brixMeasured);

    if (itemData.notes) {
      await this.page.locator(this.itemNotesInput).fill(itemData.notes);
    }

    // Save press item
    await this.page.locator(this.savePressItemButton).click();
    await this.waitForLoadingToComplete();
  }

  /**
   * Get the current press run number after creation
   */
  async getCurrentPressRunNumber(): Promise<string> {
    await this.waitForElement(this.currentPressRunNumber);
    const number = await this.getTextContent(this.currentPressRunNumber);
    return number || '';
  }

  /**
   * Get press run results and calculations
   */
  async getPressResults(): Promise<{
    totalAppleProcessed: string;
    totalJuiceProduced: string;
    extractionRate: string;
    averageBrix: string;
  }> {
    await this.waitForElement(this.pressResultsContainer);

    const totalApple = await this.getTextContent(this.totalAppleProcessed) || '0';
    const totalJuice = await this.getTextContent(this.totalJuiceProduced) || '0';
    const extraction = await this.getTextContent(this.extractionRate) || '0';
    const avgBrix = await this.getTextContent('[data-testid="average-brix"]') || '0';

    return {
      totalAppleProcessed: totalApple.replace(/[^\d.]/g, ''),
      totalJuiceProduced: totalJuice.replace(/[^\d.]/g, ''),
      extractionRate: extraction.replace(/[^\d.]/g, ''),
      averageBrix: avgBrix.replace(/[^\d.]/g, '')
    };
  }

  /**
   * Get press run details from current page
   */
  async getPressRunDetails(): Promise<{
    runNumber: string;
    runDate: string;
    status: string;
    totalApple: string;
    totalJuice: string;
    extractionRate: string;
    itemCount: number;
  }> {
    const runNumber = await this.getTextContent('[data-testid="press-run-number"]') || '';
    const runDate = await this.getTextContent('[data-testid="press-run-date"]') || '';
    const status = await this.getTextContent('[data-testid="press-run-status"]') || '';
    const results = await this.getPressResults();
    const itemCount = await this.page.locator('[data-testid="press-item"]').count();

    return {
      runNumber,
      runDate,
      status,
      totalApple: results.totalAppleProcessed,
      totalJuice: results.totalJuiceProduced,
      extractionRate: results.extractionRate,
      itemCount
    };
  }

  /**
   * Search for press runs by criteria
   */
  async searchPressRuns(criteria: {
    runNumber?: string;
    dateFrom?: string;
    dateTo?: string;
    status?: string;
  }): Promise<void> {
    if (criteria.runNumber) {
      await this.page.locator('[data-testid="search-run-number"]').fill(criteria.runNumber);
    }

    if (criteria.dateFrom) {
      await this.page.locator('[data-testid="search-date-from"]').fill(criteria.dateFrom);
    }

    if (criteria.dateTo) {
      await this.page.locator('[data-testid="search-date-to"]').fill(criteria.dateTo);
    }

    if (criteria.status) {
      await this.page.locator('[data-testid="search-status"]').selectOption({ value: criteria.status });
    }

    await this.page.locator('[data-testid="search-button"]').click();
    await this.waitForLoadingToComplete();
  }

  /**
   * Get list of press runs from search results
   */
  async getPressRunList(): Promise<Array<{
    id: string;
    runNumber: string;
    date: string;
    totalApple: string;
    totalJuice: string;
    extractionRate: string;
    status: string;
  }>> {
    const pressRuns = [];
    const runElements = await this.page.locator('[data-testid="press-run-row"]').all();

    for (const element of runElements) {
      const id = await element.getAttribute('data-press-run-id') || '';
      const runNumber = await element.locator('[data-testid="run-number"]').textContent() || '';
      const date = await element.locator('[data-testid="run-date"]').textContent() || '';
      const totalApple = await element.locator('[data-testid="total-apple"]').textContent() || '';
      const totalJuice = await element.locator('[data-testid="total-juice"]').textContent() || '';
      const extractionRate = await element.locator('[data-testid="extraction-rate"]').textContent() || '';
      const status = await element.locator('[data-testid="run-status"]').textContent() || '';

      pressRuns.push({
        id,
        runNumber,
        date,
        totalApple,
        totalJuice,
        extractionRate,
        status
      });
    }

    return pressRuns;
  }

  /**
   * View press run details by ID
   */
  async viewPressRun(pressRunId: string): Promise<void> {
    await this.page.locator(`[data-testid="view-press-run-${pressRunId}"]`).click();
    await this.waitForLoadingToComplete();
  }

  /**
   * Edit an existing press run
   */
  async editPressRun(pressRunId: string, updates: {
    notes?: string;
    items?: Array<{
      purchaseItemId: string;
      quantityUsed: string;
      brixMeasured: string;
      notes?: string;
    }>;
  }): Promise<void> {
    await this.page.locator(`[data-testid="edit-press-run-${pressRunId}"]`).click();
    await this.waitForElement(this.pressRunForm);

    if (updates.notes) {
      await this.page.locator(this.notesInput).clear();
      await this.page.locator(this.notesInput).fill(updates.notes);
    }

    if (updates.items) {
      for (const item of updates.items) {
        await this.addPressItem(item);
      }
    }

    await this.page.locator(this.submitPressRunButton).click();
    await this.waitForLoadingToComplete();
  }

  /**
   * Get available purchases for pressing
   */
  async getAvailablePurchases(): Promise<Array<{
    id: string;
    invoiceNumber: string;
    vendor: string;
    totalApple: string;
    date: string;
  }>> {
    const purchases = [];
    const purchaseElements = await this.page.locator('[data-testid="available-purchase"]').all();

    for (const element of purchaseElements) {
      const id = await element.getAttribute('data-purchase-id') || '';
      const invoiceNumber = await element.locator('[data-testid="invoice-number"]').textContent() || '';
      const vendor = await element.locator('[data-testid="vendor-name"]').textContent() || '';
      const totalApple = await element.locator('[data-testid="total-apple"]').textContent() || '';
      const date = await element.locator('[data-testid="purchase-date"]').textContent() || '';

      purchases.push({
        id,
        invoiceNumber,
        vendor,
        totalApple,
        date
      });
    }

    return purchases;
  }

  /**
   * Calculate expected juice yield based on apple quantities
   */
  async calculateExpectedYield(appleQuantity: number, extractionRate: number = 0.68): Promise<number> {
    return appleQuantity * extractionRate;
  }

  /**
   * Verify press run was created successfully
   */
  async verifyPressRunCreated(): Promise<boolean> {
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
   * Export press runs to CSV/Excel
   */
  async exportPressRuns(format: 'csv' | 'excel' = 'csv'): Promise<void> {
    await this.page.locator(`[data-testid="export-${format}-button"]`).click();
    await this.waitForLoadingToComplete();
  }

  /**
   * Get press statistics from dashboard
   */
  async getPressStatistics(): Promise<{
    totalRuns: number;
    totalAppleProcessed: string;
    totalJuiceProduced: string;
    averageExtractionRate: string;
  }> {
    const totalRuns = await this.getTextContent('[data-testid="stat-total-runs"]') || '0';
    const totalApple = await this.getTextContent('[data-testid="stat-total-apple"]') || '0';
    const totalJuice = await this.getTextContent('[data-testid="stat-total-juice"]') || '0';
    const avgExtraction = await this.getTextContent('[data-testid="stat-avg-extraction"]') || '0';

    return {
      totalRuns: parseInt(totalRuns),
      totalAppleProcessed: totalApple,
      totalJuiceProduced: totalJuice,
      averageExtractionRate: avgExtraction
    };
  }

  /**
   * Check if press equipment is available for scheduling
   */
  async checkEquipmentAvailability(date: string): Promise<{
    available: boolean;
    conflictingRuns?: string[];
  }> {
    await this.page.locator('[data-testid="check-availability-button"]').click();
    await this.page.locator('[data-testid="availability-date-input"]').fill(date);
    await this.page.locator('[data-testid="check-date-button"]').click();
    await this.waitForLoadingToComplete();

    const available = await this.isVisible('[data-testid="equipment-available"]');
    const conflictingRuns = [];

    if (!available) {
      const conflictElements = await this.page.locator('[data-testid="conflicting-run"]').all();
      for (const element of conflictElements) {
        const runNumber = await element.textContent();
        if (runNumber) {
          conflictingRuns.push(runNumber.trim());
        }
      }
    }

    return {
      available,
      conflictingRuns: conflictingRuns.length > 0 ? conflictingRuns : undefined
    };
  }
}