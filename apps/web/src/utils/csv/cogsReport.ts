/**
 * COGS Analysis Report CSV Export
 */
import {
  arrayToCSV,
  downloadCSV,
  formatNumberForCSV,
} from "./exportHelpers";

interface COGSData {
  batchName: string;
  appleVariety: string;
  targetVolume: number;
  fruitCost: number;
  packagingCost: number;
  laborCost: number;
  totalCost: number;
  costPerBottle: number;
}

/**
 * Export COGS analysis data as CSV
 */
export function exportCOGSAnalysisCSV(data: COGSData[]): void {
  // Calculate totals
  const totalFruitCost = data.reduce((sum, b) => sum + b.fruitCost, 0);
  const totalPackagingCost = data.reduce((sum, b) => sum + b.packagingCost, 0);
  const totalLaborCost = data.reduce((sum, b) => sum + b.laborCost, 0);
  const totalCost = data.reduce((sum, b) => sum + b.totalCost, 0);
  const avgCostPerBottle =
    data.length > 0
      ? data.reduce((sum, b) => sum + b.costPerBottle, 0) / data.length
      : 0;

  const batchesCSV = arrayToCSV(
    data.map((batch) => ({
      batchName: batch.batchName,
      appleVariety: batch.appleVariety,
      targetVolume: formatNumberForCSV(batch.targetVolume, 0),
      fruitCost: formatNumberForCSV(batch.fruitCost, 2),
      packagingCost: formatNumberForCSV(batch.packagingCost, 2),
      laborCost: formatNumberForCSV(batch.laborCost, 2),
      totalCost: formatNumberForCSV(batch.totalCost, 2),
      costPerBottle: formatNumberForCSV(batch.costPerBottle, 2),
    })),
    [
      { key: "batchName", header: "Batch" },
      { key: "appleVariety", header: "Apple Variety" },
      { key: "targetVolume", header: "Target Volume" },
      { key: "fruitCost", header: "Fruit Cost ($)" },
      { key: "packagingCost", header: "Packaging Cost ($)" },
      { key: "laborCost", header: "Labor Cost ($)" },
      { key: "totalCost", header: "Total Cost ($)" },
      { key: "costPerBottle", header: "Cost/Bottle ($)" },
    ]
  );

  const summary = [
    "COGS ANALYSIS REPORT",
    "",
    "SUMMARY",
    `Total Batches: ${data.length}`,
    `Total Fruit Cost: $${formatNumberForCSV(totalFruitCost, 2)}`,
    `Total Packaging Cost: $${formatNumberForCSV(totalPackagingCost, 2)}`,
    `Total Labor Cost: $${formatNumberForCSV(totalLaborCost, 2)}`,
    `Total Production Cost: $${formatNumberForCSV(totalCost, 2)}`,
    `Average Cost/Bottle: $${formatNumberForCSV(avgCostPerBottle, 2)}`,
    "",
    "BATCH DETAILS",
    batchesCSV,
  ].join("\n");

  const filename = `cogs-analysis-${new Date().toISOString().split("T")[0]}.csv`;
  downloadCSV(summary, filename);
}
