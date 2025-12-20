/**
 * PDF generation utility for Vendor Apple Purchase Reports
 */

import type { TDocumentDefinitions, Content } from "pdfmake/interfaces";
import { formatDate as formatDateUtil } from "@/utils/date-format";

// Lazy import pdfMake to avoid SSR issues
const getPdfMake = async () => {
  const pdfMake = await import("pdfmake/build/pdfmake");
  const pdfFonts = await import("pdfmake/build/vfs_fonts");
  (pdfMake.default as any).vfs = pdfFonts.default;
  return pdfMake.default;
};

/**
 * Data structure for a single apple purchase item
 */
export interface ApplePurchaseItem {
  varietyName: string;
  purchaseDate: Date;
  harvestDate: Date | null;
  quantity: number;
  unit: string;
  quantityKg: number | null;
  pricePerUnit: number | null;
  totalCost: number | null;
  notes: string | null;
}

/**
 * Data structure for vendor purchases
 */
export interface VendorPurchaseData {
  vendorId: string;
  vendorName: string;
  items: ApplePurchaseItem[];
  totalCost: number;
  totalWeightKg: number;
}

/**
 * Complete report data structure
 */
export interface VendorAppleReportData {
  vendors: VendorPurchaseData[];
  grandTotalCost: number;
  grandTotalWeightKg: number;
  dateRange: {
    startDate: Date;
    endDate: Date;
    label: string;
  };
}

/**
 * Format a number as currency
 */
function formatCurrency(value: number | null): string {
  if (value === null || value === undefined) return "N/A";
  return `$${value.toFixed(2)}`;
}

/**
 * Format a number with thousand separators
 */
function formatNumber(value: number | null, decimals: number = 2): string {
  if (value === null || value === undefined) return "N/A";
  return value.toLocaleString("en-US", {
    minimumFractionDigits: decimals,
    maximumFractionDigits: decimals,
  });
}

/**
 * Format a date as MM/DD/YYYY using centralized utility
 */
function formatDate(date: Date | null): string {
  if (!date) return "N/A";
  return formatDateUtil(date);
}

/**
 * Convert weight from kg to target unit
 */
function convertWeight(kg: number, targetUnit: "kg" | "lbs"): number {
  if (targetUnit === "lbs") {
    return kg * 2.20462; // 1 kg = 2.20462 lbs
  }
  return kg;
}

/**
 * Generate PDF document for Vendor Apple Purchase Report
 */
export function generateVendorApplePDF(
  reportData: VendorAppleReportData,
  weightUnit: "kg" | "lbs" = "kg",
): TDocumentDefinitions {
  const { vendors, grandTotalCost, grandTotalWeightKg, dateRange } = reportData;

  // Build content sections
  const content: Content[] = [];

  // Header
  content.push({
    text: "Vendor Apple Purchase Report",
    style: "header",
    margin: [0, 0, 0, 10],
  });

  content.push({
    text: `Period: ${dateRange.label}`,
    style: "subheader",
    margin: [0, 0, 0, 5],
  });

  content.push({
    text: `Generated: ${formatDate(new Date())}`,
    style: "dateInfo",
    margin: [0, 0, 0, 20],
  });

  // Summary Section
  content.push({
    text: "Summary",
    style: "sectionHeader",
    margin: [0, 10, 0, 10],
  });

  content.push({
    table: {
      widths: ["*", "*", "*"],
      body: [
        [
          { text: "Total Vendors", style: "tableHeader" },
          { text: `Total Weight (${weightUnit})`, style: "tableHeader" },
          { text: "Total Cost", style: "tableHeader" },
        ],
        [
          { text: vendors.length.toString(), style: "tableCell" },
          {
            text: formatNumber(convertWeight(grandTotalWeightKg, weightUnit)),
            style: "tableCell",
          },
          { text: formatCurrency(grandTotalCost), style: "tableCell" },
        ],
      ],
    },
    layout: {
      fillColor: (rowIndex: number) => {
        return rowIndex === 0 ? "#f3f4f6" : null;
      },
    },
    margin: [0, 0, 0, 20],
  });

  // Vendor Sections
  vendors.forEach((vendor, vendorIndex) => {
    // Vendor header
    content.push({
      text: vendor.vendorName,
      style: "vendorHeader",
      margin: [0, vendorIndex > 0 ? 20 : 0, 0, 10],
    });

    // Vendor items table
    const tableBody: any[][] = [
      [
        { text: "Variety", style: "tableHeader" },
        { text: "Purchase Date", style: "tableHeader" },
        { text: "Harvest Date", style: "tableHeader" },
        { text: "Quantity", style: "tableHeader" },
        { text: `Weight (${weightUnit})`, style: "tableHeader" },
        { text: "Price/Unit", style: "tableHeader" },
        { text: "Total Cost", style: "tableHeader" },
      ],
    ];

    vendor.items.forEach((item) => {
      tableBody.push([
        { text: item.varietyName, style: "tableCell" },
        { text: formatDate(item.purchaseDate), style: "tableCell" },
        { text: formatDate(item.harvestDate), style: "tableCell" },
        {
          text: `${formatNumber(item.quantity, 2)} ${item.unit}`,
          style: "tableCell",
        },
        {
          text: item.quantityKg
            ? formatNumber(convertWeight(item.quantityKg, weightUnit))
            : "N/A",
          style: "tableCell",
        },
        { text: formatCurrency(item.pricePerUnit ?? 0), style: "tableCell" },
        { text: formatCurrency(item.totalCost ?? 0), style: "tableCell" },
      ]);
    });

    // Vendor subtotal row
    tableBody.push([
      { text: "Vendor Total", style: "subtotalLabel", colSpan: 4 },
      {},
      {},
      {},
      {
        text: formatNumber(convertWeight(vendor.totalWeightKg, weightUnit)),
        style: "subtotalValue",
      },
      {},
      { text: formatCurrency(vendor.totalCost), style: "subtotalValue" },
    ]);

    content.push({
      table: {
        headerRows: 1,
        widths: ["*", "auto", "auto", "auto", "auto", "auto", "auto"],
        body: tableBody,
      },
      layout: {
        fillColor: (rowIndex: number, node: any) => {
          if (rowIndex === 0) return "#f3f4f6"; // Header
          if (rowIndex === node.table.body.length - 1) return "#e5e7eb"; // Subtotal
          return null;
        },
        hLineWidth: (i: number, node: any) => {
          return i === 0 || i === node.table.body.length ? 1 : 0.5;
        },
        vLineWidth: () => 0,
      },
      margin: [0, 0, 0, 10],
    });

    // Add notes if any items have them
    const itemsWithNotes = vendor.items.filter((item) => item.notes);
    if (itemsWithNotes.length > 0) {
      content.push({
        text: "Notes:",
        style: "notesHeader",
        margin: [0, 5, 0, 5],
      });

      itemsWithNotes.forEach((item) => {
        content.push({
          text: `• ${item.varietyName}: ${item.notes}`,
          style: "notesText",
          margin: [10, 0, 0, 3],
        });
      });
    }
  });

  // Grand Total Footer
  content.push({
    table: {
      widths: ["*", "auto", "auto"],
      body: [
        [
          { text: "Grand Total", style: "grandTotalLabel" },
          {
            text: formatNumber(convertWeight(grandTotalWeightKg, weightUnit)),
            style: "grandTotalValue",
          },
          { text: formatCurrency(grandTotalCost), style: "grandTotalValue" },
        ],
      ],
    },
    layout: {
      fillColor: "#1f2937",
      hLineWidth: () => 0,
      vLineWidth: () => 0,
    },
    margin: [0, 20, 0, 0],
  });

  // Document definition
  const docDefinition: TDocumentDefinitions = {
    content,
    styles: {
      header: {
        fontSize: 20,
        bold: true,
        alignment: "center",
      },
      subheader: {
        fontSize: 14,
        alignment: "center",
        color: "#4b5563",
      },
      dateInfo: {
        fontSize: 10,
        alignment: "center",
        color: "#6b7280",
      },
      sectionHeader: {
        fontSize: 16,
        bold: true,
        color: "#1f2937",
      },
      vendorHeader: {
        fontSize: 14,
        bold: true,
        color: "#1f2937",
      },
      tableHeader: {
        fontSize: 10,
        bold: true,
        alignment: "center",
        color: "#1f2937",
      },
      tableCell: {
        fontSize: 9,
        alignment: "center",
      },
      subtotalLabel: {
        fontSize: 10,
        bold: true,
        alignment: "right",
      },
      subtotalValue: {
        fontSize: 10,
        bold: true,
        alignment: "center",
      },
      grandTotalLabel: {
        fontSize: 12,
        bold: true,
        alignment: "right",
        color: "white",
      },
      grandTotalValue: {
        fontSize: 12,
        bold: true,
        alignment: "center",
        color: "white",
      },
      notesHeader: {
        fontSize: 10,
        bold: true,
        italics: true,
        color: "#6b7280",
      },
      notesText: {
        fontSize: 9,
        italics: true,
        color: "#6b7280",
      },
    },
    pageMargins: [40, 40, 40, 40],
    pageSize: "LETTER",
    pageOrientation: "landscape",
  };

  return docDefinition;
}

/**
 * Download the PDF with a given filename
 */
export async function downloadVendorApplePDF(
  reportData: VendorAppleReportData,
  filename: string,
  weightUnit: "kg" | "lbs" = "kg",
): Promise<void> {
  const pdfMake = await getPdfMake();
  const docDefinition = generateVendorApplePDF(reportData, weightUnit);
  pdfMake.createPdf(docDefinition).download(filename);
}

/**
 * Open the PDF in a new window/tab
 */
export async function openVendorApplePDF(
  reportData: VendorAppleReportData,
  weightUnit: "kg" | "lbs" = "kg",
): Promise<void> {
  const pdfMake = await getPdfMake();
  const docDefinition = generateVendorApplePDF(reportData, weightUnit);
  pdfMake.createPdf(docDefinition).open();
}
