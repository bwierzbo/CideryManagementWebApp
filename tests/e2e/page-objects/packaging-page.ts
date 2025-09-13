import { Page, expect } from '@playwright/test';
import { BasePage } from './base-page';

/**
 * Page Object for Packaging operations pages
 */
export class PackagingPage extends BasePage {
  // Selectors
  private readonly createPackagingRunButton = '[data-testid="create-packaging-run-button"]';
  private readonly packagingForm = '[data-testid="packaging-form"]';
  private readonly batchSelect = '[data-testid="batch-select"]';
  private readonly packageDateInput = '[data-testid="package-date-input"]';
  private readonly bottleSizeSelect = '[data-testid="bottle-size-select"]';
  private readonly volumeToPackageInput = '[data-testid="volume-to-package-input"]';
  private readonly locationSelect = '[data-testid="location-select"]';
  private readonly notesInput = '[data-testid="notes-input"]';
  private readonly submitPackagingButton = '[data-testid="submit-packaging-button"]';
  private readonly successMessage = '[data-testid="packaging-success-message"]';
  private readonly currentPackageNumber = '[data-testid="current-package-number"]';

  // Packaging results selectors
  private readonly packagingResultsContainer = '[data-testid="packaging-results"]';
  private readonly totalBottlesPackaged = '[data-testid="total-bottles-packaged"]';
  private readonly totalVolumePackaged = '[data-testid="total-volume-packaged"]';
  private readonly packagingEfficiency = '[data-testid="packaging-efficiency"]';
  private readonly finalAbv = '[data-testid="final-abv"]';

  // Quality control selectors
  private readonly qcForm = '[data-testid="quality-control-form"]';
  private readonly qcAbvInput = '[data-testid="qc-abv-input"]';
  private readonly qcPhInput = '[data-testid="qc-ph-input"]';
  private readonly qcClaritySelect = '[data-testid="qc-clarity-select"]';
  private readonly qcTasteNotesInput = '[data-testid="qc-taste-notes-input"]';
  private readonly qcApprovedCheckbox = '[data-testid="qc-approved-checkbox"]';
  private readonly saveQcButton = '[data-testid="save-qc-button"]';

  constructor(page: Page) {
    super(page);
  }

  /**
   * Navigate to packaging page
   */
  async navigate(): Promise<void> {
    await this.goto('/packaging');
    await this.waitForLoad();
  }

  /**
   * Wait for packaging page to load
   */
  async waitForPageLoad(): Promise<void> {
    await this.waitForElement('[data-testid="packaging-page"]');
    await this.waitForLoadingToComplete();
  }

  /**
   * Create a new packaging run
   */
  async createPackagingRun(packagingData: {
    batchNumber: string;
    packageDate?: string;
    bottleSize: string;
    volumeToPackage: string;
    location: string;
    notes?: string;
    qualityControl?: {
      abv: string;
      ph: string;
      clarity: string;
      tasteNotes?: string;
      approved: boolean;
    };
  }): Promise<void> {
    // Click create packaging run button
    await this.page.locator(this.createPackagingRunButton).click();
    await this.waitForElement(this.packagingForm);

    // Fill packaging details
    await this.page.locator(this.batchSelect).selectOption({ label: packagingData.batchNumber });

    if (packagingData.packageDate) {
      await this.page.locator(this.packageDateInput).fill(packagingData.packageDate);
    }

    await this.page.locator(this.bottleSizeSelect).selectOption({ value: packagingData.bottleSize });
    await this.page.locator(this.volumeToPackageInput).fill(packagingData.volumeToPackage);
    await this.page.locator(this.locationSelect).selectOption({ label: packagingData.location });

    if (packagingData.notes) {
      await this.page.locator(this.notesInput).fill(packagingData.notes);
    }

    // Add quality control data if provided
    if (packagingData.qualityControl) {
      await this.addQualityControlData(packagingData.qualityControl);
    }

    // Submit packaging run
    await this.page.locator(this.submitPackagingButton).click();
    await this.waitForLoadingToComplete();
  }

  /**
   * Add quality control data to packaging run
   */
  async addQualityControlData(qcData: {
    abv: string;
    ph: string;
    clarity: string;
    tasteNotes?: string;
    approved: boolean;
  }): Promise<void> {
    await this.waitForElement(this.qcForm);

    await this.page.locator(this.qcAbvInput).fill(qcData.abv);
    await this.page.locator(this.qcPhInput).fill(qcData.ph);
    await this.page.locator(this.qcClaritySelect).selectOption({ value: qcData.clarity });

    if (qcData.tasteNotes) {
      await this.page.locator(this.qcTasteNotesInput).fill(qcData.tasteNotes);
    }

    if (qcData.approved) {
      await this.page.locator(this.qcApprovedCheckbox).check();
    }

    await this.page.locator(this.saveQcButton).click();
    await this.waitForLoadingToComplete();
  }

  /**
   * Get the current package number after creation
   */
  async getCurrentPackageNumber(): Promise<string> {
    await this.waitForElement(this.currentPackageNumber);
    const number = await this.getTextContent(this.currentPackageNumber);
    return number || '';
  }

  /**
   * Get packaging results and calculations
   */
  async getPackagingResults(): Promise<{
    totalBottlesPackaged: number;
    totalVolumePackaged: string;
    packagingEfficiency: string;
    finalAbv: string;
    costPerBottle?: string;
  }> {
    await this.waitForElement(this.packagingResultsContainer);

    const totalBottles = await this.getTextContent(this.totalBottlesPackaged) || '0';
    const totalVolume = await this.getTextContent(this.totalVolumePackaged) || '0';
    const efficiency = await this.getTextContent(this.packagingEfficiency) || '0';
    const abv = await this.getTextContent(this.finalAbv) || '0';
    const costPerBottle = await this.getTextContent('[data-testid="cost-per-bottle"]');

    return {
      totalBottlesPackaged: parseInt(totalBottles.replace(/[^\d]/g, '')),
      totalVolumePackaged: totalVolume.replace(/[^\d.]/g, ''),
      packagingEfficiency: efficiency.replace(/[^\d.]/g, ''),
      finalAbv: abv.replace(/[^\d.]/g, ''),
      costPerBottle: costPerBottle?.replace(/[^\d.]/g, '')
    };
  }

  /**
   * Get packaging run details from current page
   */
  async getPackagingRunDetails(): Promise<{
    packageNumber: string;
    batchNumber: string;
    packageDate: string;
    bottleSize: string;
    bottleCount: number;
    volume: string;
    location: string;
    status: string;
  }> {
    const packageNumber = await this.getTextContent('[data-testid="package-number"]') || '';
    const batchNumber = await this.getTextContent('[data-testid="package-batch-number"]') || '';
    const packageDate = await this.getTextContent('[data-testid="package-date"]') || '';
    const bottleSize = await this.getTextContent('[data-testid="package-bottle-size"]') || '';
    const bottleCountText = await this.getTextContent('[data-testid="package-bottle-count"]') || '0';
    const volume = await this.getTextContent('[data-testid="package-volume"]') || '';
    const location = await this.getTextContent('[data-testid="package-location"]') || '';
    const status = await this.getTextContent('[data-testid="package-status"]') || '';

    return {
      packageNumber,
      batchNumber,
      packageDate,
      bottleSize,
      bottleCount: parseInt(bottleCountText.replace(/[^\d]/g, '')),
      volume,
      location,
      status
    };
  }

  /**
   * Search for packaging runs by criteria
   */
  async searchPackagingRuns(criteria: {
    packageNumber?: string;
    batchNumber?: string;
    dateFrom?: string;
    dateTo?: string;
    location?: string;
    bottleSize?: string;
  }): Promise<void> {
    if (criteria.packageNumber) {
      await this.page.locator('[data-testid="search-package-number"]').fill(criteria.packageNumber);
    }

    if (criteria.batchNumber) {
      await this.page.locator('[data-testid="search-batch-number"]').fill(criteria.batchNumber);
    }

    if (criteria.dateFrom) {
      await this.page.locator('[data-testid="search-date-from"]').fill(criteria.dateFrom);
    }

    if (criteria.dateTo) {
      await this.page.locator('[data-testid="search-date-to"]').fill(criteria.dateTo);
    }

    if (criteria.location) {
      await this.page.locator('[data-testid="search-location"]').selectOption({ label: criteria.location });
    }

    if (criteria.bottleSize) {
      await this.page.locator('[data-testid="search-bottle-size"]').selectOption({ value: criteria.bottleSize });
    }

    await this.page.locator('[data-testid="search-button"]').click();
    await this.waitForLoadingToComplete();
  }

  /**
   * Get list of packaging runs from search results
   */
  async getPackagingRunList(): Promise<Array<{
    id: string;
    packageNumber: string;
    batchNumber: string;
    date: string;
    bottleSize: string;
    bottleCount: number;
    location: string;
    status: string;
  }>> {
    const packagingRuns = [];
    const runElements = await this.page.locator('[data-testid="packaging-run-row"]').all();

    for (const element of runElements) {
      const id = await element.getAttribute('data-package-id') || '';
      const packageNumber = await element.locator('[data-testid="package-number"]').textContent() || '';
      const batchNumber = await element.locator('[data-testid="batch-number"]').textContent() || '';
      const date = await element.locator('[data-testid="package-date"]').textContent() || '';
      const bottleSize = await element.locator('[data-testid="bottle-size"]').textContent() || '';
      const bottleCountText = await element.locator('[data-testid="bottle-count"]').textContent() || '0';
      const location = await element.locator('[data-testid="location"]').textContent() || '';
      const status = await element.locator('[data-testid="status"]').textContent() || '';

      packagingRuns.push({
        id,
        packageNumber,
        batchNumber,
        date,
        bottleSize,
        bottleCount: parseInt(bottleCountText.replace(/[^\d]/g, '')),
        location,
        status
      });
    }

    return packagingRuns;
  }

  /**
   * View packaging run details by ID
   */
  async viewPackagingRun(packageId: string): Promise<void> {
    await this.page.locator(`[data-testid="view-package-${packageId}"]`).click();
    await this.waitForLoadingToComplete();
  }

  /**
   * Get available batches for packaging
   */
  async getAvailableBatches(): Promise<Array<{
    batchNumber: string;
    status: string;
    currentVolume: string;
    abv: string;
    vesselName: string;
    daysReady: number;
  }>> {
    const batches = [];
    const batchElements = await this.page.locator('[data-testid="available-batch"]').all();

    for (const element of batchElements) {
      const batchNumber = await element.locator('[data-testid="batch-number"]').textContent() || '';
      const status = await element.locator('[data-testid="batch-status"]').textContent() || '';
      const currentVolume = await element.locator('[data-testid="current-volume"]').textContent() || '';
      const abv = await element.locator('[data-testid="batch-abv"]').textContent() || '';
      const vesselName = await element.locator('[data-testid="vessel-name"]').textContent() || '';
      const daysReadyText = await element.locator('[data-testid="days-ready"]').textContent() || '0';

      batches.push({
        batchNumber,
        status,
        currentVolume,
        abv,
        vesselName,
        daysReady: parseInt(daysReadyText)
      });
    }

    return batches;
  }

  /**
   * Calculate bottle count based on volume and bottle size
   */
  async calculateBottleCount(volumeL: number, bottleSize: string): Promise<number> {
    const bottleSizeL = this.getBottleSizeInLiters(bottleSize);
    return Math.floor(volumeL / bottleSizeL);
  }

  /**
   * Helper to convert bottle size string to liters
   */
  private getBottleSizeInLiters(bottleSize: string): number {
    const sizeMap: Record<string, number> = {
      '187ml': 0.187,
      '375ml': 0.375,
      '500ml': 0.5,
      '750ml': 0.75,
      '1000ml': 1.0,
      '1.5L': 1.5
    };
    return sizeMap[bottleSize] || 0.75; // Default to 750ml
  }

  /**
   * Get packaging equipment status
   */
  async getEquipmentStatus(): Promise<{
    bottlingLine: string;
    labelingMachine: string;
    casePackingLine: string;
    nextAvailableSlot: string;
  }> {
    const bottlingLine = await this.getTextContent('[data-testid="bottling-line-status"]') || '';
    const labelingMachine = await this.getTextContent('[data-testid="labeling-machine-status"]') || '';
    const casePackingLine = await this.getTextContent('[data-testid="case-packing-status"]') || '';
    const nextSlot = await this.getTextContent('[data-testid="next-available-slot"]') || '';

    return {
      bottlingLine,
      labelingMachine,
      casePackingLine,
      nextAvailableSlot: nextSlot
    };
  }

  /**
   * Schedule packaging run for future date
   */
  async schedulePackagingRun(scheduleData: {
    batchNumber: string;
    scheduledDate: string;
    bottleSize: string;
    volumeToPackage: string;
    priority: 'low' | 'normal' | 'high';
    notes?: string;
  }): Promise<void> {
    await this.page.locator('[data-testid="schedule-packaging-button"]').click();
    await this.waitForElement('[data-testid="schedule-form"]');

    await this.page.locator('[data-testid="schedule-batch-select"]').selectOption({ label: scheduleData.batchNumber });
    await this.page.locator('[data-testid="schedule-date-input"]').fill(scheduleData.scheduledDate);
    await this.page.locator('[data-testid="schedule-bottle-size"]').selectOption({ value: scheduleData.bottleSize });
    await this.page.locator('[data-testid="schedule-volume-input"]').fill(scheduleData.volumeToPackage);
    await this.page.locator('[data-testid="schedule-priority"]').selectOption({ value: scheduleData.priority });

    if (scheduleData.notes) {
      await this.page.locator('[data-testid="schedule-notes"]').fill(scheduleData.notes);
    }

    await this.page.locator('[data-testid="save-schedule-button"]').click();
    await this.waitForLoadingToComplete();
  }

  /**
   * Verify packaging run was created successfully
   */
  async verifyPackagingRunCreated(): Promise<boolean> {
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
   * Export packaging data to CSV/Excel
   */
  async exportPackagingData(format: 'csv' | 'excel' = 'csv'): Promise<void> {
    await this.page.locator(`[data-testid="export-${format}-button"]`).click();
    await this.waitForLoadingToComplete();
  }

  /**
   * Get packaging statistics from dashboard
   */
  async getPackagingStatistics(): Promise<{
    totalPackagingRuns: number;
    totalBottlesPackaged: number;
    packagingEfficiency: string;
    mostPopularBottleSize: string;
    totalVolumePackaged: string;
  }> {
    const totalRuns = await this.getTextContent('[data-testid="stat-total-runs"]') || '0';
    const totalBottles = await this.getTextContent('[data-testid="stat-total-bottles"]') || '0';
    const efficiency = await this.getTextContent('[data-testid="stat-efficiency"]') || '0';
    const popularSize = await this.getTextContent('[data-testid="stat-popular-size"]') || '';
    const totalVolume = await this.getTextContent('[data-testid="stat-total-volume"]') || '0';

    return {
      totalPackagingRuns: parseInt(totalRuns),
      totalBottlesPackaged: parseInt(totalBottles.replace(/[^\d]/g, '')),
      packagingEfficiency: efficiency,
      mostPopularBottleSize: popularSize,
      totalVolumePackaged: totalVolume
    };
  }

  /**
   * Update packaging run inventory location
   */
  async updateInventoryLocation(packageId: string, newLocation: string): Promise<void> {
    await this.page.locator(`[data-testid="update-location-${packageId}"]`).click();
    await this.waitForElement('[data-testid="location-update-form"]');

    await this.page.locator('[data-testid="new-location-select"]').selectOption({ label: newLocation });
    await this.page.locator('[data-testid="confirm-location-update"]').click();
    await this.waitForLoadingToComplete();
  }

  /**
   * Get packaging quality control reports
   */
  async getQualityControlReports(): Promise<Array<{
    packageNumber: string;
    batchNumber: string;
    abv: string;
    ph: string;
    clarity: string;
    approved: boolean;
    inspector: string;
  }>> {
    const reports = [];
    const reportElements = await this.page.locator('[data-testid="qc-report-row"]').all();

    for (const element of reportElements) {
      const packageNumber = await element.locator('[data-testid="qc-package-number"]').textContent() || '';
      const batchNumber = await element.locator('[data-testid="qc-batch-number"]').textContent() || '';
      const abv = await element.locator('[data-testid="qc-abv"]').textContent() || '';
      const ph = await element.locator('[data-testid="qc-ph"]').textContent() || '';
      const clarity = await element.locator('[data-testid="qc-clarity"]').textContent() || '';
      const approved = await element.locator('[data-testid="qc-approved"]').isChecked();
      const inspector = await element.locator('[data-testid="qc-inspector"]').textContent() || '';

      reports.push({
        packageNumber,
        batchNumber,
        abv,
        ph,
        clarity,
        approved,
        inspector
      });
    }

    return reports;
  }
}