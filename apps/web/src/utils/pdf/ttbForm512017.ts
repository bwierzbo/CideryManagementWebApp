/**
 * PDF generation utility for TTB Form 5120.17
 * Report of Wine Premises Operations - Hard Cider
 */

import type { TDocumentDefinitions, Content } from "pdfmake/interfaces";

// Lazy import pdfMake to avoid SSR issues
const getPdfMake = async () => {
  const pdfMake = await import("pdfmake/build/pdfmake");
  const pdfFonts = await import("pdfmake/build/vfs_fonts");
  (pdfMake.default as any).vfs = pdfFonts.default;
  return pdfMake.default;
};

/**
 * Serialized TTB Form data (dates as strings from tRPC)
 */
export interface TTBFormPDFData {
  reportingPeriod: {
    type: "monthly" | "quarterly" | "annual";
    startDate: string | Date;
    endDate: string | Date;
    year: number;
    month?: number;
    quarter?: number;
  };
  beginningInventory: {
    bulk: number;
    bottled: number;
    total: number;
  };
  wineProduced: {
    total: number;
  };
  receipts: {
    total: number;
  };
  taxPaidRemovals: {
    tastingRoom: number;
    wholesale: number;
    onlineDtc: number;
    events: number;
    uncategorized: number;
    total: number;
  };
  otherRemovals: {
    samples: number;
    breakage: number;
    processLosses: number;
    spoilage: number;
    total: number;
  };
  endingInventory: {
    bulk: number;
    bottled: number;
    total: number;
  };
  taxSummary: {
    taxableGallons: number;
    grossTax: number;
    smallProducerCredit: number;
    creditEligibleGallons: number;
    netTaxOwed: number;
    effectiveRate: number;
  };
  reconciliation: {
    totalAvailable: number;
    totalAccountedFor: number;
    variance: number;
    balanced: boolean;
  };
}

/**
 * Format a number as currency
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
 * Format a date as MM/DD/YYYY
 */
function formatDate(date: Date | string | null): string {
  if (!date) return "N/A";
  return new Date(date).toLocaleDateString("en-US");
}

/**
 * Generate PDF document for TTB Form 5120.17
 */
export function generateTTBFormPDF(
  formData: TTBFormPDFData,
  periodLabel: string
): TDocumentDefinitions {
  const content: Content[] = [];

  // Header
  content.push({
    columns: [
      {
        text: "TTB Form 5120.17",
        style: "header",
        width: "*",
      },
      {
        text: "OMB No. 1513-0053",
        style: "ombNumber",
        width: "auto",
        alignment: "right",
      },
    ],
    margin: [0, 0, 0, 5],
  });

  content.push({
    text: "REPORT OF WINE PREMISES OPERATIONS",
    style: "subheader",
    margin: [0, 0, 0, 5],
  });

  content.push({
    text: "Hard Cider (Under 8.5% ABV)",
    style: "productType",
    margin: [0, 0, 0, 15],
  });

  // Period Info Box
  content.push({
    table: {
      widths: ["*", "*", "*"],
      body: [
        [
          { text: "Reporting Period", style: "infoLabel" },
          { text: "Period Start", style: "infoLabel" },
          { text: "Period End", style: "infoLabel" },
        ],
        [
          { text: periodLabel, style: "infoValue" },
          { text: formatDate(formData.reportingPeriod.startDate), style: "infoValue" },
          { text: formatDate(formData.reportingPeriod.endDate), style: "infoValue" },
        ],
      ],
    },
    layout: {
      fillColor: (rowIndex: number) => (rowIndex === 0 ? "#f3f4f6" : null),
      hLineWidth: () => 0.5,
      vLineWidth: () => 0.5,
    },
    margin: [0, 0, 0, 20],
  });

  // Part I - Beginning Inventory
  content.push({
    text: "PART I - BEGINNING INVENTORY (Wine Gallons)",
    style: "sectionHeader",
    margin: [0, 10, 0, 10],
  });

  content.push({
    table: {
      widths: ["*", 100],
      body: [
        [
          { text: "1. Bulk (Tanks/Barrels)", style: "lineLabel" },
          { text: formatGallons(formData.beginningInventory.bulk), style: "lineValue" },
        ],
        [
          { text: "2. Bottled/Packaged", style: "lineLabel" },
          { text: formatGallons(formData.beginningInventory.bottled), style: "lineValue" },
        ],
        [
          { text: "3. TOTAL BEGINNING INVENTORY", style: "lineLabelBold" },
          { text: formatGallons(formData.beginningInventory.total), style: "lineValueBold" },
        ],
      ],
    },
    layout: "lightHorizontalLines",
    margin: [0, 0, 0, 15],
  });

  // Part II - Wine Produced
  content.push({
    text: "PART II - WINE/CIDER PRODUCED (Wine Gallons)",
    style: "sectionHeader",
    margin: [0, 10, 0, 10],
  });

  content.push({
    table: {
      widths: ["*", 100],
      body: [
        [
          { text: "4. Total Wine/Cider Produced", style: "lineLabelBold" },
          { text: formatGallons(formData.wineProduced.total), style: "lineValueBold" },
        ],
      ],
    },
    layout: "lightHorizontalLines",
    margin: [0, 0, 0, 15],
  });

  // Part III - Receipts
  content.push({
    text: "PART III - RECEIPTS (Wine Gallons)",
    style: "sectionHeader",
    margin: [0, 10, 0, 10],
  });

  content.push({
    table: {
      widths: ["*", 100],
      body: [
        [
          { text: "5. Wine Received from Other Premises", style: "lineLabelBold" },
          { text: formatGallons(formData.receipts.total), style: "lineValueBold" },
        ],
      ],
    },
    layout: "lightHorizontalLines",
    margin: [0, 0, 0, 15],
  });

  // Part IV - Tax-Paid Removals
  content.push({
    text: "PART IV - TAX-PAID REMOVALS (Wine Gallons)",
    style: "sectionHeader",
    margin: [0, 10, 0, 10],
  });

  content.push({
    table: {
      widths: ["*", 100],
      body: [
        [
          { text: "6a. Tasting Room", style: "lineLabel" },
          { text: formatGallons(formData.taxPaidRemovals.tastingRoom), style: "lineValue" },
        ],
        [
          { text: "6b. Wholesale/Distributors", style: "lineLabel" },
          { text: formatGallons(formData.taxPaidRemovals.wholesale), style: "lineValue" },
        ],
        [
          { text: "6c. Online/DTC Shipping", style: "lineLabel" },
          { text: formatGallons(formData.taxPaidRemovals.onlineDtc), style: "lineValue" },
        ],
        [
          { text: "6d. Events/Farmers Markets", style: "lineLabel" },
          { text: formatGallons(formData.taxPaidRemovals.events), style: "lineValue" },
        ],
        ...(formData.taxPaidRemovals.uncategorized > 0
          ? [
              [
                { text: "6e. Other/Uncategorized", style: "lineLabel" },
                { text: formatGallons(formData.taxPaidRemovals.uncategorized), style: "lineValue" },
              ],
            ]
          : []),
        [
          { text: "7. TOTAL TAX-PAID REMOVALS", style: "lineLabelBold" },
          { text: formatGallons(formData.taxPaidRemovals.total), style: "lineValueBold" },
        ],
      ],
    },
    layout: "lightHorizontalLines",
    margin: [0, 0, 0, 15],
  });

  // Part V - Other Removals
  content.push({
    text: "PART V - OTHER REMOVALS (Wine Gallons)",
    style: "sectionHeader",
    margin: [0, 10, 0, 10],
  });

  content.push({
    table: {
      widths: ["*", 100],
      body: [
        [
          { text: "8a. Samples/Tastings", style: "lineLabel" },
          { text: formatGallons(formData.otherRemovals.samples), style: "lineValue" },
        ],
        [
          { text: "8b. Breakage", style: "lineLabel" },
          { text: formatGallons(formData.otherRemovals.breakage), style: "lineValue" },
        ],
        [
          { text: "8c. Process Losses (Filter/Racking)", style: "lineLabel" },
          { text: formatGallons(formData.otherRemovals.processLosses), style: "lineValue" },
        ],
        [
          { text: "8d. Spoilage", style: "lineLabel" },
          { text: formatGallons(formData.otherRemovals.spoilage), style: "lineValue" },
        ],
        [
          { text: "9. TOTAL OTHER REMOVALS", style: "lineLabelBold" },
          { text: formatGallons(formData.otherRemovals.total), style: "lineValueBold" },
        ],
      ],
    },
    layout: "lightHorizontalLines",
    margin: [0, 0, 0, 15],
  });

  // Part VI - Ending Inventory
  content.push({
    text: "PART VI - ENDING INVENTORY (Wine Gallons)",
    style: "sectionHeader",
    margin: [0, 10, 0, 10],
  });

  content.push({
    table: {
      widths: ["*", 100],
      body: [
        [
          { text: "10. Bulk (Tanks/Barrels)", style: "lineLabel" },
          { text: formatGallons(formData.endingInventory.bulk), style: "lineValue" },
        ],
        [
          { text: "11. Bottled/Packaged", style: "lineLabel" },
          { text: formatGallons(formData.endingInventory.bottled), style: "lineValue" },
        ],
        [
          { text: "12. TOTAL ENDING INVENTORY", style: "lineLabelBold" },
          { text: formatGallons(formData.endingInventory.total), style: "lineValueBold" },
        ],
      ],
    },
    layout: "lightHorizontalLines",
    margin: [0, 0, 0, 15],
  });

  // Page break before tax calculation
  content.push({ text: "", pageBreak: "before" });

  // Part VII - Tax Calculation
  content.push({
    text: "PART VII - TAX CALCULATION",
    style: "sectionHeader",
    margin: [0, 10, 0, 10],
  });

  content.push({
    text: "Hard Cider Tax Rate: $0.226 per wine gallon",
    style: "taxNote",
    margin: [0, 0, 0, 5],
  });

  content.push({
    text: "Small Producer Credit: $0.056 per wine gallon (first 30,000 gallons annually)",
    style: "taxNote",
    margin: [0, 0, 0, 10],
  });

  content.push({
    table: {
      widths: ["*", 120],
      body: [
        [
          { text: "13. Taxable Gallons (Line 7)", style: "lineLabel" },
          { text: formatGallons(formData.taxSummary.taxableGallons), style: "lineValue" },
        ],
        [
          { text: "14. Gross Tax ($0.226 × Line 13)", style: "lineLabel" },
          { text: formatCurrency(formData.taxSummary.grossTax), style: "lineValue" },
        ],
        [
          {
            text: `15. Small Producer Credit (${formatGallons(formData.taxSummary.creditEligibleGallons)} gal × $0.056)`,
            style: "lineLabel",
          },
          { text: `(${formatCurrency(formData.taxSummary.smallProducerCredit)})`, style: "lineValueCredit" },
        ],
        [
          { text: "16. NET TAX OWED (Line 14 - Line 15)", style: "lineLabelBold" },
          {
            text: formatCurrency(formData.taxSummary.netTaxOwed),
            style: "lineValueTax",
            fillColor: "#fef3c7",
          },
        ],
        [
          { text: "Effective Tax Rate", style: "lineLabel" },
          { text: `$${formData.taxSummary.effectiveRate.toFixed(4)} / gal`, style: "lineValue" },
        ],
      ],
    },
    layout: "lightHorizontalLines",
    margin: [0, 0, 0, 20],
  });

  // Reconciliation
  content.push({
    text: "INVENTORY RECONCILIATION",
    style: "sectionHeader",
    margin: [0, 20, 0, 10],
  });

  const reconciliationStatus = formData.reconciliation.balanced
    ? { text: "BALANCED", color: "#15803d" }
    : { text: `VARIANCE: ${formatGallons(formData.reconciliation.variance)} gal`, color: "#dc2626" };

  content.push({
    table: {
      widths: ["*", "*", "*"],
      body: [
        [
          { text: "Total Available", style: "reconHeader" },
          { text: "Total Accounted For", style: "reconHeader" },
          { text: "Status", style: "reconHeader" },
        ],
        [
          {
            stack: [
              { text: formatGallons(formData.reconciliation.totalAvailable), style: "reconValue" },
              { text: "(Beginning + Production + Receipts)", style: "reconSubtext" },
            ],
          },
          {
            stack: [
              { text: formatGallons(formData.reconciliation.totalAccountedFor), style: "reconValue" },
              { text: "(Removals + Ending Inventory)", style: "reconSubtext" },
            ],
          },
          {
            text: reconciliationStatus.text,
            style: "reconStatus",
            color: reconciliationStatus.color,
          },
        ],
      ],
    },
    layout: {
      fillColor: (rowIndex: number) => (rowIndex === 0 ? "#f3f4f6" : null),
      hLineWidth: () => 0.5,
      vLineWidth: () => 0.5,
    },
    margin: [0, 0, 0, 20],
  });

  // Footer with generation timestamp
  content.push({
    text: `Report generated: ${new Date().toLocaleString("en-US")}`,
    style: "footer",
    margin: [0, 30, 0, 0],
  });

  // Document definition
  const docDefinition: TDocumentDefinitions = {
    content,
    styles: {
      header: {
        fontSize: 18,
        bold: true,
      },
      ombNumber: {
        fontSize: 9,
        color: "#6b7280",
      },
      subheader: {
        fontSize: 14,
        bold: true,
        alignment: "center",
      },
      productType: {
        fontSize: 11,
        alignment: "center",
        color: "#6b7280",
        italics: true,
      },
      infoLabel: {
        fontSize: 9,
        bold: true,
        alignment: "center",
      },
      infoValue: {
        fontSize: 10,
        alignment: "center",
      },
      sectionHeader: {
        fontSize: 11,
        bold: true,
        color: "#1f2937",
        decoration: "underline",
      },
      lineLabel: {
        fontSize: 10,
        margin: [0, 3, 0, 3],
      },
      lineLabelBold: {
        fontSize: 10,
        bold: true,
        margin: [0, 3, 0, 3],
      },
      lineValue: {
        fontSize: 10,
        alignment: "right",
        margin: [0, 3, 0, 3],
      },
      lineValueBold: {
        fontSize: 10,
        bold: true,
        alignment: "right",
        margin: [0, 3, 0, 3],
      },
      lineValueCredit: {
        fontSize: 10,
        alignment: "right",
        color: "#15803d",
        margin: [0, 3, 0, 3],
      },
      lineValueTax: {
        fontSize: 12,
        bold: true,
        alignment: "right",
        margin: [0, 5, 0, 5],
      },
      taxNote: {
        fontSize: 9,
        italics: true,
        color: "#6b7280",
      },
      reconHeader: {
        fontSize: 10,
        bold: true,
        alignment: "center",
      },
      reconValue: {
        fontSize: 11,
        bold: true,
        alignment: "center",
      },
      reconSubtext: {
        fontSize: 8,
        color: "#6b7280",
        alignment: "center",
      },
      reconStatus: {
        fontSize: 11,
        bold: true,
        alignment: "center",
      },
      footer: {
        fontSize: 8,
        color: "#9ca3af",
        alignment: "center",
      },
    },
    pageMargins: [40, 40, 40, 40],
    pageSize: "LETTER",
  };

  return docDefinition;
}

/**
 * Download the TTB Form PDF with a given filename
 */
export async function downloadTTBFormPDF(
  formData: TTBFormPDFData,
  periodLabel: string,
  filename: string
): Promise<void> {
  const pdfMake = await getPdfMake();
  const docDefinition = generateTTBFormPDF(formData, periodLabel);
  pdfMake.createPdf(docDefinition).download(filename);
}

/**
 * Open the TTB Form PDF in a new window/tab
 */
export async function openTTBFormPDF(
  formData: TTBFormPDFData,
  periodLabel: string
): Promise<void> {
  const pdfMake = await getPdfMake();
  const docDefinition = generateTTBFormPDF(formData, periodLabel);
  pdfMake.createPdf(docDefinition).open();
}
