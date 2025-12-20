/**
 * Add source_batch_id column to batch_merge_history table
 */

import { db } from "../src/index";
import { sql } from "drizzle-orm";

async function addColumn() {
  console.log("Adding source_batch_id column to batch_merge_history...");

  // Check if column already exists
  const checkColumn = await db.execute(sql`
    SELECT column_name
    FROM information_schema.columns
    WHERE table_name = 'batch_merge_history'
    AND column_name = 'source_batch_id'
  `);

  if (checkColumn.rows.length > 0) {
    console.log("✅ Column source_batch_id already exists");
    process.exit(0);
  }

  // Add the column
  await db.execute(sql`
    ALTER TABLE batch_merge_history
    ADD COLUMN source_batch_id uuid REFERENCES batches(id)
  `);

  console.log("✅ Added source_batch_id column to batch_merge_history");
  process.exit(0);
}

addColumn().catch(e => { console.error(e); process.exit(1); });
