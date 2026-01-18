/**
 * Excel generation utility for TTB Reconciliation Reports
 * Exports both Inventory Audit and Production Audit data
 */

import { formatDate as formatDateUtil } from "@/utils/date-format";

// Lazy import xlsx to avoid SSR issues
const getXlsx = async () => {
  const XLSX = await import("xlsx");
  return XLSX;
};

export interface ReconciliationExportData {
  reconciliationDate: string;
  name?: string;
  openingBalanceDate: string | null;

  // TTB Reference
  ttbBalance: number;

  // Inventory Audit
  inventoryBulk: number;
  inventoryPackaged: number;
  inventoryOnHand: number;
  inventoryRemovals: number;
  inventoryLegacy: number;
  inventoryAccountedFor: number;
  inventoryDifference: number;

  // Production Audit
  productionPressRuns: number;
  productionJuicePurchases: number;
  productionTotal: number;

  // Breakdowns
  inventoryByYear: Array<{
    year: number;
    bulkGallons: number;
    packagedGallons: number;
    totalGallons: number;
  }>;
  productionByYear: Array<{
    year: number;
    pressRunsGallons: number;
    juicePurchasesGallons: number;
    totalGallons: number;
  }>;
  taxClasses?: Array<{
    label: string;
    ttbTotal: number;
    currentInventory: number;
    removals: number;
    legacyBatches: number;
    difference: number;
  }>;

  // Status
  isReconciled: boolean;
  notes?: string;
  discrepancyExplanation?: string;
}

function formatGallons(value: number): string {
  return value.toLocaleString("en-US", {
    minimumFractionDigits: 1,
    maximumFractionDigits: 1,
  });
}

function formatDate(date: Date | string | null): string {
  if (!date) return "N/A";
  return formatDateUtil(date);
}

/**
 * Generate Excel workbook for TTB Reconciliation Report
 */
export async function generateReconciliationExcel(data: ReconciliationExportData) {
  const XLSX = await getXlsx();

  const workbook = XLSX.utils.book_new();

  // ============================================
  // SUMMARY SHEET
  // ============================================
  const summaryData = [
    ["TTB RECONCILIATION REPORT"],
    [],
    ["Reconciliation Date", formatDate(data.reconciliationDate)],
    ["Report Name", data.name || "Untitled"],
    ["TTB Opening Balance Date", formatDate(data.openingBalanceDate)],
    ["Status", data.isReconciled ? "RECONCILED" : "UNRECONCILED"],
    [],
    ["═══════════════════════════════════════════════════════════════"],
    ["INVENTORY AUDIT - Where is all the cider?"],
    ["═══════════════════════════════════════════════════════════════"],
    [],
    ["TTB Opening Balance", formatGallons(data.ttbBalance), "gal"],
    [],
    ["Current Inventory:"],
    ["  Bulk (Vessels)", formatGallons(data.inventoryBulk), "gal"],
    ["  Packaged (Bottles/Kegs)", formatGallons(data.inventoryPackaged), "gal"],
    ["  Total On Hand", formatGallons(data.inventoryOnHand), "gal"],
    [],
    ["Removals Since TTB Date", formatGallons(data.inventoryRemovals), "gal"],
    ["Legacy Batches", formatGallons(data.inventoryLegacy), "gal"],
    [],
    ["Total Accounted For", formatGallons(data.inventoryAccountedFor), "gal"],
    ["Difference (TTB - Accounted)", formatGallons(data.inventoryDifference), "gal"],
    [],
    ["═══════════════════════════════════════════════════════════════"],
    ["PRODUCTION AUDIT - Did we track all sources?"],
    ["═══════════════════════════════════════════════════════════════"],
    [],
    ["Press Runs (In-house)", formatGallons(data.productionPressRuns), "gal"],
    ["Juice Purchases", formatGallons(data.productionJuicePurchases), "gal"],
    ["Total Production Tracked", formatGallons(data.productionTotal), "gal"],
    [],
  ];

  if (data.notes) {
    summaryData.push(["Notes:", data.notes]);
  }
  if (data.discrepancyExplanation) {
    summaryData.push(["Discrepancy Explanation:", data.discrepancyExplanation]);
  }

  const summarySheet = XLSX.utils.aoa_to_sheet(summaryData);

  // Set column widths
  summarySheet["!cols"] = [{ wch: 35 }, { wch: 15 }, { wch: 10 }];

  XLSX.utils.book_append_sheet(workbook, summarySheet, "Summary");

  // ============================================
  // INVENTORY BY YEAR SHEET
  // ============================================
  if (data.inventoryByYear && data.inventoryByYear.length > 0) {
    const inventoryYearData = [
      ["INVENTORY BY BATCH YEAR"],
      [],
      ["Year", "Bulk (gal)", "Packaged (gal)", "Total (gal)"],
      ...data.inventoryByYear.map((y) => [
        y.year,
        formatGallons(y.bulkGallons),
        formatGallons(y.packagedGallons),
        formatGallons(y.totalGallons),
      ]),
      [],
      [
        "TOTAL",
        formatGallons(data.inventoryByYear.reduce((s, y) => s + y.bulkGallons, 0)),
        formatGallons(data.inventoryByYear.reduce((s, y) => s + y.packagedGallons, 0)),
        formatGallons(data.inventoryByYear.reduce((s, y) => s + y.totalGallons, 0)),
      ],
    ];

    const inventoryYearSheet = XLSX.utils.aoa_to_sheet(inventoryYearData);
    inventoryYearSheet["!cols"] = [{ wch: 10 }, { wch: 15 }, { wch: 15 }, { wch: 15 }];
    XLSX.utils.book_append_sheet(workbook, inventoryYearSheet, "Inventory By Year");
  }

  // ============================================
  // PRODUCTION BY YEAR SHEET
  // ============================================
  if (data.productionByYear && data.productionByYear.length > 0) {
    const productionYearData = [
      ["PRODUCTION BY YEAR"],
      [],
      ["Year", "Press Runs (gal)", "Juice Purchases (gal)", "Total (gal)"],
      ...data.productionByYear.map((y) => [
        y.year,
        formatGallons(y.pressRunsGallons),
        formatGallons(y.juicePurchasesGallons),
        formatGallons(y.totalGallons),
      ]),
      [],
      [
        "TOTAL",
        formatGallons(data.productionByYear.reduce((s, y) => s + y.pressRunsGallons, 0)),
        formatGallons(data.productionByYear.reduce((s, y) => s + y.juicePurchasesGallons, 0)),
        formatGallons(data.productionByYear.reduce((s, y) => s + y.totalGallons, 0)),
      ],
    ];

    const productionYearSheet = XLSX.utils.aoa_to_sheet(productionYearData);
    productionYearSheet["!cols"] = [{ wch: 10 }, { wch: 20 }, { wch: 22 }, { wch: 15 }];
    XLSX.utils.book_append_sheet(workbook, productionYearSheet, "Production By Year");
  }

  // ============================================
  // TAX CLASS BREAKDOWN SHEET
  // ============================================
  if (data.taxClasses && data.taxClasses.length > 0) {
    const taxClassData = [
      ["TAX CLASS BREAKDOWN"],
      [],
      ["Tax Class", "TTB Balance", "On Hand", "Removals", "Legacy", "Difference"],
      ...data.taxClasses.map((tc) => [
        tc.label,
        formatGallons(tc.ttbTotal),
        formatGallons(tc.currentInventory),
        formatGallons(tc.removals),
        formatGallons(tc.legacyBatches),
        formatGallons(tc.difference),
      ]),
    ];

    const taxClassSheet = XLSX.utils.aoa_to_sheet(taxClassData);
    taxClassSheet["!cols"] = [
      { wch: 25 },
      { wch: 12 },
      { wch: 12 },
      { wch: 12 },
      { wch: 12 },
      { wch: 12 },
    ];
    XLSX.utils.book_append_sheet(workbook, taxClassSheet, "Tax Classes");
  }

  return workbook;
}

/**
 * Download the reconciliation as Excel file
 */
export async function downloadReconciliationExcel(
  data: ReconciliationExportData,
  filename?: string
) {
  const XLSX = await getXlsx();
  const workbook = await generateReconciliationExcel(data);

  const defaultFilename = `TTB-Reconciliation-${data.reconciliationDate}.xlsx`;
  XLSX.writeFile(workbook, filename || defaultFilename);
}
