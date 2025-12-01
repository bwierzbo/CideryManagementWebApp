/**
 * PDF generation utility for Sales Report
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
 * Sales Report PDF Data interface
 */
export interface SalesReportPDFData {
  period: {
    startDate: string;
    endDate: string;
    label: string;
  };
  summary: {
    totalRevenue: number;
    totalUnits: number;
    avgOrderValue: number;
    totalVolumeLiters: number;
    transactionCount: number;
    changes?: {
      revenue: number;
      units: number;
      volume: number;
    };
  };
  channels: Array<{
    channelName: string;
    revenue: number;
    units: number;
    volumeLiters: number;
    percentOfTotal: number;
  }>;
  products: Array<{
    productName: string;
    packageType: string | null;
    packageSizeML: number | null;
    revenue: number;
    units: number;
    avgPrice: number;
  }>;
  margins?: {
    products: Array<{
      productName: string;
      revenue: number;
      units: number;
      cogs: number;
      grossProfit: number;
      marginPercent: number;
    }>;
    totals: {
      revenue: number;
      cogs: number;
      grossProfit: number;
      marginPercent: number;
    };
  };
}

/**
 * Format a number as currency
 */
function formatCurrency(value: number): string {
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "USD",
    minimumFractionDigits: 0,
    maximumFractionDigits: 0,
  }).format(value);
}

/**
 * Format a number with commas
 */
function formatNumber(value: number): string {
  return new Intl.NumberFormat("en-US").format(value);
}

/**
 * Format percentage change
 */
function formatChange(value: number): string {
  const sign = value >= 0 ? "+" : "";
  return `${sign}${value.toFixed(1)}%`;
}

/**
 * Generate PDF document for Sales Report
 */
export function generateSalesReportPDF(
  data: SalesReportPDFData
): TDocumentDefinitions {
  const content: Content[] = [];

  // Header
  content.push({
    columns: [
      {
        text: "Sales Report",
        style: "header",
        width: "*",
      },
      {
        text: data.period.label,
        style: "periodLabel",
        width: "auto",
        alignment: "right",
      },
    ],
    margin: [0, 0, 0, 5],
  });

  content.push({
    text: `${data.period.startDate} - ${data.period.endDate}`,
    style: "dateRange",
    margin: [0, 0, 0, 20],
  });

  // Summary KPIs
  content.push({
    text: "SUMMARY",
    style: "sectionHeader",
    margin: [0, 0, 0, 10],
  });

  const kpiRow = [
    [
      { text: "Total Revenue", style: "kpiLabel" },
      { text: "Units Sold", style: "kpiLabel" },
      { text: "Avg Order Value", style: "kpiLabel" },
      { text: "Volume (L)", style: "kpiLabel" },
    ],
    [
      { text: formatCurrency(data.summary.totalRevenue), style: "kpiValue" },
      { text: formatNumber(data.summary.totalUnits), style: "kpiValue" },
      { text: formatCurrency(data.summary.avgOrderValue), style: "kpiValue" },
      {
        text: formatNumber(Math.round(data.summary.totalVolumeLiters)),
        style: "kpiValue",
      },
    ],
  ];

  if (data.summary.changes) {
    kpiRow.push([
      {
        text: formatChange(data.summary.changes.revenue),
        style:
          data.summary.changes.revenue >= 0 ? "kpiChangeUp" : "kpiChangeDown",
      },
      {
        text: formatChange(data.summary.changes.units),
        style:
          data.summary.changes.units >= 0 ? "kpiChangeUp" : "kpiChangeDown",
      },
      { text: "-", style: "kpiChange" },
      {
        text: formatChange(data.summary.changes.volume),
        style:
          data.summary.changes.volume >= 0 ? "kpiChangeUp" : "kpiChangeDown",
      },
    ]);
  }

  content.push({
    table: {
      widths: ["*", "*", "*", "*"],
      body: kpiRow,
    },
    layout: {
      fillColor: (rowIndex: number) => (rowIndex === 0 ? "#f3f4f6" : null),
      hLineWidth: () => 0.5,
      vLineWidth: () => 0.5,
    },
    margin: [0, 0, 0, 20],
  });

  // Sales by Channel
  content.push({
    text: "SALES BY CHANNEL",
    style: "sectionHeader",
    margin: [0, 10, 0, 10],
  });

  const channelRows: any[][] = [
    [
      { text: "Channel", style: "tableHeader" },
      { text: "Revenue", style: "tableHeader" },
      { text: "Units", style: "tableHeader" },
      { text: "Volume (L)", style: "tableHeader" },
      { text: "% of Total", style: "tableHeader" },
    ],
  ];

  data.channels
    .filter((c) => c.revenue > 0)
    .forEach((channel) => {
      channelRows.push([
        { text: channel.channelName, style: "tableCell" },
        {
          text: formatCurrency(channel.revenue),
          style: "tableCellRight",
        },
        { text: formatNumber(channel.units), style: "tableCellRight" },
        {
          text: formatNumber(Math.round(channel.volumeLiters)),
          style: "tableCellRight",
        },
        {
          text: `${channel.percentOfTotal.toFixed(1)}%`,
          style: "tableCellRight",
        },
      ]);
    });

  // Add total row
  const totalRevenue = data.channels.reduce((sum, c) => sum + c.revenue, 0);
  const totalUnits = data.channels.reduce((sum, c) => sum + c.units, 0);
  const totalVolume = data.channels.reduce((sum, c) => sum + c.volumeLiters, 0);

  channelRows.push([
    { text: "Total", style: "tableCellBold" },
    { text: formatCurrency(totalRevenue), style: "tableCellRightBold" },
    { text: formatNumber(totalUnits), style: "tableCellRightBold" },
    { text: formatNumber(Math.round(totalVolume)), style: "tableCellRightBold" },
    { text: "100%", style: "tableCellRightBold" },
  ]);

  content.push({
    table: {
      headerRows: 1,
      widths: ["*", 80, 60, 70, 70],
      body: channelRows,
    },
    layout: {
      fillColor: (rowIndex: number) => {
        if (rowIndex === 0) return "#f3f4f6";
        if (rowIndex === channelRows.length - 1) return "#e5e7eb";
        return null;
      },
      hLineWidth: () => 0.5,
      vLineWidth: () => 0.5,
    },
    margin: [0, 0, 0, 20],
  });

  // Top Products
  if (data.products.length > 0) {
    content.push({
      text: "TOP PRODUCTS",
      style: "sectionHeader",
      margin: [0, 10, 0, 10],
    });

    const productRows: any[][] = [
      [
        { text: "#", style: "tableHeader" },
        { text: "Product", style: "tableHeader" },
        { text: "Package", style: "tableHeader" },
        { text: "Units", style: "tableHeader" },
        { text: "Avg Price", style: "tableHeader" },
        { text: "Revenue", style: "tableHeader" },
      ],
    ];

    data.products.slice(0, 10).forEach((product, index) => {
      productRows.push([
        { text: `${index + 1}`, style: "tableCellCenter" },
        {
          text:
            product.productName.length > 25
              ? product.productName.slice(0, 25) + "..."
              : product.productName,
          style: "tableCell",
        },
        {
          text:
            product.packageType && product.packageSizeML
              ? `${product.packageType} ${product.packageSizeML}ml`
              : "-",
          style: "tableCell",
        },
        { text: formatNumber(product.units), style: "tableCellRight" },
        { text: formatCurrency(product.avgPrice), style: "tableCellRight" },
        { text: formatCurrency(product.revenue), style: "tableCellRightBold" },
      ]);
    });

    content.push({
      table: {
        headerRows: 1,
        widths: [25, "*", 80, 50, 70, 80],
        body: productRows,
      },
      layout: {
        fillColor: (rowIndex: number) => (rowIndex === 0 ? "#f3f4f6" : null),
        hLineWidth: () => 0.5,
        vLineWidth: () => 0.5,
      },
      margin: [0, 0, 0, 20],
    });
  }

  // Margins Analysis (if available)
  if (data.margins && data.margins.products.length > 0) {
    content.push({ text: "", pageBreak: "before" });

    content.push({
      text: "MARGIN ANALYSIS",
      style: "sectionHeader",
      margin: [0, 0, 0, 10],
    });

    // Margin summary
    content.push({
      table: {
        widths: ["*", "*", "*", "*"],
        body: [
          [
            { text: "Total Revenue", style: "kpiLabel" },
            { text: "Total COGS", style: "kpiLabel" },
            { text: "Gross Profit", style: "kpiLabel" },
            { text: "Gross Margin", style: "kpiLabel" },
          ],
          [
            {
              text: formatCurrency(data.margins.totals.revenue),
              style: "kpiValueGreen",
            },
            {
              text: formatCurrency(data.margins.totals.cogs),
              style: "kpiValueRed",
            },
            {
              text: formatCurrency(data.margins.totals.grossProfit),
              style: "kpiValueBlue",
            },
            {
              text: `${data.margins.totals.marginPercent.toFixed(1)}%`,
              style: "kpiValue",
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

    // Margin details table
    const marginRows: any[][] = [
      [
        { text: "Product", style: "tableHeader" },
        { text: "Units", style: "tableHeader" },
        { text: "Revenue", style: "tableHeader" },
        { text: "COGS", style: "tableHeader" },
        { text: "Profit", style: "tableHeader" },
        { text: "Margin", style: "tableHeader" },
      ],
    ];

    data.margins.products.slice(0, 15).forEach((product) => {
      marginRows.push([
        {
          text:
            product.productName.length > 20
              ? product.productName.slice(0, 20) + "..."
              : product.productName,
          style: "tableCell",
        },
        { text: formatNumber(product.units), style: "tableCellRight" },
        { text: formatCurrency(product.revenue), style: "tableCellRight" },
        { text: formatCurrency(product.cogs), style: "tableCellRight" },
        { text: formatCurrency(product.grossProfit), style: "tableCellRight" },
        {
          text: `${product.marginPercent.toFixed(1)}%`,
          style: "tableCellRight",
          color:
            product.marginPercent >= 40
              ? "#15803d"
              : product.marginPercent < 20
                ? "#dc2626"
                : "#000000",
        },
      ]);
    });

    content.push({
      table: {
        headerRows: 1,
        widths: ["*", 45, 70, 65, 65, 50],
        body: marginRows,
      },
      layout: {
        fillColor: (rowIndex: number) => (rowIndex === 0 ? "#f3f4f6" : null),
        hLineWidth: () => 0.5,
        vLineWidth: () => 0.5,
      },
      margin: [0, 0, 0, 20],
    });
  }

  // Footer
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
        fontSize: 20,
        bold: true,
        color: "#1f2937",
      },
      periodLabel: {
        fontSize: 14,
        bold: true,
        color: "#059669",
      },
      dateRange: {
        fontSize: 11,
        color: "#6b7280",
      },
      sectionHeader: {
        fontSize: 12,
        bold: true,
        color: "#1f2937",
        decoration: "underline",
      },
      kpiLabel: {
        fontSize: 9,
        bold: true,
        alignment: "center",
        color: "#6b7280",
      },
      kpiValue: {
        fontSize: 14,
        bold: true,
        alignment: "center",
      },
      kpiValueGreen: {
        fontSize: 14,
        bold: true,
        alignment: "center",
        color: "#059669",
      },
      kpiValueRed: {
        fontSize: 14,
        bold: true,
        alignment: "center",
        color: "#dc2626",
      },
      kpiValueBlue: {
        fontSize: 14,
        bold: true,
        alignment: "center",
        color: "#2563eb",
      },
      kpiChange: {
        fontSize: 9,
        alignment: "center",
        color: "#6b7280",
      },
      kpiChangeUp: {
        fontSize: 9,
        alignment: "center",
        color: "#059669",
      },
      kpiChangeDown: {
        fontSize: 9,
        alignment: "center",
        color: "#dc2626",
      },
      tableHeader: {
        fontSize: 9,
        bold: true,
        alignment: "center",
        margin: [0, 4, 0, 4],
      },
      tableCell: {
        fontSize: 9,
        margin: [0, 3, 0, 3],
      },
      tableCellBold: {
        fontSize: 9,
        bold: true,
        margin: [0, 3, 0, 3],
      },
      tableCellCenter: {
        fontSize: 9,
        alignment: "center",
        margin: [0, 3, 0, 3],
      },
      tableCellRight: {
        fontSize: 9,
        alignment: "right",
        margin: [0, 3, 0, 3],
      },
      tableCellRightBold: {
        fontSize: 9,
        bold: true,
        alignment: "right",
        margin: [0, 3, 0, 3],
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
 * Download the Sales Report PDF with a given filename
 */
export async function downloadSalesReportPDF(
  data: SalesReportPDFData,
  filename: string
): Promise<void> {
  const pdfMake = await getPdfMake();
  const docDefinition = generateSalesReportPDF(data);
  pdfMake.createPdf(docDefinition).download(filename);
}

/**
 * Open the Sales Report PDF in a new window/tab
 */
export async function openSalesReportPDF(
  data: SalesReportPDFData
): Promise<void> {
  const pdfMake = await getPdfMake();
  const docDefinition = generateSalesReportPDF(data);
  pdfMake.createPdf(docDefinition).open();
}
