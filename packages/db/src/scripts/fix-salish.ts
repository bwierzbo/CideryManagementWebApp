import { Pool } from "pg";
import * as dotenv from "dotenv";
dotenv.config({ path: "packages/db/.env" });

const pool = new Pool({ connectionString: process.env.DATABASE_URL });
const BATCH_ID = "0639e21d-63c8-4b5d-94b4-bdd7823dee49";

async function main() {
  // Show before state
  const before = await pool.query(`
    SELECT name, CAST(current_volume_liters AS float) as cur_l,
           volume_manually_corrected
    FROM batches WHERE id = $1
  `, [BATCH_ID]);
  console.log("BEFORE:", before.rows[0]);

  // 1. Zero out the current volume
  // Reason: All product was racked out of the barrel, bottled, and transferred out.
  // The 125.06L current volume was an artifact of soft-deleted transfers and
  // an erroneous +20.06L reconciliation adjustment that compensated for
  // soft-deleted merge records.
  await pool.query(`
    UPDATE batches
    SET current_volume_liters = 0,
        updated_at = NOW()
    WHERE id = $1
  `, [BATCH_ID]);
  console.log("Set current_volume_liters = 0");

  // 2. Remove the erroneous +20.06L adjustment
  // This adjustment was added during TTB reconciliation on Feb 10, 2026 to
  // compensate for volume from deleted intermediary blend batches and rounding.
  // However, the underlying merge records were soft-deleted on Feb 8, 2026,
  // making this adjustment incorrect — it adds back volume that doesn't exist.
  const adj = await pool.query(`
    DELETE FROM batch_volume_adjustments
    WHERE batch_id = $1
      AND reason ILIKE '%TTB reconciliation correction%'
    RETURNING id, CAST(adjustment_amount AS float) as amt, reason
  `, [BATCH_ID]);
  console.log("Deleted adjustment:", adj.rows);

  // Show after state
  const after = await pool.query(`
    SELECT name, CAST(current_volume_liters AS float) as cur_l
    FROM batches WHERE id = $1
  `, [BATCH_ID]);
  console.log("AFTER:", after.rows[0]);

  await pool.end();
}

main().catch(console.error);
