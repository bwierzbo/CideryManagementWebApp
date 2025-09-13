import { Page, expect } from '@playwright/test';
import { BasePage } from './base-page';

/**
 * Page Object for Reports and Analytics pages
 */
export class ReportsPage extends BasePage {
  // Selectors
  private readonly reportsContainer = '[data-testid="reports-page"]';
  private readonly generateReportButton = '[data-testid="generate-report-button"]';
  private readonly reportTypeSelect = '[data-testid="report-type-select"]';
  private readonly reportForm = '[data-testid="report-form"]';
  private readonly generateButton = '[data-testid="generate-button"]';
  private readonly reportResults = '[data-testid="report-results"]';
  private readonly exportButton = '[data-testid="export-report-button"]';

  // COGS Report selectors
  private readonly cogsReportForm = '[data-testid="cogs-report-form"]';
  private readonly cogsBatchSelect = '[data-testid="cogs-batch-select"]';
  private readonly cogsDateFromInput = '[data-testid="cogs-date-from"]';
  private readonly cogsDateToInput = '[data-testid="cogs-date-to"]';
  private readonly cogsIncludeDetailsCheckbox = '[data-testid="cogs-include-details"]';
  private readonly cogsResults = '[data-testid="cogs-results"]';

  // Audit Report selectors
  private readonly auditReportForm = '[data-testid="audit-report-form"]';
  private readonly auditBatchSelect = '[data-testid="audit-batch-select"]';
  private readonly auditEntityTypeSelect = '[data-testid="audit-entity-type-select"]';
  private readonly auditIncludeFullTrailCheckbox = '[data-testid="audit-include-full-trail"]';
  private readonly auditResults = '[data-testid="audit-results"]';

  // Production Report selectors
  private readonly productionReportForm = '[data-testid="production-report-form"]';
  private readonly productionDateFromInput = '[data-testid="production-date-from"]';
  private readonly productionDateToInput = '[data-testid="production-date-to"]';
  private readonly productionResults = '[data-testid="production-results"]';

  constructor(page: Page) {
    super(page);
  }

  /**
   * Navigate to reports page
   */
  async navigate(): Promise<void> {
    await this.goto('/reports');
    await this.waitForLoad();
  }

  /**
   * Wait for reports page to load
   */
  async waitForPageLoad(): Promise<void> {
    await this.waitForElement(this.reportsContainer);
    await this.waitForLoadingToComplete();
  }

  /**
   * Generate a COGS (Cost of Goods Sold) report
   */
  async generateCOGSReport(reportData: {
    batchNumber?: string;
    reportPeriod?: 'batch' | 'monthly' | 'quarterly' | 'yearly';
    dateFrom?: string;
    dateTo?: string;
    includeDetails?: boolean;
  }): Promise<void> {
    await this.page.locator(this.reportTypeSelect).selectOption({ value: 'cogs' });
    await this.waitForElement(this.cogsReportForm);

    if (reportData.batchNumber) {
      await this.page.locator(this.cogsBatchSelect).selectOption({ label: reportData.batchNumber });
    }

    if (reportData.dateFrom) {
      await this.page.locator(this.cogsDateFromInput).fill(reportData.dateFrom);
    }

    if (reportData.dateTo) {
      await this.page.locator(this.cogsDateToInput).fill(reportData.dateTo);
    }

    if (reportData.includeDetails) {
      await this.page.locator(this.cogsIncludeDetailsCheckbox).check();
    }

    await this.page.locator(this.generateButton).click();
    await this.waitForElement(this.cogsResults);
    await this.waitForLoadingToComplete();
  }

  /**
   * Get COGS report data
   */
  async getCOGSData(): Promise<{
    totalAppleCost: string;
    totalProcessingCost: string;
    totalPackagingCost: string;
    totalCost: string;
    costPerLiter: string;
    costPerBottle: string;
    grossMargin: string;
    extractionEfficiency: number;
    packagingEfficiency: number;
  }> {
    await this.waitForElement(this.cogsResults);

    const totalAppleCost = await this.getTextContent('[data-testid="cogs-apple-cost"]') || '0';
    const totalProcessingCost = await this.getTextContent('[data-testid="cogs-processing-cost"]') || '0';
    const totalPackagingCost = await this.getTextContent('[data-testid="cogs-packaging-cost"]') || '0';
    const totalCost = await this.getTextContent('[data-testid="cogs-total-cost"]') || '0';
    const costPerLiter = await this.getTextContent('[data-testid="cogs-cost-per-liter"]') || '0';
    const costPerBottle = await this.getTextContent('[data-testid="cogs-cost-per-bottle"]') || '0';
    const grossMargin = await this.getTextContent('[data-testid="cogs-gross-margin"]') || '0';
    const extractionEfficiency = await this.getTextContent('[data-testid="cogs-extraction-efficiency"]') || '0';
    const packagingEfficiency = await this.getTextContent('[data-testid="cogs-packaging-efficiency"]') || '0';

    return {
      totalAppleCost: totalAppleCost.replace(/[^\d.]/g, ''),
      totalProcessingCost: totalProcessingCost.replace(/[^\d.]/g, ''),
      totalPackagingCost: totalPackagingCost.replace(/[^\d.]/g, ''),
      totalCost: totalCost.replace(/[^\d.]/g, ''),
      costPerLiter: costPerLiter.replace(/[^\d.]/g, ''),
      costPerBottle: costPerBottle.replace(/[^\d.]/g, ''),
      grossMargin: grossMargin.replace(/[^\d.%-]/g, ''),
      extractionEfficiency: parseFloat(extractionEfficiency.replace(/[^\d.]/g, '')),
      packagingEfficiency: parseFloat(packagingEfficiency.replace(/[^\d.]/g, ''))
    };
  }

  /**
   * Get profitability metrics
   */
  async getProfitabilityMetrics(): Promise<{
    grossMargin: string;
    netMargin: string;
    breakEvenPrice: number;
    recommendedSalePrice: number;
    profitabilityIndex: number;
  }> {
    const grossMargin = await this.getTextContent('[data-testid="profit-gross-margin"]') || '0';
    const netMargin = await this.getTextContent('[data-testid="profit-net-margin"]') || '0';
    const breakEvenPriceText = await this.getTextContent('[data-testid="profit-break-even-price"]') || '0';
    const recommendedPriceText = await this.getTextContent('[data-testid="profit-recommended-price"]') || '0';
    const profitabilityIndexText = await this.getTextContent('[data-testid="profit-index"]') || '0';

    return {
      grossMargin,
      netMargin,
      breakEvenPrice: parseFloat(breakEvenPriceText.replace(/[^\d.]/g, '')),
      recommendedSalePrice: parseFloat(recommendedPriceText.replace(/[^\d.]/g, '')),
      profitabilityIndex: parseFloat(profitabilityIndexText.replace(/[^\d.]/g, ''))
    };
  }

  /**
   * Generate an audit report
   */
  async generateAuditReport(reportData: {
    batchNumber?: string;
    entityType?: string;
    dateFrom?: string;
    dateTo?: string;
    includeFullTrail?: boolean;
  }): Promise<void> {
    await this.page.locator(this.reportTypeSelect).selectOption({ value: 'audit' });
    await this.waitForElement(this.auditReportForm);

    if (reportData.batchNumber) {
      await this.page.locator(this.auditBatchSelect).selectOption({ label: reportData.batchNumber });
    }

    if (reportData.entityType) {
      await this.page.locator(this.auditEntityTypeSelect).selectOption({ value: reportData.entityType });
    }

    if (reportData.includeFullTrail) {
      await this.page.locator(this.auditIncludeFullTrailCheckbox).check();
    }

    await this.page.locator(this.generateButton).click();
    await this.waitForElement(this.auditResults);
    await this.waitForLoadingToComplete();
  }

  /**
   * Get audit trail data
   */
  async getAuditTrail(): Promise<Array<{
    timestamp: string;
    entityType: string;
    entityId: string;
    action: string;
    userId: string;
    changes: string;
    oldValues?: string;
    newValues?: string;
  }>> {
    const auditEntries = [];
    const entryElements = await this.page.locator('[data-testid="audit-entry"]').all();

    for (const element of entryElements) {
      const timestamp = await element.locator('[data-testid="audit-timestamp"]').textContent() || '';
      const entityType = await element.locator('[data-testid="audit-entity-type"]').textContent() || '';
      const entityId = await element.locator('[data-testid="audit-entity-id"]').textContent() || '';
      const action = await element.locator('[data-testid="audit-action"]').textContent() || '';
      const userId = await element.locator('[data-testid="audit-user-id"]').textContent() || '';
      const changes = await element.locator('[data-testid="audit-changes"]').textContent() || '';
      const oldValues = await element.locator('[data-testid="audit-old-values"]').textContent();
      const newValues = await element.locator('[data-testid="audit-new-values"]').textContent();

      auditEntries.push({
        timestamp,
        entityType,
        entityId,
        action,
        userId,
        changes,
        oldValues: oldValues || undefined,
        newValues: newValues || undefined
      });
    }

    return auditEntries;
  }

  /**
   * Generate a production report
   */
  async generateProductionReport(reportData: {
    dateFrom: string;
    dateTo: string;
    includeFinancials?: boolean;
    groupByVendor?: boolean;
  }): Promise<void> {
    await this.page.locator(this.reportTypeSelect).selectOption({ value: 'production' });
    await this.waitForElement(this.productionReportForm);

    await this.page.locator(this.productionDateFromInput).fill(reportData.dateFrom);
    await this.page.locator(this.productionDateToInput).fill(reportData.dateTo);

    if (reportData.includeFinancials) {
      await this.page.locator('[data-testid="production-include-financials"]').check();
    }

    if (reportData.groupByVendor) {
      await this.page.locator('[data-testid="production-group-by-vendor"]').check();
    }

    await this.page.locator(this.generateButton).click();
    await this.waitForElement(this.productionResults);
    await this.waitForLoadingToComplete();
  }

  /**
   * Get production report data
   */
  async getProductionData(): Promise<{
    totalPurchases: number;
    totalAppleProcessed: string;
    totalJuiceProduced: string;
    activeBatches: number;
    completedBatches: number;
    totalBottlesPackaged: number;
    averageExtractionRate: string;
    averagePackagingEfficiency: string;
  }> {
    const totalPurchases = await this.getTextContent('[data-testid="production-total-purchases"]') || '0';
    const totalApple = await this.getTextContent('[data-testid="production-total-apple"]') || '0';
    const totalJuice = await this.getTextContent('[data-testid="production-total-juice"]') || '0';
    const activeBatches = await this.getTextContent('[data-testid="production-active-batches"]') || '0';
    const completedBatches = await this.getTextContent('[data-testid="production-completed-batches"]') || '0';
    const totalBottles = await this.getTextContent('[data-testid="production-total-bottles"]') || '0';
    const avgExtraction = await this.getTextContent('[data-testid="production-avg-extraction"]') || '0';
    const avgPackaging = await this.getTextContent('[data-testid="production-avg-packaging"]') || '0';

    return {
      totalPurchases: parseInt(totalPurchases),
      totalAppleProcessed: totalApple.replace(/[^\d.]/g, ''),
      totalJuiceProduced: totalJuice.replace(/[^\d.]/g, ''),
      activeBatches: parseInt(activeBatches),
      completedBatches: parseInt(completedBatches),
      totalBottlesPackaged: parseInt(totalBottles.replace(/[^\d]/g, '')),
      averageExtractionRate: avgExtraction.replace(/[^\d.]/g, ''),
      averagePackagingEfficiency: avgPackaging.replace(/[^\d.]/g, '')
    };
  }

  /**
   * Generate inventory report
   */
  async generateInventoryReport(reportData?: {
    location?: string;
    bottleSize?: string;
    lowStockThreshold?: number;
  }): Promise<void> {
    await this.page.locator(this.reportTypeSelect).selectOption({ value: 'inventory' });
    await this.waitForElement('[data-testid="inventory-report-form"]');

    if (reportData?.location) {
      await this.page.locator('[data-testid="inventory-location-filter"]').selectOption({ label: reportData.location });
    }

    if (reportData?.bottleSize) {
      await this.page.locator('[data-testid="inventory-bottle-size-filter"]').selectOption({ value: reportData.bottleSize });
    }

    if (reportData?.lowStockThreshold) {
      await this.page.locator('[data-testid="inventory-low-stock-threshold"]').fill(reportData.lowStockThreshold.toString());
    }

    await this.page.locator(this.generateButton).click();
    await this.waitForElement('[data-testid="inventory-results"]');
    await this.waitForLoadingToComplete();
  }

  /**
   * Get inventory report data
   */
  async getInventoryData(): Promise<{
    totalLocations: number;
    totalBottles: number;
    totalVolume: string;
    lowStockItems: number;
    mostPopularSize: string;
    inventoryValue: string;
  }> {
    const totalLocations = await this.getTextContent('[data-testid="inventory-total-locations"]') || '0';
    const totalBottles = await this.getTextContent('[data-testid="inventory-total-bottles"]') || '0';
    const totalVolume = await this.getTextContent('[data-testid="inventory-total-volume"]') || '0';
    const lowStockItems = await this.getTextContent('[data-testid="inventory-low-stock-items"]') || '0';
    const mostPopularSize = await this.getTextContent('[data-testid="inventory-popular-size"]') || '';
    const inventoryValue = await this.getTextContent('[data-testid="inventory-total-value"]') || '0';

    return {
      totalLocations: parseInt(totalLocations),
      totalBottles: parseInt(totalBottles.replace(/[^\d]/g, '')),
      totalVolume: totalVolume.replace(/[^\d.]/g, ''),
      lowStockItems: parseInt(lowStockItems),
      mostPopularSize,
      inventoryValue: inventoryValue.replace(/[^\d.]/g, '')
    };
  }

  /**
   * Get vendor performance report
   */
  async generateVendorPerformanceReport(): Promise<void> {
    await this.page.locator(this.reportTypeSelect).selectOption({ value: 'vendor-performance' });
    await this.page.locator(this.generateButton).click();
    await this.waitForElement('[data-testid="vendor-performance-results"]');
    await this.waitForLoadingToComplete();
  }

  /**
   * Get vendor performance data
   */
  async getVendorPerformanceData(): Promise<Array<{
    vendorName: string;
    totalPurchases: number;
    totalSpent: string;
    averageQuality: string;
    onTimeDelivery: string;
    priceCompetitiveness: string;
    overallRating: string;
  }>> {
    const vendors = [];
    const vendorElements = await this.page.locator('[data-testid="vendor-performance-row"]').all();

    for (const element of vendorElements) {
      const vendorName = await element.locator('[data-testid="vendor-name"]').textContent() || '';
      const totalPurchases = await element.locator('[data-testid="vendor-total-purchases"]').textContent() || '0';
      const totalSpent = await element.locator('[data-testid="vendor-total-spent"]').textContent() || '0';
      const avgQuality = await element.locator('[data-testid="vendor-avg-quality"]').textContent() || '';
      const onTimeDelivery = await element.locator('[data-testid="vendor-on-time-delivery"]').textContent() || '';
      const priceCompetitiveness = await element.locator('[data-testid="vendor-price-competitiveness"]').textContent() || '';
      const overallRating = await element.locator('[data-testid="vendor-overall-rating"]').textContent() || '';

      vendors.push({
        vendorName,
        totalPurchases: parseInt(totalPurchases),
        totalSpent: totalSpent.replace(/[^\d.]/g, ''),
        averageQuality: avgQuality,
        onTimeDelivery: onTimeDelivery,
        priceCompetitiveness: priceCompetitiveness,
        overallRating: overallRating
      });
    }

    return vendors;
  }

  /**
   * Export report to specified format
   */
  async exportReport(format: 'pdf' | 'csv' | 'excel' = 'pdf'): Promise<void> {
    await this.page.locator(this.exportButton).click();
    await this.page.locator(`[data-testid="export-${format}"]`).click();
    await this.waitForLoadingToComplete();
  }

  /**
   * Schedule automated report
   */
  async scheduleReport(scheduleData: {
    reportType: string;
    frequency: 'daily' | 'weekly' | 'monthly';
    deliveryEmail: string;
    parameters?: Record<string, any>;
  }): Promise<void> {
    await this.page.locator('[data-testid="schedule-report-button"]').click();
    await this.waitForElement('[data-testid="schedule-form"]');

    await this.page.locator('[data-testid="schedule-report-type"]').selectOption({ value: scheduleData.reportType });
    await this.page.locator('[data-testid="schedule-frequency"]').selectOption({ value: scheduleData.frequency });
    await this.page.locator('[data-testid="schedule-email"]').fill(scheduleData.deliveryEmail);

    await this.page.locator('[data-testid="save-schedule-button"]').click();
    await this.waitForLoadingToComplete();
  }

  /**
   * Get available report templates
   */
  async getReportTemplates(): Promise<Array<{
    name: string;
    description: string;
    category: string;
    lastUsed?: string;
  }>> {
    const templates = [];
    const templateElements = await this.page.locator('[data-testid="report-template"]').all();

    for (const element of templateElements) {
      const name = await element.locator('[data-testid="template-name"]').textContent() || '';
      const description = await element.locator('[data-testid="template-description"]').textContent() || '';
      const category = await element.locator('[data-testid="template-category"]').textContent() || '';
      const lastUsed = await element.locator('[data-testid="template-last-used"]').textContent();

      templates.push({
        name,
        description,
        category,
        lastUsed: lastUsed || undefined
      });
    }

    return templates;
  }

  /**
   * Create custom report
   */
  async createCustomReport(reportData: {
    name: string;
    description: string;
    dataSource: string;
    filters: Record<string, any>;
    groupBy?: string[];
    sortBy?: string;
  }): Promise<void> {
    await this.page.locator('[data-testid="create-custom-report-button"]').click();
    await this.waitForElement('[data-testid="custom-report-form"]');

    await this.page.locator('[data-testid="custom-report-name"]').fill(reportData.name);
    await this.page.locator('[data-testid="custom-report-description"]').fill(reportData.description);
    await this.page.locator('[data-testid="custom-report-data-source"]').selectOption({ value: reportData.dataSource });

    // Add filters, grouping, and sorting configuration
    // This would be implemented based on the actual UI design

    await this.page.locator('[data-testid="save-custom-report-button"]').click();
    await this.waitForLoadingToComplete();
  }

  /**
   * Get report generation status
   */
  async getReportStatus(): Promise<{
    status: 'generating' | 'completed' | 'failed';
    progress?: number;
    estimatedTimeRemaining?: string;
    error?: string;
  }> {
    const status = await this.getTextContent('[data-testid="report-status"]') as 'generating' | 'completed' | 'failed' || 'completed';
    const progressText = await this.getTextContent('[data-testid="report-progress"]');
    const timeRemaining = await this.getTextContent('[data-testid="report-time-remaining"]');
    const error = await this.getTextContent('[data-testid="report-error"]');

    return {
      status,
      progress: progressText ? parseInt(progressText.replace(/[^\d]/g, '')) : undefined,
      estimatedTimeRemaining: timeRemaining || undefined,
      error: error || undefined
    };
  }

  /**
   * Get financial summary for dashboard
   */
  async getFinancialSummary(): Promise<{
    totalRevenue: string;
    totalCosts: string;
    grossProfit: string;
    netProfit: string;
    profitMargin: string;
  }> {
    const totalRevenue = await this.getTextContent('[data-testid="financial-total-revenue"]') || '0';
    const totalCosts = await this.getTextContent('[data-testid="financial-total-costs"]') || '0';
    const grossProfit = await this.getTextContent('[data-testid="financial-gross-profit"]') || '0';
    const netProfit = await this.getTextContent('[data-testid="financial-net-profit"]') || '0';
    const profitMargin = await this.getTextContent('[data-testid="financial-profit-margin"]') || '0';

    return {
      totalRevenue: totalRevenue.replace(/[^\d.-]/g, ''),
      totalCosts: totalCosts.replace(/[^\d.-]/g, ''),
      grossProfit: grossProfit.replace(/[^\d.-]/g, ''),
      netProfit: netProfit.replace(/[^\d.-]/g, ''),
      profitMargin: profitMargin.replace(/[^\d.-]/g, '')
    };
  }
}