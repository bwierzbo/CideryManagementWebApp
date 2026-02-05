/**
 * Excel generation utility for Batch Trace Report
 */

import type { BatchTraceReportPDFData } from "../pdf/batchTraceReport";

// Re-export the type for convenience
export type { BatchTraceReportPDFData as BatchTraceReportExcelData };

// Lazy import xlsx to avoid SSR issues
const getXlsx = async () => {
  const XLSX = await import("xlsx");
  return XLSX;
};

/**
 * Format date for Excel
 */
function formatDate(date: Date | string): string {
  const d = new Date(date);
  return d.toLocaleDateString("en-US", {
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  });
}

/**
 * Get type label
 */
function getTypeLabel(type: string): string {
  const labels: Record<string, string> = {
    transfer: "Transfer",
    transfer_in: "Blend In",
    racking: "Racking",
    filtering: "Filtering",
    bottling: "Bottling",
    kegging: "Kegging",
    distillation: "Distillation",
  };
  return labels[type] || type;
}

/**
 * Generate Excel workbook for Batch Trace Report
 */
export async function generateBatchTraceReportExcel(data: BatchTraceReportPDFData) {
  const XLSX = await getXlsx();

  // Create workbook
  const workbook = XLSX.utils.book_new();

  // ============ Summary Sheet ============
  const summaryData: (string | number)[][] = [
    ["BATCH TRACING REPORT"],
    [],
    ["As of Date", data.asOfDate],
    ["Generated", new Date().toLocaleString("en-US")],
    [],
    ["SUMMARY"],
    ["Metric", "Value"],
    ["Base Batches", data.summary.totalBatches],
    ["Initial Volume (L)", data.summary.totalInitialVolume],
    ["Packaged (L)", data.summary.totalPackaged],
    ["Distilled (L)", data.summary.totalDistilled ?? 0],
    ["Losses (L)", data.summary.totalLosses],
    ["Remaining (L)", data.summary.totalCurrentVolume],
  ];

  if (Math.abs(data.summary.totalUnaccounted ?? 0) > 0.5) {
    summaryData.push(["Unaccounted (L)", data.summary.totalUnaccounted ?? 0]);
  }

  const summarySheet = XLSX.utils.aoa_to_sheet(summaryData);
  summarySheet["!cols"] = [{ wch: 25 }, { wch: 20 }];
  XLSX.utils.book_append_sheet(workbook, summarySheet, "Summary");

  // ============ Batches Sheet ============
  const batchesData: (string | number)[][] = [
    [
      "Batch Name",
      "Batch Number",
      "Vessel",
      "Status",
      "Initial (L)",
      "Transferred (L)",
      "Packaged (L)",
      "Losses (L)",
      "Current (L)",
      "Discrepancy (L)",
    ],
  ];

  for (const batch of data.batches) {
    batchesData.push([
      batch.customName || "",
      batch.name,
      batch.vesselName || "",
      batch.status || "",
      batch.initialVolume,
      batch.summary.totalOutflow,
      batch.summary.totalPackaged,
      batch.summary.totalLoss,
      batch.currentVolume,
      Math.abs(batch.summary.discrepancy) > 0.5 ? batch.summary.discrepancy : 0,
    ]);
  }

  const batchesSheet = XLSX.utils.aoa_to_sheet(batchesData);
  batchesSheet["!cols"] = [
    { wch: 25 }, // Batch Name
    { wch: 40 }, // Batch Number
    { wch: 15 }, // Vessel
    { wch: 12 }, // Status
    { wch: 12 }, // Initial
    { wch: 14 }, // Transferred
    { wch: 12 }, // Packaged
    { wch: 10 }, // Losses
    { wch: 12 }, // Current
    { wch: 14 }, // Discrepancy
  ];
  XLSX.utils.book_append_sheet(workbook, batchesSheet, "Batches");

  // ============ Details Sheet ============
  const detailsData: (string | number)[][] = [
    [
      "Batch Name",
      "Batch Number",
      "Date",
      "Type",
      "Description",
      "Volume In (L)",
      "Volume Out (L)",
      "Loss (L)",
      "Is Child Outcome",
    ],
  ];

  for (const batch of data.batches) {
    for (const entry of batch.entries) {
      // Main entry
      detailsData.push([
        batch.customName || "",
        batch.name,
        formatDate(entry.date),
        getTypeLabel(entry.type),
        entry.description,
        entry.volumeIn > 0 ? entry.volumeIn : "",
        entry.volumeOut > 0 ? entry.volumeOut : "",
        entry.loss > 0 ? entry.loss : "",
        "No",
      ]);

      // Child outcomes
      if (entry.childOutcomes) {
        for (const child of entry.childOutcomes) {
          const isLoss = child.type === "loss";
          const isPackaging = child.type === "bottling" || child.type === "kegging";

          detailsData.push([
            batch.customName || "",
            batch.name,
            formatDate(entry.date),
            child.type,
            `  ↳ ${child.description}`,
            "",
            isPackaging ? child.volume : "",
            isLoss ? child.volume : "",
            "Yes",
          ]);
        }
      }
    }
  }

  const detailsSheet = XLSX.utils.aoa_to_sheet(detailsData);
  detailsSheet["!cols"] = [
    { wch: 25 }, // Batch Name
    { wch: 40 }, // Batch Number
    { wch: 12 }, // Date
    { wch: 12 }, // Type
    { wch: 40 }, // Description
    { wch: 14 }, // Volume In
    { wch: 14 }, // Volume Out
    { wch: 10 }, // Loss
    { wch: 15 }, // Is Child Outcome
  ];
  XLSX.utils.book_append_sheet(workbook, detailsSheet, "Details");

  return workbook;
}

/**
 * Download the Batch Trace Report Excel file
 */
export async function downloadBatchTraceReportExcel(
  data: BatchTraceReportPDFData,
  filename?: string
): Promise<void> {
  const XLSX = await getXlsx();
  const workbook = await generateBatchTraceReportExcel(data);
  const defaultFilename = `batch-trace-report-${data.asOfDate}.xlsx`;
  XLSX.writeFile(workbook, filename || defaultFilename);
}
