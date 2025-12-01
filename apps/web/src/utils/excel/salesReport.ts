/**
 * Excel generation utility for Sales Report
 */

import type { SalesReportPDFData } from "../pdf/salesReport";

// Re-export the type for convenience
export type { SalesReportPDFData as SalesReportExcelData };

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
    minimumFractionDigits: 0,
    maximumFractionDigits: 0,
  }).format(value);
}

/**
 * Format percentage change
 */
function formatChange(value: number): string {
  const sign = value >= 0 ? "+" : "";
  return `${sign}${value.toFixed(1)}%`;
}

/**
 * Generate Excel workbook for Sales Report
 */
export async function generateSalesReportExcel(data: SalesReportPDFData) {
  const XLSX = await getXlsx();

  // Create workbook
  const workbook = XLSX.utils.book_new();

  // Summary Sheet
  const summaryData: (string | number)[][] = [
    ["SALES REPORT"],
    [],
    ["Period", data.period.label],
    ["Date Range", `${data.period.startDate} - ${data.period.endDate}`],
    [],
    ["SUMMARY METRICS"],
    ["Metric", "Value", "Change vs Prior Period"],
    [
      "Total Revenue",
      data.summary.totalRevenue,
      data.summary.changes ? formatChange(data.summary.changes.revenue) : "-",
    ],
    [
      "Units Sold",
      data.summary.totalUnits,
      data.summary.changes ? formatChange(data.summary.changes.units) : "-",
    ],
    ["Average Order Value", data.summary.avgOrderValue, "-"],
    [
      "Volume (Liters)",
      Math.round(data.summary.totalVolumeLiters),
      data.summary.changes ? formatChange(data.summary.changes.volume) : "-",
    ],
    ["Transaction Count", data.summary.transactionCount, "-"],
    [],
    ["Report generated:", new Date().toLocaleString("en-US")],
  ];

  const summarySheet = XLSX.utils.aoa_to_sheet(summaryData);

  // Set column widths for summary
  summarySheet["!cols"] = [{ wch: 25 }, { wch: 20 }, { wch: 25 }];

  XLSX.utils.book_append_sheet(workbook, summarySheet, "Summary");

  // Sales by Channel Sheet
  const channelData: (string | number)[][] = [
    ["SALES BY CHANNEL"],
    [],
    ["Channel", "Revenue", "Units", "Volume (L)", "% of Total"],
  ];

  data.channels
    .filter((c) => c.revenue > 0)
    .forEach((channel) => {
      channelData.push([
        channel.channelName,
        channel.revenue,
        channel.units,
        Math.round(channel.volumeLiters),
        `${channel.percentOfTotal.toFixed(1)}%`,
      ]);
    });

  // Add total row
  const totalRevenue = data.channels.reduce((sum, c) => sum + c.revenue, 0);
  const totalUnits = data.channels.reduce((sum, c) => sum + c.units, 0);
  const totalVolume = data.channels.reduce((sum, c) => sum + c.volumeLiters, 0);

  channelData.push([]);
  channelData.push(["TOTAL", totalRevenue, totalUnits, Math.round(totalVolume), "100%"]);

  const channelSheet = XLSX.utils.aoa_to_sheet(channelData);

  // Set column widths for channels
  channelSheet["!cols"] = [
    { wch: 25 },
    { wch: 15 },
    { wch: 12 },
    { wch: 12 },
    { wch: 12 },
  ];

  XLSX.utils.book_append_sheet(workbook, channelSheet, "By Channel");

  // Products Sheet
  if (data.products.length > 0) {
    const productData: (string | number | null)[][] = [
      ["TOP PRODUCTS"],
      [],
      ["#", "Product Name", "Package Type", "Package Size (ml)", "Units", "Avg Price", "Revenue"],
    ];

    data.products.forEach((product, index) => {
      productData.push([
        index + 1,
        product.productName,
        product.packageType,
        product.packageSizeML,
        product.units,
        product.avgPrice,
        product.revenue,
      ]);
    });

    // Add total row
    const prodTotalUnits = data.products.reduce((sum, p) => sum + p.units, 0);
    const prodTotalRevenue = data.products.reduce((sum, p) => sum + p.revenue, 0);

    productData.push([]);
    productData.push(["", "TOTAL", "", "", prodTotalUnits, "", prodTotalRevenue]);

    const productSheet = XLSX.utils.aoa_to_sheet(productData);

    // Set column widths for products
    productSheet["!cols"] = [
      { wch: 5 },
      { wch: 35 },
      { wch: 12 },
      { wch: 15 },
      { wch: 10 },
      { wch: 12 },
      { wch: 12 },
    ];

    XLSX.utils.book_append_sheet(workbook, productSheet, "Products");
  }

  // Margins Sheet (if available)
  if (data.margins && data.margins.products.length > 0) {
    const marginData: (string | number)[][] = [
      ["MARGIN ANALYSIS"],
      [],
      ["SUMMARY"],
      ["Metric", "Value"],
      ["Total Revenue", data.margins.totals.revenue],
      ["Total COGS", data.margins.totals.cogs],
      ["Gross Profit", data.margins.totals.grossProfit],
      ["Gross Margin %", `${data.margins.totals.marginPercent.toFixed(1)}%`],
      [],
      ["MARGIN BY PRODUCT"],
      ["Product", "Units", "Revenue", "COGS", "Gross Profit", "Margin %"],
    ];

    data.margins.products.forEach((product) => {
      marginData.push([
        product.productName,
        product.units,
        product.revenue,
        product.cogs,
        product.grossProfit,
        `${product.marginPercent.toFixed(1)}%`,
      ]);
    });

    // Add total row
    const marginTotalUnits = data.margins.products.reduce(
      (sum, p) => sum + p.units,
      0
    );

    marginData.push([]);
    marginData.push([
      "TOTAL",
      marginTotalUnits,
      data.margins.totals.revenue,
      data.margins.totals.cogs,
      data.margins.totals.grossProfit,
      `${data.margins.totals.marginPercent.toFixed(1)}%`,
    ]);

    const marginSheet = XLSX.utils.aoa_to_sheet(marginData);

    // Set column widths for margins
    marginSheet["!cols"] = [
      { wch: 35 },
      { wch: 10 },
      { wch: 12 },
      { wch: 12 },
      { wch: 12 },
      { wch: 10 },
    ];

    XLSX.utils.book_append_sheet(workbook, marginSheet, "Margins");
  }

  return workbook;
}

/**
 * Download the Sales Report Excel with a given filename
 */
export async function downloadSalesReportExcel(
  data: SalesReportPDFData,
  filename: string
): Promise<void> {
  const XLSX = await getXlsx();
  const workbook = await generateSalesReportExcel(data);
  XLSX.writeFile(workbook, filename);
}
