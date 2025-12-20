/**
 * Excel generation utility for TTB Form 5120.17
 * Report of Wine Premises Operations - Hard Cider
 */

import type { TTBFormPDFData } from "../pdf/ttbForm512017";
import { formatDate as formatDateUtil, formatDateTime } from "@/utils/date-format";

// Re-export the type for convenience
export type { TTBFormPDFData as TTBFormExcelData };

// Lazy import xlsx to avoid SSR issues
const getXlsx = async () => {
  const XLSX = await import("xlsx");
  return XLSX;
};

/**
 * Format a number as currency string
 */
function formatCurrency(value: number): string {
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "USD",
  }).format(value);
}

/**
 * Format gallons with 3 decimal places
 */
function formatGallons(value: number): string {
  return value.toLocaleString("en-US", {
    minimumFractionDigits: 3,
    maximumFractionDigits: 3,
  });
}

/**
 * Format a date as MM/DD/YYYY using centralized utility
 */
function formatDate(date: Date | string | null): string {
  if (!date) return "N/A";
  return formatDateUtil(date);
}

/**
 * Generate Excel workbook for TTB Form 5120.17
 */
export async function generateTTBFormExcel(
  formData: TTBFormPDFData,
  periodLabel: string
) {
  const XLSX = await getXlsx();

  // Create workbook
  const workbook = XLSX.utils.book_new();

  // Summary Sheet
  const summaryData = [
    ["TTB Form 5120.17 - Report of Wine Premises Operations"],
    ["Hard Cider (Under 8.5% ABV)"],
    [],
    ["Reporting Period", periodLabel],
    ["Period Start", formatDate(formData.reportingPeriod.startDate)],
    ["Period End", formatDate(formData.reportingPeriod.endDate)],
    [],
    ["SUMMARY"],
    ["Wine Produced", formatGallons(formData.wineProduced.total), "wine gallons"],
    [
      "Tax-Paid Removals",
      formatGallons(formData.taxPaidRemovals.total),
      "wine gallons",
    ],
    [
      "Other Removals",
      formatGallons(formData.otherRemovals.total),
      "wine gallons",
    ],
    ["Net Tax Owed", formatCurrency(formData.taxSummary.netTaxOwed)],
    [],
    ["RECONCILIATION"],
    [
      "Total Available",
      formatGallons(formData.reconciliation.totalAvailable),
      "(Beginning + Production + Receipts)",
    ],
    [
      "Total Accounted For",
      formatGallons(formData.reconciliation.totalAccountedFor),
      "(Removals + Ending Inventory)",
    ],
    [
      "Variance",
      formatGallons(formData.reconciliation.variance),
      formData.reconciliation.balanced ? "BALANCED" : "INVESTIGATE",
    ],
    [],
    ["Report generated:", formatDateTime(new Date())],
  ];

  const summarySheet = XLSX.utils.aoa_to_sheet(summaryData);

  // Set column widths for summary
  summarySheet["!cols"] = [{ wch: 25 }, { wch: 20 }, { wch: 30 }];

  XLSX.utils.book_append_sheet(workbook, summarySheet, "Summary");

  // Detailed Form Sheet
  const detailData = [
    ["TTB FORM 5120.17 - DETAILED BREAKDOWN"],
    [],
    ["PART I - BEGINNING INVENTORY (Wine Gallons)"],
    ["Line", "Description", "Wine Gallons"],
    ["1", "Bulk (Tanks/Barrels)", formData.beginningInventory.bulk],
    ["2", "Bottled/Packaged", formData.beginningInventory.bottled],
    ["3", "TOTAL BEGINNING INVENTORY", formData.beginningInventory.total],
    [],
    ["PART II - WINE/CIDER PRODUCED (Wine Gallons)"],
    ["Line", "Description", "Wine Gallons"],
    ["4", "Total Wine/Cider Produced", formData.wineProduced.total],
    [],
    ["PART III - RECEIPTS (Wine Gallons)"],
    ["Line", "Description", "Wine Gallons"],
    ["5", "Wine Received from Other Premises", formData.receipts.total],
    [],
    ["PART IV - TAX-PAID REMOVALS (Wine Gallons)"],
    ["Line", "Description", "Wine Gallons"],
    ["6a", "Tasting Room", formData.taxPaidRemovals.tastingRoom],
    ["6b", "Wholesale/Distributors", formData.taxPaidRemovals.wholesale],
    ["6c", "Online/DTC Shipping", formData.taxPaidRemovals.onlineDtc],
    ["6d", "Events/Farmers Markets", formData.taxPaidRemovals.events],
    ...(formData.taxPaidRemovals.uncategorized > 0
      ? [["6e", "Other/Uncategorized", formData.taxPaidRemovals.uncategorized]]
      : []),
    ["7", "TOTAL TAX-PAID REMOVALS", formData.taxPaidRemovals.total],
    [],
    ["PART V - OTHER REMOVALS (Wine Gallons)"],
    ["Line", "Description", "Wine Gallons"],
    ["8a", "Samples/Tastings", formData.otherRemovals.samples],
    ["8b", "Breakage", formData.otherRemovals.breakage],
    ["8c", "Process Losses (Filter/Racking)", formData.otherRemovals.processLosses],
    ["8d", "Spoilage", formData.otherRemovals.spoilage],
    ["9", "TOTAL OTHER REMOVALS", formData.otherRemovals.total],
    [],
    ["PART VI - ENDING INVENTORY (Wine Gallons)"],
    ["Line", "Description", "Wine Gallons"],
    ["10", "Bulk (Tanks/Barrels)", formData.endingInventory.bulk],
    ["11", "Bottled/Packaged", formData.endingInventory.bottled],
    ["12", "TOTAL ENDING INVENTORY", formData.endingInventory.total],
    [],
    ["PART VII - TAX CALCULATION"],
    ["Line", "Description", "Value"],
    ["13", "Taxable Gallons", formData.taxSummary.taxableGallons],
    ["", "Tax Rate", "$0.226 per wine gallon"],
    ["14", "Gross Tax", formData.taxSummary.grossTax],
    [
      "15",
      `Small Producer Credit (${formatGallons(formData.taxSummary.creditEligibleGallons)} gal @ $0.056)`,
      -formData.taxSummary.smallProducerCredit,
    ],
    ["16", "NET TAX OWED", formData.taxSummary.netTaxOwed],
    ["", "Effective Rate", `$${formData.taxSummary.effectiveRate.toFixed(4)} / gal`],
  ];

  const detailSheet = XLSX.utils.aoa_to_sheet(detailData);

  // Set column widths for detail
  detailSheet["!cols"] = [{ wch: 8 }, { wch: 45 }, { wch: 20 }];

  XLSX.utils.book_append_sheet(workbook, detailSheet, "Form Details");

  // Tax-Paid Removals by Channel Sheet
  const channelData = [
    ["TAX-PAID REMOVALS BY SALES CHANNEL"],
    [],
    ["Channel", "Wine Gallons", "% of Total"],
    [
      "Tasting Room",
      formData.taxPaidRemovals.tastingRoom,
      formData.taxPaidRemovals.total > 0
        ? `${((formData.taxPaidRemovals.tastingRoom / formData.taxPaidRemovals.total) * 100).toFixed(1)}%`
        : "0%",
    ],
    [
      "Wholesale/Distributors",
      formData.taxPaidRemovals.wholesale,
      formData.taxPaidRemovals.total > 0
        ? `${((formData.taxPaidRemovals.wholesale / formData.taxPaidRemovals.total) * 100).toFixed(1)}%`
        : "0%",
    ],
    [
      "Online/DTC Shipping",
      formData.taxPaidRemovals.onlineDtc,
      formData.taxPaidRemovals.total > 0
        ? `${((formData.taxPaidRemovals.onlineDtc / formData.taxPaidRemovals.total) * 100).toFixed(1)}%`
        : "0%",
    ],
    [
      "Events/Farmers Markets",
      formData.taxPaidRemovals.events,
      formData.taxPaidRemovals.total > 0
        ? `${((formData.taxPaidRemovals.events / formData.taxPaidRemovals.total) * 100).toFixed(1)}%`
        : "0%",
    ],
    ...(formData.taxPaidRemovals.uncategorized > 0
      ? [
          [
            "Other/Uncategorized",
            formData.taxPaidRemovals.uncategorized,
            `${((formData.taxPaidRemovals.uncategorized / formData.taxPaidRemovals.total) * 100).toFixed(1)}%`,
          ],
        ]
      : []),
    [],
    ["TOTAL", formData.taxPaidRemovals.total, "100%"],
  ];

  const channelSheet = XLSX.utils.aoa_to_sheet(channelData);

  // Set column widths for channels
  channelSheet["!cols"] = [{ wch: 25 }, { wch: 15 }, { wch: 12 }];

  XLSX.utils.book_append_sheet(workbook, channelSheet, "Sales Channels");

  return workbook;
}

/**
 * Download the TTB Form Excel with a given filename
 */
export async function downloadTTBFormExcel(
  formData: TTBFormPDFData,
  periodLabel: string,
  filename: string
): Promise<void> {
  const XLSX = await getXlsx();
  const workbook = await generateTTBFormExcel(formData, periodLabel);
  XLSX.writeFile(workbook, filename);
}
