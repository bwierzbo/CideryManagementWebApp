/**
 * PDF generation utility for TTB Reconciliation Reports
 * Exports both Inventory Audit and Production Audit data
 */

import type { TDocumentDefinitions, Content } from "pdfmake/interfaces";
import { formatDate as formatDateUtil } from "@/utils/date-format";
import type { ReconciliationExportData } from "../excel/ttbReconciliation";

// Re-export the type
export type { ReconciliationExportData };

// Lazy import pdfMake to avoid SSR issues
const getPdfMake = async () => {
  const pdfMake = await import("pdfmake/build/pdfmake");
  const pdfFonts = await import("pdfmake/build/vfs_fonts");
  (pdfMake.default as any).vfs = pdfFonts.default;
  return pdfMake.default;
};

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
 * Generate PDF document definition for TTB Reconciliation Report
 */
export function generateReconciliationPDFDefinition(
  data: ReconciliationExportData
): TDocumentDefinitions {
  const content: Content = [
    // Header
    {
      text: "TTB RECONCILIATION REPORT",
      style: "header",
      alignment: "center",
      margin: [0, 0, 0, 10],
    },
    {
      columns: [
        { text: `Reconciliation Date: ${formatDate(data.reconciliationDate)}`, width: "*" },
        {
          text: data.isReconciled ? "✓ RECONCILED" : "⚠ UNRECONCILED",
          width: "auto",
          color: data.isReconciled ? "#16a34a" : "#d97706",
          bold: true,
        },
      ],
      margin: [0, 0, 0, 5],
    },
    {
      text: `TTB Opening Balance Date: ${formatDate(data.openingBalanceDate)}`,
      margin: [0, 0, 0, 15],
    },

    // Inventory Audit Section
    {
      text: "INVENTORY AUDIT",
      style: "sectionHeader",
      margin: [0, 10, 0, 5],
    },
    { text: "Where is all the cider?", style: "sectionSubheader", margin: [0, 0, 0, 10] },

    {
      table: {
        widths: ["*", 100, 40],
        body: [
          [
            { text: "TTB Opening Balance", bold: true },
            { text: formatGallons(data.ttbBalance), alignment: "right" },
            { text: "gal", alignment: "left" },
          ],
          [{ text: "", colSpan: 3 }, "", ""],
          [
            { text: "Current Inventory:", bold: true, colSpan: 3 },
            "",
            "",
          ],
          [
            { text: "    Bulk (Vessels)", margin: [20, 0, 0, 0] },
            { text: formatGallons(data.inventoryBulk), alignment: "right" },
            { text: "gal", alignment: "left" },
          ],
          [
            { text: "    Packaged (Bottles/Kegs)", margin: [20, 0, 0, 0] },
            { text: formatGallons(data.inventoryPackaged), alignment: "right" },
            { text: "gal", alignment: "left" },
          ],
          [
            { text: "    Total On Hand", bold: true, margin: [20, 0, 0, 0] },
            { text: formatGallons(data.inventoryOnHand), alignment: "right", bold: true },
            { text: "gal", alignment: "left" },
          ],
          [{ text: "", colSpan: 3 }, "", ""],
          [
            { text: "Removals Since TTB Date" },
            { text: formatGallons(data.inventoryRemovals), alignment: "right" },
            { text: "gal", alignment: "left" },
          ],
          [
            { text: "Legacy Batches" },
            { text: formatGallons(data.inventoryLegacy), alignment: "right" },
            { text: "gal", alignment: "left" },
          ],
          [{ text: "", colSpan: 3 }, "", ""],
          [
            { text: "Total Accounted For", bold: true },
            { text: formatGallons(data.inventoryAccountedFor), alignment: "right", bold: true },
            { text: "gal", alignment: "left" },
          ],
          [
            {
              text: "Difference (TTB - Accounted)",
              bold: true,
              color: Math.abs(data.inventoryDifference) < 0.5 ? "#16a34a" : "#d97706",
            },
            {
              text: (data.inventoryDifference >= 0 ? "+" : "") + formatGallons(data.inventoryDifference),
              alignment: "right",
              bold: true,
              color: Math.abs(data.inventoryDifference) < 0.5 ? "#16a34a" : "#d97706",
            },
            { text: "gal", alignment: "left" },
          ],
        ],
      },
      layout: "noBorders",
      margin: [0, 0, 0, 20],
    },

    // Production Audit Section
    {
      text: "PRODUCTION AUDIT",
      style: "sectionHeader",
      margin: [0, 10, 0, 5],
    },
    { text: "Did we track all sources?", style: "sectionSubheader", margin: [0, 0, 0, 10] },

    {
      table: {
        widths: ["*", 100, 40],
        body: [
          [
            { text: "Press Runs (In-house)" },
            { text: formatGallons(data.productionPressRuns), alignment: "right" },
            { text: "gal", alignment: "left" },
          ],
          [
            { text: "Juice Purchases" },
            { text: formatGallons(data.productionJuicePurchases), alignment: "right" },
            { text: "gal", alignment: "left" },
          ],
          [{ text: "", colSpan: 3 }, "", ""],
          [
            { text: "Total Production Tracked", bold: true },
            { text: formatGallons(data.productionTotal), alignment: "right", bold: true },
            { text: "gal", alignment: "left" },
          ],
        ],
      },
      layout: "noBorders",
      margin: [0, 0, 0, 20],
    },
  ];

  // Production By Year Table
  if (data.productionByYear && data.productionByYear.length > 0) {
    content.push(
      { text: "Production by Year", style: "subheader", margin: [0, 10, 0, 5] } as Content,
      {
        table: {
          headerRows: 1,
          widths: [50, "*", "*", "*"],
          body: [
            [
              { text: "Year", bold: true },
              { text: "Press Runs", bold: true, alignment: "right" },
              { text: "Purchases", bold: true, alignment: "right" },
              { text: "Total", bold: true, alignment: "right" },
            ],
            ...data.productionByYear.map((y) => [
              y.year.toString(),
              { text: formatGallons(y.pressRunsGallons), alignment: "right" },
              { text: formatGallons(y.juicePurchasesGallons), alignment: "right" },
              { text: formatGallons(y.totalGallons), alignment: "right" },
            ]),
          ],
        },
        layout: "lightHorizontalLines",
        margin: [0, 0, 0, 20],
      } as Content
    );
  }

  // Inventory By Year Table
  if (data.inventoryByYear && data.inventoryByYear.length > 0) {
    content.push(
      { text: "Inventory by Batch Year", style: "subheader", margin: [0, 10, 0, 5] } as Content,
      {
        table: {
          headerRows: 1,
          widths: [50, "*", "*", "*"],
          body: [
            [
              { text: "Year", bold: true },
              { text: "Bulk", bold: true, alignment: "right" },
              { text: "Packaged", bold: true, alignment: "right" },
              { text: "Total", bold: true, alignment: "right" },
            ],
            ...data.inventoryByYear.map((y) => [
              y.year.toString(),
              { text: formatGallons(y.bulkGallons), alignment: "right" },
              { text: formatGallons(y.packagedGallons), alignment: "right" },
              { text: formatGallons(y.totalGallons), alignment: "right" },
            ]),
          ],
        },
        layout: "lightHorizontalLines",
        margin: [0, 0, 0, 20],
      } as Content
    );
  }

  // Notes
  if (data.notes) {
    content.push(
      { text: "Notes", style: "subheader", margin: [0, 10, 0, 5] } as Content,
      { text: data.notes, margin: [0, 0, 0, 10] } as Content
    );
  }

  if (data.discrepancyExplanation) {
    content.push(
      { text: "Discrepancy Explanation", style: "subheader", margin: [0, 10, 0, 5] } as Content,
      { text: data.discrepancyExplanation, margin: [0, 0, 0, 10] } as Content
    );
  }

  // Footer
  content.push({
    text: `Generated: ${new Date().toLocaleString()}`,
    style: "footer",
    margin: [0, 30, 0, 0],
  } as Content);

  return {
    content,
    defaultStyle: {
      fontSize: 10,
    },
    styles: {
      header: {
        fontSize: 18,
        bold: true,
      },
      sectionHeader: {
        fontSize: 14,
        bold: true,
        color: "#1e40af",
      },
      sectionSubheader: {
        fontSize: 10,
        italics: true,
        color: "#6b7280",
      },
      subheader: {
        fontSize: 12,
        bold: true,
      },
      footer: {
        fontSize: 8,
        color: "#9ca3af",
      },
    },
    pageMargins: [40, 40, 40, 40],
  };
}

/**
 * Download the reconciliation as PDF file
 */
export async function downloadReconciliationPDF(
  data: ReconciliationExportData,
  filename?: string
) {
  const pdfMake = await getPdfMake();
  const docDefinition = generateReconciliationPDFDefinition(data);

  const defaultFilename = `TTB-Reconciliation-${data.reconciliationDate}.pdf`;
  pdfMake.createPdf(docDefinition).download(filename || defaultFilename);
}
