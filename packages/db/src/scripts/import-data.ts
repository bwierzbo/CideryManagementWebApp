/**
 * Database Data Import Script
 *
 * Imports data from TypeScript export files back into the database.
 * Handles schema changes gracefully by validating against current schema.
 *
 * Usage:
 *   npx tsx src/scripts/import-data.ts <export-folder-name>
 *   npx tsx src/scripts/import-data.ts 2025-01-15
 *   npx tsx src/scripts/import-data.ts 2025-01-15 --tables users,vendors
 *   npx tsx src/scripts/import-data.ts 2025-01-15 --skip-existing
 */

import { db } from "../index";
import * as schema from "../schema";
import * as fs from "fs";
import * as path from "path";
import { sql } from "drizzle-orm";

// Parse command line arguments
const args = process.argv.slice(2);
const exportFolder = args[0];
const flagIndex = args.findIndex((arg) => arg.startsWith("--"));
const flags = flagIndex >= 0 ? args.slice(flagIndex) : [];

const options = {
  tables: flags.find((f) => f.startsWith("--tables="))?.split("=")[1]?.split(","),
  skipExisting: flags.includes("--skip-existing"),
  dryRun: flags.includes("--dry-run"),
  truncate: flags.includes("--truncate"),
};

if (!exportFolder) {
  console.error("❌ Error: Please provide the export folder name");
  console.log("\nUsage:");
  console.log("  npx tsx src/scripts/import-data.ts <export-folder>");
  console.log("\nOptions:");
  console.log("  --tables=table1,table2    Import only specific tables");
  console.log("  --skip-existing           Skip records that already exist");
  console.log("  --dry-run                 Preview without making changes");
  console.log("  --truncate                DANGEROUS: Delete all data before import");
  process.exit(1);
}

const EXPORT_DIR = path.join(__dirname, "../../data-exports");
const IMPORT_PATH = path.join(EXPORT_DIR, exportFolder);

// Tables in dependency order
const IMPORT_TABLES = [
  { name: "users", table: schema.users },
  { name: "vendors", table: schema.vendors },
  { name: "baseFruitVarieties", table: schema.baseFruitVarieties },
  { name: "juiceVarieties", table: schema.juiceVarieties },
  { name: "basefruitPurchases", table: schema.basefruitPurchases },
  { name: "basefruitPurchaseItems", table: schema.basefruitPurchaseItems },
  { name: "juicePurchases", table: schema.juicePurchases },
  { name: "juicePurchaseItems", table: schema.juicePurchaseItems },
  { name: "additivePurchases", table: schema.additivePurchases },
  { name: "additivePurchaseItems", table: schema.additivePurchaseItems },
  { name: "vessels", table: schema.vessels },
  { name: "applePressRuns", table: schema.applePressRuns },
  { name: "applePressRunLoads", table: schema.applePressRunLoads },
  { name: "pressItems", table: schema.pressItems },
  { name: "batches", table: schema.batches },
  { name: "batchCompositions", table: schema.batchCompositions },
  { name: "batchMeasurements", table: schema.batchMeasurements },
  { name: "batchTransfers", table: schema.batchTransfers },
  { name: "packageSizes", table: schema.packageSizes },
  { name: "packagingRuns", table: schema.packagingRuns },
  { name: "packagingRunPhotos", table: schema.packagingRunPhotos },
  { name: "packages", table: schema.packages },
  { name: "inventoryItems", table: schema.inventoryItems },
  { name: "auditLog", table: schema.auditLog },
];

/**
 * Transform date string fields to Date objects
 * Handles common date field patterns and nested objects
 */
function transformDates(obj: any): any {
  if (!obj || typeof obj !== "object") {
    return obj;
  }

  if (Array.isArray(obj)) {
    return obj.map(transformDates);
  }

  const result: any = {};
  for (const [key, value] of Object.entries(obj)) {
    // Check if this looks like a date field
    const isDateField =
      key.endsWith("At") ||
      key.endsWith("Date") ||
      key === "timestamp" ||
      key.includes("Time");

    if (isDateField && typeof value === "string" && value !== null) {
      // Convert ISO date string to Date object
      result[key] = new Date(value);
    } else if (value && typeof value === "object") {
      // Recursively transform nested objects
      result[key] = transformDates(value);
    } else {
      result[key] = value;
    }
  }

  return result;
}

async function importData() {
  console.log("📥 Starting database import...");
  console.log(`📁 Import from: ${IMPORT_PATH}`);
  console.log("\nOptions:");
  console.log(`  Tables: ${options.tables ? options.tables.join(", ") : "all"}`);
  console.log(`  Skip existing: ${options.skipExisting}`);
  console.log(`  Dry run: ${options.dryRun}`);
  console.log(`  Truncate: ${options.truncate}`);

  // Verify import directory exists
  if (!fs.existsSync(IMPORT_PATH)) {
    console.error(`\n❌ Error: Export folder not found: ${IMPORT_PATH}`);
    process.exit(1);
  }

  if (options.truncate && !options.dryRun) {
    console.log("\n⚠️  WARNING: Truncate mode will DELETE ALL DATA!");
    console.log("This cannot be undone. Press Ctrl+C to cancel...");
    await new Promise((resolve) => setTimeout(resolve, 5000));
  }

  const stats: Record<string, { imported: number; skipped: number; errors: number }> = {};

  // Filter tables if specified
  const tablesToImport = options.tables
    ? IMPORT_TABLES.filter((t) => options.tables!.includes(t.name))
    : IMPORT_TABLES;

  for (const { name, table } of tablesToImport) {
    console.log(`\n📊 Importing ${name}...`);
    stats[name] = { imported: 0, skipped: 0, errors: 0 };

    try {
      // Check if data file exists
      const dataFilePath = path.join(IMPORT_PATH, `${name}.ts`);
      if (!fs.existsSync(dataFilePath)) {
        console.log(`  ⚠️  No data file found: ${name}.ts (skipping)`);
        continue;
      }

      // Dynamically import the data
      const dataModule = await import(dataFilePath);
      const records = dataModule.default || dataModule[`${name}Data`];

      if (!records || records.length === 0) {
        console.log(`  ℹ️  No records to import`);
        continue;
      }

      console.log(`  Found ${records.length} records`);

      // Truncate table if requested
      if (options.truncate && !options.dryRun) {
        await db.delete(table);
        console.log(`  🗑️  Truncated ${name}`);
      }

      // Import records in batches
      const BATCH_SIZE = 100;
      for (let i = 0; i < records.length; i += BATCH_SIZE) {
        const batch = records.slice(i, i + BATCH_SIZE);

        for (const record of batch) {
          try {
            if (options.dryRun) {
              console.log(`  [DRY RUN] Would import record: ${record.id || i}`);
              stats[name].imported++;
            } else {
              // Check if record exists (by id)
              if (options.skipExisting && record.id) {
                const existing = await db
                  .select()
                  .from(table)
                  .where(sql`${table.id} = ${record.id}`)
                  .limit(1);

                if (existing.length > 0) {
                  stats[name].skipped++;
                  continue;
                }
              }

              // Transform date strings to Date objects
              const transformedRecord = transformDates(record);

              // Insert record
              await db.insert(table).values(transformedRecord);
              stats[name].imported++;
            }
          } catch (error: any) {
            stats[name].errors++;
            console.error(
              `  ⚠️  Error importing record ${record.id || i}: ${error.message}`
            );

            // Log the first error detail for debugging
            if (stats[name].errors === 1) {
              console.error(`     Record data:`, JSON.stringify(record, null, 2).slice(0, 200));
            }
          }
        }
      }

      console.log(
        `  ✅ Imported ${stats[name].imported} records` +
          (stats[name].skipped > 0 ? `, skipped ${stats[name].skipped}` : "") +
          (stats[name].errors > 0 ? `, ${stats[name].errors} errors` : "")
      );
    } catch (error) {
      console.error(`  ❌ Error importing ${name}:`, error);
    }
  }

  console.log("\n" + (options.dryRun ? "🔍 Dry run complete!" : "✅ Import complete!"));
  console.log("\nSummary:");
  for (const [table, counts] of Object.entries(stats)) {
    if (counts.imported > 0 || counts.errors > 0 || counts.skipped > 0) {
      console.log(
        `  ${table}: ${counts.imported} imported, ${counts.skipped} skipped, ${counts.errors} errors`
      );
    }
  }

  // Show tips for handling errors
  if (Object.values(stats).some((s) => s.errors > 0)) {
    console.log("\n💡 Tips for fixing errors:");
    console.log("  1. Check the error messages above for field name mismatches");
    console.log("  2. Edit the .ts files to match your current schema");
    console.log("  3. Add missing required fields with default values");
    console.log("  4. Remove fields that no longer exist");
    console.log("  5. Run with --dry-run to preview changes without committing");
  }
}

// Run the import
importData()
  .then(() => {
    console.log("\n✅ Done!");
    process.exit(0);
  })
  .catch((error) => {
    console.error("\n❌ Import failed:", error);
    process.exit(1);
  });