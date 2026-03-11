import { db } from "../client";
import { sql } from "drizzle-orm";

const prefix = "__ttb_parity_test__";

async function cleanup() {
  await db.execute(sql.raw(`DELETE FROM batch_racking_operations WHERE batch_id IN (SELECT id FROM batches WHERE name LIKE '${prefix}%')`));
  await db.execute(sql.raw(`DELETE FROM keg_fills WHERE batch_id IN (SELECT id FROM batches WHERE name LIKE '${prefix}%')`));
  await db.execute(sql.raw(`DELETE FROM bottle_runs WHERE batch_id IN (SELECT id FROM batches WHERE name LIKE '${prefix}%')`));
  await db.execute(sql.raw(`DELETE FROM press_run_loads WHERE press_run_id IN (SELECT id FROM press_runs WHERE vendor_id IN (SELECT id FROM vendors WHERE name LIKE '${prefix}%'))`));
  await db.execute(sql.raw(`UPDATE batches SET origin_press_run_id = NULL WHERE name LIKE '${prefix}%'`));
  await db.execute(sql.raw(`DELETE FROM press_runs WHERE vendor_id IN (SELECT id FROM vendors WHERE name LIKE '${prefix}%')`));
  await db.execute(sql.raw(`DELETE FROM batches WHERE name LIKE '${prefix}%'`));
  await db.execute(sql.raw(`DELETE FROM kegs WHERE keg_number LIKE '${prefix}%'`));
  await db.execute(sql.raw(`DELETE FROM basefruit_purchase_items WHERE purchase_id IN (SELECT id FROM basefruit_purchases WHERE vendor_id IN (SELECT id FROM vendors WHERE name LIKE '${prefix}%'))`));
  await db.execute(sql.raw(`DELETE FROM basefruit_purchases WHERE vendor_id IN (SELECT id FROM vendors WHERE name LIKE '${prefix}%')`));
  await db.execute(sql.raw(`DELETE FROM base_fruit_varieties WHERE name LIKE '${prefix}%'`));
  await db.execute(sql.raw(`DELETE FROM organization_settings WHERE organization_id IN (SELECT id FROM organizations WHERE name LIKE '${prefix}%')`));
  await db.execute(sql.raw(`DELETE FROM vendors WHERE name LIKE '${prefix}%'`));
  await db.execute(sql.raw(`DELETE FROM vessels WHERE name LIKE '${prefix}%'`));
  await db.execute(sql.raw(`DELETE FROM organizations WHERE name LIKE '${prefix}%'`));
  await db.execute(sql.raw(`DELETE FROM users WHERE name LIKE '${prefix}%'`));

  console.log("Cleanup complete");
  process.exit(0);
}
cleanup().catch(e => { console.error(e); process.exit(1); });
