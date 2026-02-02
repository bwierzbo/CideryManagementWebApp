/**
 * CSV Export utility for Batch Trace Report
 */

import { escapeCSVValue, downloadCSV } from "./exportHelpers";
import type { BatchTraceReportPDFData } from "../pdf/batchTraceReport";

// Re-export the type for convenience
export type { BatchTraceReportPDFData as BatchTraceReportCSVData };

/**
 * Format date for CSV
 */
function formatDate(date: Date | string): string {
  const d = new Date(date);
  return d.toISOString().split("T")[0]; // YYYY-MM-DD format
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
 * Generate CSV content for Batch Trace Report
 * Creates a flat format with all entries
 */
export function generateBatchTraceReportCSV(data: BatchTraceReportPDFData): string {
  const rows: string[] = [];

  // Header row
  const headers = [
    "Batch Name",
    "Batch Number",
    "Vessel",
    "Status",
    "Initial Volume (L)",
    "Current Volume (L)",
    "Date",
    "Entry Type",
    "Description",
    "Volume In (L)",
    "Volume Out (L)",
    "Loss (L)",
    "Is Child Outcome",
    "Batch Discrepancy (L)",
  ];
  rows.push(headers.map(escapeCSVValue).join(","));

  // Data rows
  for (const batch of data.batches) {
    const batchDiscrepancy =
      Math.abs(batch.summary.discrepancy) > 0.5 ? batch.summary.discrepancy : 0;

    if (batch.entries.length === 0) {
      // Add a row even if no entries, showing batch summary
      rows.push(
        [
          escapeCSVValue(batch.customName || ""),
          escapeCSVValue(batch.name),
          escapeCSVValue(batch.vesselName || ""),
          escapeCSVValue(batch.status || ""),
          escapeCSVValue(batch.initialVolume),
          escapeCSVValue(batch.currentVolume),
          "", // Date
          "", // Entry Type
          "No activity", // Description
          "", // Volume In
          "", // Volume Out
          "", // Loss
          "", // Is Child
          escapeCSVValue(batchDiscrepancy || ""),
        ].join(",")
      );
    } else {
      for (const entry of batch.entries) {
        // Main entry row
        rows.push(
          [
            escapeCSVValue(batch.customName || ""),
            escapeCSVValue(batch.name),
            escapeCSVValue(batch.vesselName || ""),
            escapeCSVValue(batch.status || ""),
            escapeCSVValue(batch.initialVolume),
            escapeCSVValue(batch.currentVolume),
            escapeCSVValue(formatDate(entry.date)),
            escapeCSVValue(getTypeLabel(entry.type)),
            escapeCSVValue(entry.description),
            escapeCSVValue(entry.volumeIn > 0 ? entry.volumeIn : ""),
            escapeCSVValue(entry.volumeOut > 0 ? entry.volumeOut : ""),
            escapeCSVValue(entry.loss > 0 ? entry.loss : ""),
            escapeCSVValue("No"),
            escapeCSVValue(batchDiscrepancy || ""),
          ].join(",")
        );

        // Child outcomes
        if (entry.childOutcomes) {
          for (const child of entry.childOutcomes) {
            const isLoss = child.type === "loss";
            const isPackaging = child.type === "bottling" || child.type === "kegging";

            rows.push(
              [
                escapeCSVValue(batch.customName || ""),
                escapeCSVValue(batch.name),
                escapeCSVValue(batch.vesselName || ""),
                escapeCSVValue(batch.status || ""),
                escapeCSVValue(batch.initialVolume),
                escapeCSVValue(batch.currentVolume),
                escapeCSVValue(formatDate(entry.date)),
                escapeCSVValue(child.type),
                escapeCSVValue(`↳ ${child.description}`),
                "", // Volume In
                escapeCSVValue(isPackaging ? child.volume : ""),
                escapeCSVValue(isLoss ? child.volume : ""),
                escapeCSVValue("Yes"),
                "", // Discrepancy only on parent
              ].join(",")
            );
          }
        }
      }
    }
  }

  return rows.join("\n");
}

/**
 * Download the Batch Trace Report CSV file
 */
export function downloadBatchTraceReportCSV(
  data: BatchTraceReportPDFData,
  filename?: string
): void {
  const csvContent = generateBatchTraceReportCSV(data);
  const defaultFilename = `batch-trace-report-${data.asOfDate}.csv`;
  downloadCSV(csvContent, filename || defaultFilename);
}
