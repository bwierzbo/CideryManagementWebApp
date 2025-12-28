/**
 * Production Report CSV Export
 */
import {
  arrayToCSV,
  downloadCSV,
  formatDateForCSV,
  formatNumberForCSV,
} from "./exportHelpers";

interface YieldAnalysisData {
  summary: {
    totalFruitKg: number;
    totalJuiceL: number;
    avgExtractionRate: number;
    pressRunCount: number;
  };
  byVariety: Array<{
    varietyId: string;
    varietyName: string;
    fruitKg: number;
    juiceL: number;
    extractionRate: number;
    loadCount: number;
  }>;
  pressRuns: Array<{
    id: string;
    name: string | null;
    date: string | null;
    fruitKg: number;
    juiceL: number;
    extractionRate: number;
  }>;
}

interface FermentationData {
  summary: {
    batchesStarted: number;
    batchesCompleted: number;
    avgDaysToTerminal: number | null;
    avgOriginalGravity: number | null;
    avgFinalGravity: number | null;
  };
  batches: Array<{
    id: string;
    batchName: string;
    startDate: Date | string;
    endDate: Date | string | null;
    originalGravity: number | null;
    currentGravity: number | null;
    fermentationStage: string;
    daysActive: number;
    volumeL: number;
  }>;
}

interface ProductionSummaryData {
  summary: {
    batchesCreated: number;
    totalInitialVolumeL: number;
    totalCurrentVolumeL: number;
    volumeLossL: number;
  };
  byProductType: Array<{
    productType: string;
    count: number;
    volumeL: number;
  }>;
  byStatus: Array<{
    status: string;
    count: number;
  }>;
}

/**
 * Export yield analysis data as CSV
 */
export function exportYieldAnalysisCSV(
  data: YieldAnalysisData,
  dateRange: { startDate: Date; endDate: Date }
): void {
  // Export press runs
  const pressRunsCSV = arrayToCSV(
    data.pressRuns.map((run) => ({
      name: run.name || "Unnamed",
      date: formatDateForCSV(run.date),
      fruitKg: formatNumberForCSV(run.fruitKg, 1),
      juiceL: formatNumberForCSV(run.juiceL, 1),
      extractionRate: formatNumberForCSV(run.extractionRate, 1),
    })),
    [
      { key: "name", header: "Press Run" },
      { key: "date", header: "Date" },
      { key: "fruitKg", header: "Fruit (kg)" },
      { key: "juiceL", header: "Juice (L)" },
      { key: "extractionRate", header: "Extraction Rate (%)" },
    ]
  );

  // Add variety breakdown section
  const varietyCSV = arrayToCSV(
    data.byVariety.map((v) => ({
      varietyName: v.varietyName,
      fruitKg: formatNumberForCSV(v.fruitKg, 1),
      juiceL: formatNumberForCSV(v.juiceL, 1),
      extractionRate: formatNumberForCSV(v.extractionRate, 1),
      loadCount: String(v.loadCount),
    })),
    [
      { key: "varietyName", header: "Variety" },
      { key: "fruitKg", header: "Fruit (kg)" },
      { key: "juiceL", header: "Juice (L)" },
      { key: "extractionRate", header: "Extraction Rate (%)" },
      { key: "loadCount", header: "Load Count" },
    ]
  );

  // Combine with summary
  const summary = [
    "YIELD ANALYSIS REPORT",
    `Date Range: ${formatDateForCSV(dateRange.startDate)} to ${formatDateForCSV(dateRange.endDate)}`,
    "",
    "SUMMARY",
    `Total Press Runs: ${data.summary.pressRunCount}`,
    `Total Fruit (kg): ${formatNumberForCSV(data.summary.totalFruitKg, 1)}`,
    `Total Juice (L): ${formatNumberForCSV(data.summary.totalJuiceL, 1)}`,
    `Average Extraction Rate: ${formatNumberForCSV(data.summary.avgExtractionRate, 1)}%`,
    "",
    "BY VARIETY",
    varietyCSV,
    "",
    "PRESS RUNS",
    pressRunsCSV,
  ].join("\n");

  const filename = `yield-analysis-${formatDateForCSV(dateRange.startDate)}-${formatDateForCSV(dateRange.endDate)}.csv`;
  downloadCSV(summary, filename);
}

/**
 * Export fermentation metrics as CSV
 */
export function exportFermentationCSV(
  data: FermentationData,
  dateRange: { startDate: Date; endDate: Date }
): void {
  const batchesCSV = arrayToCSV(
    data.batches.map((batch) => ({
      batchName: batch.batchName,
      startDate: formatDateForCSV(batch.startDate),
      endDate: formatDateForCSV(batch.endDate),
      originalGravity: batch.originalGravity ? formatNumberForCSV(batch.originalGravity, 3) : "",
      currentGravity: batch.currentGravity ? formatNumberForCSV(batch.currentGravity, 3) : "",
      fermentationStage: batch.fermentationStage,
      daysActive: String(batch.daysActive),
      volumeL: formatNumberForCSV(batch.volumeL, 1),
    })),
    [
      { key: "batchName", header: "Batch" },
      { key: "startDate", header: "Start Date" },
      { key: "endDate", header: "End Date" },
      { key: "originalGravity", header: "OG" },
      { key: "currentGravity", header: "Current SG" },
      { key: "fermentationStage", header: "Stage" },
      { key: "daysActive", header: "Days Active" },
      { key: "volumeL", header: "Volume (L)" },
    ]
  );

  const summary = [
    "FERMENTATION METRICS REPORT",
    `Date Range: ${formatDateForCSV(dateRange.startDate)} to ${formatDateForCSV(dateRange.endDate)}`,
    "",
    "SUMMARY",
    `Batches Started: ${data.summary.batchesStarted}`,
    `Batches Completed: ${data.summary.batchesCompleted}`,
    `Avg Days to Terminal: ${data.summary.avgDaysToTerminal ?? "N/A"}`,
    `Avg Original Gravity: ${data.summary.avgOriginalGravity ? formatNumberForCSV(data.summary.avgOriginalGravity, 3) : "N/A"}`,
    `Avg Final Gravity: ${data.summary.avgFinalGravity ? formatNumberForCSV(data.summary.avgFinalGravity, 3) : "N/A"}`,
    "",
    "BATCH DETAILS",
    batchesCSV,
  ].join("\n");

  const filename = `fermentation-metrics-${formatDateForCSV(dateRange.startDate)}-${formatDateForCSV(dateRange.endDate)}.csv`;
  downloadCSV(summary, filename);
}

/**
 * Export production summary as CSV
 */
export function exportProductionSummaryCSV(
  data: ProductionSummaryData,
  dateRange: { startDate: Date; endDate: Date }
): void {
  const byProductTypeCSV = arrayToCSV(
    data.byProductType.map((item) => ({
      productType: item.productType,
      count: String(item.count),
      volumeL: formatNumberForCSV(item.volumeL, 0),
    })),
    [
      { key: "productType", header: "Product Type" },
      { key: "count", header: "Batch Count" },
      { key: "volumeL", header: "Volume (L)" },
    ]
  );

  const byStatusCSV = arrayToCSV(
    data.byStatus.map((item) => ({
      status: item.status,
      count: String(item.count),
    })),
    [
      { key: "status", header: "Status" },
      { key: "count", header: "Count" },
    ]
  );

  const summary = [
    "PRODUCTION SUMMARY REPORT",
    `Date Range: ${formatDateForCSV(dateRange.startDate)} to ${formatDateForCSV(dateRange.endDate)}`,
    "",
    "SUMMARY",
    `Batches Created: ${data.summary.batchesCreated}`,
    `Initial Volume (L): ${formatNumberForCSV(data.summary.totalInitialVolumeL, 1)}`,
    `Current Volume (L): ${formatNumberForCSV(data.summary.totalCurrentVolumeL, 1)}`,
    `Volume Loss (L): ${formatNumberForCSV(data.summary.volumeLossL, 1)}`,
    "",
    "BY PRODUCT TYPE",
    byProductTypeCSV,
    "",
    "BY STATUS",
    byStatusCSV,
  ].join("\n");

  const filename = `production-summary-${formatDateForCSV(dateRange.startDate)}-${formatDateForCSV(dateRange.endDate)}.csv`;
  downloadCSV(summary, filename);
}
