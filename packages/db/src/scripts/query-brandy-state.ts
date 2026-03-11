import { db } from "../client";
import { sql } from "drizzle-orm";

async function main() {
  // 1. Get existing adjustment on AB#3-barrel as template
  const adj = await db.execute(sql.raw(`
    SELECT id, batch_id, adjustment_amount, volume_before, volume_after, reason, adjusted_by, created_at
    FROM batch_volume_adjustments
    WHERE batch_id = '289e46b6-4f99-45a3-959b-953ffdaf4ff4'
    AND deleted_at IS NULL
  `));
  console.log("AB#3 adjustment template:", JSON.stringify(adj.rows, null, 2));

  // 2. Get parent Apple Brandy current state
  const parent = await db.execute(sql.raw(`
    SELECT id, name, custom_name, initial_volume_liters, current_volume_liters, 
           reconciliation_status, product_type
    FROM batches
    WHERE id = 'cf5b8a7b-33b4-407c-9011-1e4a2068d1da'
  `));
  console.log("Parent batch:", JSON.stringify(parent.rows, null, 2));

  // 3. Get the deleted transfer to Salish#1
  const delTransfer = await db.execute(sql.raw(`
    SELECT id, volume_transferred, deleted_at
    FROM batch_transfers
    WHERE id = 'ad247e3a-5e3f-439e-bd0b-2a79b6a80fe3'
  `));
  console.log("Deleted transfer to Salish#1:", JSON.stringify(delTransfer.rows, null, 2));

  // 4. Check existing adjustments on parent
  const parentAdj = await db.execute(sql.raw(`
    SELECT id, adjustment_amount, reason
    FROM batch_volume_adjustments
    WHERE batch_id = 'cf5b8a7b-33b4-407c-9011-1e4a2068d1da'
    AND deleted_at IS NULL
  `));
  console.log("Parent existing adjustments:", JSON.stringify(parentAdj.rows, null, 2));

  // 5. Get a user UUID for adjusted_by
  const user = await db.execute(sql.raw(`
    SELECT id, name FROM users LIMIT 1
  `));
  console.log("User for adjusted_by:", JSON.stringify(user.rows, null, 2));

  process.exit(0);
}
main().catch(e => { console.error(e); process.exit(1); });
