import { Page, expect } from '@playwright/test';
import { BasePage } from './base-page';

/**
 * Page Object for Batch management and fermentation monitoring pages
 */
export class BatchPage extends BasePage {
  // Selectors
  private readonly createBatchButton = '[data-testid="create-batch-button"]';
  private readonly batchForm = '[data-testid="batch-form"]';
  private readonly batchNumberInput = '[data-testid="batch-number-input"]';
  private readonly vesselSelect = '[data-testid="vessel-select"]';
  private readonly pressRunSelect = '[data-testid="press-run-select"]';
  private readonly targetAbvInput = '[data-testid="target-abv-input"]';
  private readonly notesInput = '[data-testid="notes-input"]';
  private readonly submitBatchButton = '[data-testid="submit-batch-button"]';
  private readonly successMessage = '[data-testid="batch-success-message"]';
  private readonly currentBatchNumber = '[data-testid="current-batch-number"]';

  // Measurement form selectors
  private readonly addMeasurementButton = '[data-testid="add-measurement-button"]';
  private readonly measurementForm = '[data-testid="measurement-form"]';
  private readonly measurementDateInput = '[data-testid="measurement-date-input"]';
  private readonly specificGravityInput = '[data-testid="specific-gravity-input"]';
  private readonly abvInput = '[data-testid="abv-input"]';
  private readonly phInput = '[data-testid="ph-input"]';
  private readonly temperatureInput = '[data-testid="temperature-input"]';
  private readonly volumeInput = '[data-testid="volume-input"]';
  private readonly measurementNotesInput = '[data-testid="measurement-notes-input"]';
  private readonly saveMeasurementButton = '[data-testid="save-measurement-button"]';

  // Transfer form selectors
  private readonly transferBatchButton = '[data-testid="transfer-batch-button"]';
  private readonly transferForm = '[data-testid="transfer-form"]';
  private readonly targetVesselSelect = '[data-testid="target-vessel-select"]';
  private readonly transferVolumeInput = '[data-testid="transfer-volume-input"]';
  private readonly transferNotesInput = '[data-testid="transfer-notes-input"]';
  private readonly confirmTransferButton = '[data-testid="confirm-transfer-button"]';

  // Batch details selectors
  private readonly batchDetailsContainer = '[data-testid="batch-details"]';
  private readonly batchStatus = '[data-testid="batch-status"]';
  private readonly initialVolume = '[data-testid="initial-volume"]';
  private readonly currentVolume = '[data-testid="current-volume"]';
  private readonly currentVessel = '[data-testid="current-vessel"]';
  private readonly targetAbv = '[data-testid="target-abv"]';
  private readonly actualAbv = '[data-testid="actual-abv"]';

  constructor(page: Page) {
    super(page);
  }

  /**
   * Navigate to batches page
   */
  async navigate(): Promise<void> {
    await this.goto('/batches');
    await this.waitForLoad();
  }

  /**
   * Wait for batches page to load
   */
  async waitForPageLoad(): Promise<void> {
    await this.waitForElement('[data-testid="batches-page"]');
    await this.waitForLoadingToComplete();
  }

  /**
   * Create a new batch
   */
  async createBatch(batchData: {
    batchNumber: string;
    pressRunNumber?: string;
    vesselName: string;
    targetAbv: string;
    notes?: string;
  }): Promise<void> {
    // Click create batch button
    await this.page.locator(this.createBatchButton).click();
    await this.waitForElement(this.batchForm);

    // Fill batch details
    await this.page.locator(this.batchNumberInput).fill(batchData.batchNumber);
    await this.page.locator(this.vesselSelect).selectOption({ label: batchData.vesselName });

    if (batchData.pressRunNumber) {
      await this.page.locator(this.pressRunSelect).selectOption({ label: batchData.pressRunNumber });
    }

    await this.page.locator(this.targetAbvInput).fill(batchData.targetAbv);

    if (batchData.notes) {
      await this.page.locator(this.notesInput).fill(batchData.notes);
    }

    // Submit batch
    await this.page.locator(this.submitBatchButton).click();
    await this.waitForLoadingToComplete();
  }

  /**
   * Add a measurement to a batch
   */
  async addMeasurement(measurementData: {
    date: string;
    specificGravity: string;
    abv: string;
    ph: string;
    temperature: string;
    volume?: string;
    notes?: string;
  }): Promise<void> {
    // Click add measurement button
    await this.page.locator(this.addMeasurementButton).click();
    await this.waitForElement(this.measurementForm);

    // Fill measurement details
    await this.page.locator(this.measurementDateInput).fill(measurementData.date);
    await this.page.locator(this.specificGravityInput).fill(measurementData.specificGravity);
    await this.page.locator(this.abvInput).fill(measurementData.abv);
    await this.page.locator(this.phInput).fill(measurementData.ph);
    await this.page.locator(this.temperatureInput).fill(measurementData.temperature);

    if (measurementData.volume) {
      await this.page.locator(this.volumeInput).fill(measurementData.volume);
    }

    if (measurementData.notes) {
      await this.page.locator(this.measurementNotesInput).fill(measurementData.notes);
    }

    // Save measurement
    await this.page.locator(this.saveMeasurementButton).click();
    await this.waitForLoadingToComplete();
  }

  /**
   * Transfer batch to a different vessel
   */
  async transferBatch(transferData: {
    targetVessel: string;
    transferVolume: string;
    notes?: string;
  }): Promise<void> {
    // Click transfer batch button
    await this.page.locator(this.transferBatchButton).click();
    await this.waitForElement(this.transferForm);

    // Fill transfer details
    await this.page.locator(this.targetVesselSelect).selectOption({ label: transferData.targetVessel });
    await this.page.locator(this.transferVolumeInput).fill(transferData.transferVolume);

    if (transferData.notes) {
      await this.page.locator(this.transferNotesInput).fill(transferData.notes);
    }

    // Confirm transfer
    await this.page.locator(this.confirmTransferButton).click();
    await this.waitForLoadingToComplete();
  }

  /**
   * Get the current batch number after creation
   */
  async getCurrentBatchNumber(): Promise<string> {
    await this.waitForElement(this.currentBatchNumber);
    const number = await this.getTextContent(this.currentBatchNumber);
    return number || '';
  }

  /**
   * Get batch details from current page
   */
  async getBatchDetails(): Promise<{
    batchNumber: string;
    status: string;
    vesselName: string;
    initialVolume: string;
    currentVolume: string;
    targetAbv: string;
    actualAbv?: string;
    startDate: string;
  }> {
    await this.waitForElement(this.batchDetailsContainer);

    const batchNumber = await this.getTextContent('[data-testid="batch-number"]') || '';
    const status = await this.getTextContent(this.batchStatus) || '';
    const vesselName = await this.getTextContent(this.currentVessel) || '';
    const initialVol = await this.getTextContent(this.initialVolume) || '';
    const currentVol = await this.getTextContent(this.currentVolume) || '';
    const targetAbvText = await this.getTextContent(this.targetAbv) || '';
    const actualAbvText = await this.getTextContent(this.actualAbv);
    const startDate = await this.getTextContent('[data-testid="start-date"]') || '';

    return {
      batchNumber,
      status,
      vesselName,
      initialVolume: initialVol.replace(/[^\d.]/g, ''),
      currentVolume: currentVol.replace(/[^\d.]/g, ''),
      targetAbv: targetAbvText.replace(/[^\d.]/g, ''),
      actualAbv: actualAbvText?.replace(/[^\d.]/g, ''),
      startDate
    };
  }

  /**
   * Get all measurements for current batch
   */
  async getAllMeasurements(): Promise<Array<{
    date: string;
    specificGravity: string;
    abv: string;
    ph: string;
    temperature: string;
    volume: string;
    notes: string;
  }>> {
    const measurements = [];
    const measurementElements = await this.page.locator('[data-testid="measurement-row"]').all();

    for (const element of measurementElements) {
      const date = await element.locator('[data-testid="measurement-date"]').textContent() || '';
      const sg = await element.locator('[data-testid="measurement-sg"]').textContent() || '';
      const abv = await element.locator('[data-testid="measurement-abv"]').textContent() || '';
      const ph = await element.locator('[data-testid="measurement-ph"]').textContent() || '';
      const temp = await element.locator('[data-testid="measurement-temp"]').textContent() || '';
      const volume = await element.locator('[data-testid="measurement-volume"]').textContent() || '';
      const notes = await element.locator('[data-testid="measurement-notes"]').textContent() || '';

      measurements.push({
        date,
        specificGravity: sg,
        abv,
        ph,
        temperature: temp,
        volume,
        notes
      });
    }

    return measurements;
  }

  /**
   * Get list of active batches
   */
  async getActiveBatches(): Promise<Array<{
    batchNumber: string;
    vesselName: string;
    status: string;
    currentVolume: string;
    targetAbv: string;
    daysActive: number;
  }>> {
    const batches = [];
    const batchElements = await this.page.locator('[data-testid="batch-row"][data-status="active"]').all();

    for (const element of batchElements) {
      const batchNumber = await element.locator('[data-testid="batch-number"]').textContent() || '';
      const vesselName = await element.locator('[data-testid="vessel-name"]').textContent() || '';
      const status = await element.locator('[data-testid="batch-status"]').textContent() || '';
      const currentVolume = await element.locator('[data-testid="current-volume"]').textContent() || '';
      const targetAbv = await element.locator('[data-testid="target-abv"]').textContent() || '';
      const daysActiveText = await element.locator('[data-testid="days-active"]').textContent() || '';

      batches.push({
        batchNumber,
        vesselName,
        status,
        currentVolume,
        targetAbv,
        daysActive: parseInt(daysActiveText) || 0
      });
    }

    return batches;
  }

  /**
   * Search for batches by criteria
   */
  async searchBatches(criteria: {
    batchNumber?: string;
    status?: string;
    vesselName?: string;
    dateFrom?: string;
    dateTo?: string;
  }): Promise<void> {
    if (criteria.batchNumber) {
      await this.page.locator('[data-testid="search-batch-number"]').fill(criteria.batchNumber);
    }

    if (criteria.status) {
      await this.page.locator('[data-testid="search-status"]').selectOption({ value: criteria.status });
    }

    if (criteria.vesselName) {
      await this.page.locator('[data-testid="search-vessel"]').selectOption({ label: criteria.vesselName });
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
   * View batch details by ID
   */
  async viewBatch(batchId: string): Promise<void> {
    await this.page.locator(`[data-testid="view-batch-${batchId}"]`).click();
    await this.waitForLoadingToComplete();
  }

  /**
   * Complete a batch (mark as finished)
   */
  async completeBatch(batchId: string, completionData?: {
    finalAbv?: string;
    completionNotes?: string;
  }): Promise<void> {
    await this.page.locator(`[data-testid="complete-batch-${batchId}"]`).click();
    await this.waitForElement('[data-testid="completion-form"]');

    if (completionData?.finalAbv) {
      await this.page.locator('[data-testid="final-abv-input"]').fill(completionData.finalAbv);
    }

    if (completionData?.completionNotes) {
      await this.page.locator('[data-testid="completion-notes-input"]').fill(completionData.completionNotes);
    }

    await this.page.locator('[data-testid="confirm-completion-button"]').click();
    await this.waitForLoadingToComplete();
  }

  /**
   * Get fermentation progress chart data
   */
  async getFermentationProgress(): Promise<{
    gravityTrend: Array<{ date: string; value: number }>;
    abvTrend: Array<{ date: string; value: number }>;
    currentPhase: string;
  }> {
    await this.waitForElement('[data-testid="fermentation-chart"]');

    // In a real implementation, this would extract data from the chart
    // For now, return mock structure
    return {
      gravityTrend: [],
      abvTrend: [],
      currentPhase: await this.getTextContent('[data-testid="fermentation-phase"]') || ''
    };
  }

  /**
   * Get available vessels for transfer
   */
  async getAvailableVessels(): Promise<Array<{
    id: string;
    name: string;
    capacity: string;
    currentStatus: string;
  }>> {
    const vessels = [];
    const vesselElements = await this.page.locator('[data-testid="available-vessel"]').all();

    for (const element of vesselElements) {
      const id = await element.getAttribute('data-vessel-id') || '';
      const name = await element.locator('[data-testid="vessel-name"]').textContent() || '';
      const capacity = await element.locator('[data-testid="vessel-capacity"]').textContent() || '';
      const status = await element.locator('[data-testid="vessel-status"]').textContent() || '';

      vessels.push({
        id,
        name,
        capacity,
        currentStatus: status
      });
    }

    return vessels;
  }

  /**
   * Verify batch was created successfully
   */
  async verifyBatchCreated(): Promise<boolean> {
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
   * Export batch data to CSV/Excel
   */
  async exportBatchData(format: 'csv' | 'excel' = 'csv'): Promise<void> {
    await this.page.locator(`[data-testid="export-${format}-button"]`).click();
    await this.waitForLoadingToComplete();
  }

  /**
   * Get batch statistics from dashboard
   */
  async getBatchStatistics(): Promise<{
    totalBatches: number;
    activeBatches: number;
    completedBatches: number;
    totalVolumeActive: string;
    averageAbv: string;
  }> {
    const totalBatches = await this.getTextContent('[data-testid="stat-total-batches"]') || '0';
    const activeBatches = await this.getTextContent('[data-testid="stat-active-batches"]') || '0';
    const completedBatches = await this.getTextContent('[data-testid="stat-completed-batches"]') || '0';
    const totalVolume = await this.getTextContent('[data-testid="stat-total-volume"]') || '0';
    const avgAbv = await this.getTextContent('[data-testid="stat-average-abv"]') || '0';

    return {
      totalBatches: parseInt(totalBatches),
      activeBatches: parseInt(activeBatches),
      completedBatches: parseInt(completedBatches),
      totalVolumeActive: totalVolume,
      averageAbv: avgAbv
    };
  }

  /**
   * Monitor fermentation alerts and warnings
   */
  async getFermentationAlerts(): Promise<Array<{
    batchNumber: string;
    alertType: string;
    message: string;
    severity: 'info' | 'warning' | 'error';
    timestamp: string;
  }>> {
    const alerts = [];
    const alertElements = await this.page.locator('[data-testid="fermentation-alert"]').all();

    for (const element of alertElements) {
      const batchNumber = await element.locator('[data-testid="alert-batch-number"]').textContent() || '';
      const alertType = await element.locator('[data-testid="alert-type"]').textContent() || '';
      const message = await element.locator('[data-testid="alert-message"]').textContent() || '';
      const severity = await element.getAttribute('data-severity') as 'info' | 'warning' | 'error' || 'info';
      const timestamp = await element.locator('[data-testid="alert-timestamp"]').textContent() || '';

      alerts.push({
        batchNumber,
        alertType,
        message,
        severity,
        timestamp
      });
    }

    return alerts;
  }
}