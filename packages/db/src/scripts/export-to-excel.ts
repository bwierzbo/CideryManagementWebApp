/**
 * Database Data Export to Excel Script
 *
 * Exports all data from the database to an Excel file
 *
 * Usage: npx tsx src/scripts/export-to-excel.ts
 */

import { db } from "../index";
import * as schema from "../schema";
import * as XLSX from "xlsx";
import * as path from "path";

// Define the export directory
const EXPORT_DIR = path.join(__dirname, "../../data-exports");
const TIMESTAMP = new Date().toISOString().replace(/[:.]/g, "-").split("T")[0];
const EXPORT_FILENAME = `cidery-data-export-${TIMESTAMP}.xlsx`;
const EXPORT_PATH = path.join(EXPORT_DIR, EXPORT_FILENAME);

// Tables to export
const EXPORT_TABLES = [
  // Reference data
  { name: "Users", table: schema.users },
  { name: "Vendors", table: schema.vendors },
  { name: "Base Fruit Varieties", table: schema.baseFruitVarieties },
  { name: "Juice Varieties", table: schema.juiceVarieties },
  { name: "Additive Varieties", table: schema.additiveVarieties },
  { name: "Packaging Varieties", table: schema.packagingVarieties },
  { name: "Vendor Varieties", table: schema.vendorVarieties },
  { name: "Vendor Additive Varieties", table: schema.vendorAdditiveVarieties },
  { name: "Vendor Juice Varieties", table: schema.vendorJuiceVarieties },
  { name: "Vendor Packaging Varieties", table: schema.vendorPackagingVarieties },

  // Purchases
  { name: "Base Fruit Purchases", table: schema.basefruitPurchases },
  { name: "Base Fruit Purchase Items", table: schema.basefruitPurchaseItems },

  // Vessels
  { name: "Vessels", table: schema.vessels },

  // Press operations
  { name: "Press Runs", table: schema.pressRuns },
  { name: "Press Run Loads", table: schema.pressRunLoads },
  { name: "Juice Lots", table: schema.juiceLots },

  // Batches
  { name: "Batches", table: schema.batches },
  { name: "Batch Compositions", table: schema.batchCompositions },
  { name: "Batch Measurements", table: schema.batchMeasurements },
  { name: "Batch Additives", table: schema.batchAdditives },
  { name: "Batch Transfers", table: schema.batchTransfers },
  { name: "Batch Racking Operations", table: schema.batchRackingOperations },
  { name: "Batch Filter Operations", table: schema.batchFilterOperations },
  { name: "Batch Merge History", table: schema.batchMergeHistory },

  // Audit
  { name: "Audit Logs", table: schema.auditLogs },
];

async function exportToExcel() {
  console.log("📦 Starting Excel export...");
  console.log(`📁 Export file: ${EXPORT_PATH}`);

  // Create a new workbook
  const workbook = XLSX.utils.book_new();
  const stats: Record<string, number> = {};

  for (const { name, table } of EXPORT_TABLES) {
    try {
      console.log(`\n📊 Exporting ${name}...`);

      // Query all records from the table
      const records = await db.select().from(table);
      stats[name] = records.length;

      if (records.length === 0) {
        console.log(`  ⚠️  No records found in ${name}`);
        // Still add empty sheet
        const worksheet = XLSX.utils.json_to_sheet([]);
        XLSX.utils.book_append_sheet(workbook, worksheet, name.substring(0, 31));
        continue;
      }

      // Convert records to worksheet
      const worksheet = XLSX.utils.json_to_sheet(records);

      // Add worksheet to workbook (Excel sheet names limited to 31 chars)
      const sheetName = name.substring(0, 31);
      XLSX.utils.book_append_sheet(workbook, worksheet, sheetName);

      console.log(`  ✅ Exported ${records.length} records`);
    } catch (error) {
      console.error(`  ❌ Error exporting ${name}:`, error);
    }
  }

  // Create summary sheet
  const summaryData = [
    { Table: "Export Summary", Records: "" },
    { Table: "Generated", Records: new Date().toISOString() },
    { Table: "", Records: "" },
    ...Object.entries(stats).map(([table, count]) => ({
      Table: table,
      Records: count,
    })),
  ];
  const summarySheet = XLSX.utils.json_to_sheet(summaryData);
  XLSX.utils.book_append_sheet(workbook, summarySheet, "Summary");

  // Write the workbook to file
  XLSX.writeFile(workbook, EXPORT_PATH);

  console.log("\n✅ Export complete!");
  console.log(`\n📁 Exported data to: ${EXPORT_PATH}`);
  console.log("\nSummary:");
  for (const [table, count] of Object.entries(stats)) {
    console.log(`  ${table}: ${count} records`);
  }

  const totalRecords = Object.values(stats).reduce((a, b) => a + b, 0);
  console.log(`\n📊 Total: ${totalRecords} records across ${Object.keys(stats).length} tables`);
}

// Run the export
exportToExcel()
  .then(() => {
    console.log("\n✅ Done!");
    process.exit(0);
  })
  .catch((error) => {
    console.error("\n❌ Export failed:", error);
    process.exit(1);
  });
