/**
 * Vendor Performance Report CSV Export
 */
import {
  arrayToCSV,
  downloadCSV,
  formatDateForCSV,
  formatNumberForCSV,
} from "./exportHelpers";

interface VendorPerformanceData {
  summary: {
    totalVendors: number;
    totalOrders: number;
    totalValue: number;
    totalWeightKg: number;
    avgOrderValue: number;
  };
  vendors: Array<{
    vendorId: string;
    vendorName: string;
    orderCount: number;
    totalValue: number;
    totalWeightKg: number;
    avgOrderValue: number;
    avgWeightPerOrder: number;
    lastOrderDate: Date | string | null;
  }>;
}

/**
 * Export vendor performance data as CSV
 */
export function exportVendorPerformanceCSV(
  data: VendorPerformanceData,
  dateRange: { startDate: Date; endDate: Date }
): void {
  const vendorsCSV = arrayToCSV(
    data.vendors.map((vendor) => ({
      vendorName: vendor.vendorName,
      orderCount: String(vendor.orderCount),
      totalValue: formatNumberForCSV(vendor.totalValue, 2),
      totalWeightKg: formatNumberForCSV(vendor.totalWeightKg, 1),
      avgOrderValue: formatNumberForCSV(vendor.avgOrderValue, 2),
      avgWeightPerOrder: formatNumberForCSV(vendor.avgWeightPerOrder, 1),
      lastOrderDate: formatDateForCSV(vendor.lastOrderDate),
    })),
    [
      { key: "vendorName", header: "Vendor" },
      { key: "orderCount", header: "Orders" },
      { key: "totalValue", header: "Total Value ($)" },
      { key: "totalWeightKg", header: "Total Weight (kg)" },
      { key: "avgOrderValue", header: "Avg Order Value ($)" },
      { key: "avgWeightPerOrder", header: "Avg Weight/Order (kg)" },
      { key: "lastOrderDate", header: "Last Order" },
    ]
  );

  const summary = [
    "VENDOR PERFORMANCE REPORT",
    `Date Range: ${formatDateForCSV(dateRange.startDate)} to ${formatDateForCSV(dateRange.endDate)}`,
    "",
    "SUMMARY",
    `Active Vendors: ${data.summary.totalVendors}`,
    `Total Orders: ${data.summary.totalOrders}`,
    `Total Value: $${formatNumberForCSV(data.summary.totalValue, 2)}`,
    `Total Weight (kg): ${formatNumberForCSV(data.summary.totalWeightKg, 1)}`,
    `Average Order Value: $${formatNumberForCSV(data.summary.avgOrderValue, 2)}`,
    "",
    "VENDOR DETAILS",
    vendorsCSV,
  ].join("\n");

  const filename = `vendor-performance-${formatDateForCSV(dateRange.startDate)}-${formatDateForCSV(dateRange.endDate)}.csv`;
  downloadCSV(summary, filename);
}
