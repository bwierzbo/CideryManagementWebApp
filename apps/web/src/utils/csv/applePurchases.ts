/**
 * Apple Purchases Report CSV Export
 */
import {
  arrayToCSV,
  downloadCSV,
  formatDateForCSV,
  formatNumberForCSV,
} from "./exportHelpers";

interface ApplePurchasesData {
  vendors: Array<{
    vendorId: string;
    vendorName: string;
    items: Array<{
      varietyName: string;
      purchaseDate: Date | string;
      harvestDate: Date | string | null;
      quantity: number;
      unit: string;
      quantityKg: number | null;
      pricePerUnit: number | null;
      totalCost: number | null;
    }>;
    totalCost: number;
    totalWeightKg: number;
  }>;
  grandTotalCost: number;
  grandTotalWeightKg: number;
}

/**
 * Export apple purchases data as CSV
 */
export function exportApplePurchasesCSV(
  data: ApplePurchasesData,
  dateRange: { startDate: Date; endDate: Date },
  weightUnit: "kg" | "lbs" = "kg"
): void {
  // Convert weight if needed
  const convertWeight = (kg: number | null): string => {
    if (kg === null) return "";
    if (weightUnit === "lbs") {
      return formatNumberForCSV(kg * 2.20462, 2);
    }
    return formatNumberForCSV(kg, 2);
  };

  // Flatten all vendor items into a single array for CSV
  const allItems: Array<{
    vendorName: string;
    varietyName: string;
    purchaseDate: string;
    harvestDate: string;
    quantity: string;
    unit: string;
    weight: string;
    pricePerUnit: string;
    totalCost: string;
  }> = [];

  data.vendors.forEach((vendor) => {
    vendor.items.forEach((item) => {
      allItems.push({
        vendorName: vendor.vendorName,
        varietyName: item.varietyName,
        purchaseDate: formatDateForCSV(item.purchaseDate),
        harvestDate: formatDateForCSV(item.harvestDate),
        quantity: formatNumberForCSV(item.quantity, 2),
        unit: item.unit,
        weight: convertWeight(item.quantityKg),
        pricePerUnit: item.pricePerUnit ? formatNumberForCSV(item.pricePerUnit, 2) : "",
        totalCost: item.totalCost ? formatNumberForCSV(item.totalCost, 2) : "",
      });
    });
  });

  const itemsCSV = arrayToCSV(allItems, [
    { key: "vendorName", header: "Vendor" },
    { key: "varietyName", header: "Variety" },
    { key: "purchaseDate", header: "Purchase Date" },
    { key: "harvestDate", header: "Harvest Date" },
    { key: "quantity", header: "Quantity" },
    { key: "unit", header: "Unit" },
    { key: "weight", header: `Weight (${weightUnit})` },
    { key: "pricePerUnit", header: "Price/Unit ($)" },
    { key: "totalCost", header: "Total Cost ($)" },
  ]);

  // Vendor summary
  const vendorSummaryCSV = arrayToCSV(
    data.vendors.map((vendor) => ({
      vendorName: vendor.vendorName,
      itemCount: String(vendor.items.length),
      totalWeight: convertWeight(vendor.totalWeightKg),
      totalCost: formatNumberForCSV(vendor.totalCost, 2),
    })),
    [
      { key: "vendorName", header: "Vendor" },
      { key: "itemCount", header: "Purchases" },
      { key: "totalWeight", header: `Total Weight (${weightUnit})` },
      { key: "totalCost", header: "Total Cost ($)" },
    ]
  );

  const grandTotalWeight =
    weightUnit === "lbs"
      ? data.grandTotalWeightKg * 2.20462
      : data.grandTotalWeightKg;

  const summary = [
    "APPLE PURCHASES REPORT",
    `Date Range: ${formatDateForCSV(dateRange.startDate)} to ${formatDateForCSV(dateRange.endDate)}`,
    "",
    "SUMMARY",
    `Total Vendors: ${data.vendors.length}`,
    `Total Weight (${weightUnit}): ${formatNumberForCSV(grandTotalWeight, 2)}`,
    `Total Cost: $${formatNumberForCSV(data.grandTotalCost, 2)}`,
    "",
    "BY VENDOR",
    vendorSummaryCSV,
    "",
    "ALL PURCHASES",
    itemsCSV,
  ].join("\n");

  const filename = `apple-purchases-${formatDateForCSV(dateRange.startDate)}-${formatDateForCSV(dateRange.endDate)}.csv`;
  downloadCSV(summary, filename);
}
