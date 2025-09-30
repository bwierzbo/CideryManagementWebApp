/**
 * Database Data Export Script
 *
 * Exports all data from the database to TypeScript files that can be:
 * - Manually edited when schema changes
 * - Version controlled
 * - Easily imported back
 *
 * Usage: npx tsx src/scripts/export-data.ts
 */

import { db } from "../index";
import * as schema from "../schema";
import * as fs from "fs";
import * as path from "path";

// Define the export directory
const EXPORT_DIR = path.join(__dirname, "../../data-exports");
const TIMESTAMP = new Date().toISOString().replace(/[:.]/g, "-").split("T")[0];
const EXPORT_PATH = path.join(EXPORT_DIR, TIMESTAMP);

// Tables to export in dependency order (to handle foreign keys on import)
const EXPORT_TABLES = [
  // Reference data first
  { name: "users", table: schema.users },
  { name: "vendors", table: schema.vendors },
  { name: "baseFruitVarieties", table: schema.baseFruitVarieties },
  { name: "juiceVarieties", table: schema.juiceVarieties },

  // Purchases
  { name: "basefruitPurchases", table: schema.basefruitPurchases },
  { name: "basefruitPurchaseItems", table: schema.basefruitPurchaseItems },
  { name: "juicePurchases", table: schema.juicePurchases },
  { name: "juicePurchaseItems", table: schema.juicePurchaseItems },
  { name: "additivePurchases", table: schema.additivePurchases },
  { name: "additivePurchaseItems", table: schema.additivePurchaseItems },

  // Vessels
  { name: "vessels", table: schema.vessels },

  // Press operations
  { name: "applePressRuns", table: schema.applePressRuns },
  { name: "applePressRunLoads", table: schema.applePressRunLoads },
  { name: "pressItems", table: schema.pressItems },

  // Batches
  { name: "batches", table: schema.batches },
  { name: "batchCompositions", table: schema.batchCompositions },
  { name: "batchMeasurements", table: schema.batchMeasurements },
  { name: "batchTransfers", table: schema.batchTransfers },

  // Packaging
  { name: "packageSizes", table: schema.packageSizes },
  { name: "packagingRuns", table: schema.packagingRuns },
  { name: "packagingRunPhotos", table: schema.packagingRunPhotos },
  { name: "packages", table: schema.packages },
  { name: "inventoryItems", table: schema.inventoryItems },

  // Audit
  { name: "auditLog", table: schema.auditLog },
];

async function exportData() {
  console.log("📦 Starting database export...");
  console.log(`📁 Export directory: ${EXPORT_PATH}`);

  // Create export directory
  if (!fs.existsSync(EXPORT_DIR)) {
    fs.mkdirSync(EXPORT_DIR, { recursive: true });
  }
  if (!fs.existsSync(EXPORT_PATH)) {
    fs.mkdirSync(EXPORT_PATH, { recursive: true });
  }

  const stats: Record<string, number> = {};

  for (const { name, table } of EXPORT_TABLES) {
    try {
      console.log(`\n📊 Exporting ${name}...`);

      // Query all records from the table
      const records = await db.select().from(table);
      stats[name] = records.length;

      if (records.length === 0) {
        console.log(`  ⚠️  No records found in ${name}`);
        continue;
      }

      // Convert records to TypeScript format
      const tsContent = generateTypeScriptFile(name, records);

      // Write to file
      const filePath = path.join(EXPORT_PATH, `${name}.ts`);
      fs.writeFileSync(filePath, tsContent, "utf-8");

      console.log(`  ✅ Exported ${records.length} records to ${name}.ts`);
    } catch (error) {
      console.error(`  ❌ Error exporting ${name}:`, error);
    }
  }

  // Create index file
  createIndexFile();

  // Create README
  createReadme(stats);

  console.log("\n✅ Export complete!");
  console.log(`\n📁 Exported data to: ${EXPORT_PATH}`);
  console.log("\nSummary:");
  for (const [table, count] of Object.entries(stats)) {
    console.log(`  ${table}: ${count} records`);
  }
}

function generateTypeScriptFile(tableName: string, records: any[]): string {
  // Serialize records to TypeScript format
  const recordsStr = JSON.stringify(records, null, 2)
    .replace(/"([^"]+)":/g, "$1:") // Remove quotes from keys
    .replace(/: "([^"]*)"([,\n])/g, ': "$1"$2') // Keep string values quoted
    .replace(/: null/g, ": null"); // Keep nulls as null

  return `/**
 * ${tableName} data export
 * Generated: ${new Date().toISOString()}
 *
 * IMPORTANT: You can manually edit this file to adjust for schema changes.
 * - Add/remove fields as needed
 * - Update field names to match new schema
 * - Modify values
 *
 * When importing, the import script will validate against current schema.
 */

export const ${tableName}Data = ${recordsStr} as const;

export default ${tableName}Data;
`;
}

function createIndexFile() {
  const imports = EXPORT_TABLES.map(
    ({ name }) => `export { default as ${name}Data } from "./${name}";`
  ).join("\n");

  const content = `/**
 * Data Export Index
 * Generated: ${new Date().toISOString()}
 *
 * Import all exported data from this file.
 */

${imports}

export const exportMetadata = {
  exportDate: "${new Date().toISOString()}",
  tables: [${EXPORT_TABLES.map(t => `"${t.name}"`).join(", ")}],
} as const;
`;

  fs.writeFileSync(path.join(EXPORT_PATH, "index.ts"), content, "utf-8");
}

function createReadme(stats: Record<string, number>) {
  const content = `# Database Export - ${TIMESTAMP}

Generated: ${new Date().toISOString()}

## Export Summary

${Object.entries(stats).map(([table, count]) => `- **${table}**: ${count} records`).join("\n")}

## How to Use This Export

### 1. Manual Editing

Each \`.ts\` file contains the data for one table. You can:
- Edit field names to match new schema
- Add/remove fields
- Modify values
- Delete records you don't want to import

### 2. Importing Data

Use the import script to restore this data:

\`\`\`bash
# Import all data
npx tsx src/scripts/import-data.ts ${TIMESTAMP}

# Import specific tables
npx tsx src/scripts/import-data.ts ${TIMESTAMP} --tables users,vendors,batches
\`\`\`

### 3. Schema Changes

If your schema changes:
1. Open the relevant \`.ts\` file
2. Update field names to match new schema
3. Add new required fields with default values
4. Remove deprecated fields
5. Run the import script

Example - if \`volumeL\` changed to \`volume\` + \`volumeUnit\`:

\`\`\`typescript
// OLD
{
  id: "abc",
  volumeL: "100.5",
}

// NEW
{
  id: "abc",
  volume: "100.5",
  volumeUnit: "L",
}
\`\`\`

## Table Dependencies

Tables are exported in dependency order:
1. Reference data (refValues, users, vendors, varieties)
2. Purchases (baseFruit, juice, additive)
3. Vessels
4. Press operations (applePressRuns, loads, items)
5. Batches (batches, compositions, measurements, transfers)
6. Packaging (packageSizes, runs, packages, inventory)
7. Audit logs

## Notes

- All timestamps are in ISO format
- UUIDs are preserved
- NULL values are represented as \`null\`
- Deleted records (deletedAt != null) are included
- You can filter out test data before importing
`;

  fs.writeFileSync(path.join(EXPORT_PATH, "README.md"), content, "utf-8");
}

// Run the export
exportData()
  .then(() => {
    console.log("\n✅ Done!");
    process.exit(0);
  })
  .catch((error) => {
    console.error("\n❌ Export failed:", error);
    process.exit(1);
  });