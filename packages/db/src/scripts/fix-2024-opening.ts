import { Pool } from "pg";
import * as dotenv from "dotenv";
dotenv.config({ path: "packages/db/.env" });

const pool = new Pool({ connectionString: process.env.DATABASE_URL });
const L_PER_GAL = 3.78541;

// Known values
const CURRENT_OPENING_GAL = 1115.8;  // From UI (batchReconciliation.totals.opening)
const TARGET_OPENING_GAL = 1121.0;   // Physical inventory (1061 hardCider + 60 wine16To21)
const GAP_GAL = TARGET_OPENING_GAL - CURRENT_OPENING_GAL; // 5.2 gal
const GAP_L = GAP_GAL * L_PER_GAL;  // ~19.68L

const DISTILLERY_BATCH_NUMBER = "blend-2024-12-20-1000 IBC 4-024554";
const OPENING_DATE = "2024-12-31";

async function main() {
  console.log(`Current opening:  ${CURRENT_OPENING_GAL} gal (from UI)`);
  console.log(`Target opening:   ${TARGET_OPENING_GAL} gal (physical inventory)`);
  console.log(`Gap:              +${GAP_GAL.toFixed(2)} gal (+${GAP_L.toFixed(2)} L)\n`);

  // 1. Get the distillery batch ID
  const batchResult = await pool.query(`
    SELECT id, name, batch_number, CAST(current_volume_liters AS float) as cur_l
    FROM batches
    WHERE batch_number = $1 AND deleted_at IS NULL
  `, [DISTILLERY_BATCH_NUMBER]);

  if (batchResult.rowCount === 0) {
    console.error(`ERROR: Batch "${DISTILLERY_BATCH_NUMBER}" not found!`);
    await pool.end();
    return;
  }

  const batch = batchResult.rows[0];
  console.log(`Target batch: ${batch.name} (${batch.batch_number})`);
  console.log(`Current volume: ${batch.cur_l}L\n`);

  // 2. Show existing adjustments on this batch
  const existingAdjs = await pool.query(`
    SELECT id, CAST(adjustment_amount AS float) as amt, adjustment_type, reason, adjustment_date
    FROM batch_volume_adjustments
    WHERE batch_id = $1 AND deleted_at IS NULL
    ORDER BY adjustment_date
  `, [batch.id]);

  if (existingAdjs.rowCount && existingAdjs.rowCount > 0) {
    console.log(`Existing adjustments on this batch:`);
    for (const a of existingAdjs.rows as any[]) {
      console.log(`  ${a.adjustment_type}: ${a.amt > 0 ? "+" : ""}${a.amt}L "${a.reason}" @ ${a.adjustment_date}`);
    }
    console.log();
  }

  // 3. Get the admin user for adjusted_by
  const adminUser = await pool.query(`
    SELECT id FROM users WHERE role = 'admin' LIMIT 1
  `);
  const adjustedBy = adminUser.rows[0]?.id || '8356e824-6b53-4751-b3ac-08a0df9327b9';

  // 4. Add the reconciliation adjustment
  const volumeBefore = batch.cur_l;
  const volumeAfter = volumeBefore + GAP_L;

  console.log(`Adding adjustment: +${GAP_L.toFixed(4)} L (${GAP_GAL.toFixed(2)} gal)`);
  console.log(`  batch_id: ${batch.id}`);
  console.log(`  adjustment_date: ${OPENING_DATE}`);
  console.log(`  adjustment_type: measurement_error`);
  console.log(`  volume_before: ${volumeBefore.toFixed(3)} L`);
  console.log(`  volume_after: ${volumeAfter.toFixed(3)} L`);
  console.log(`  reason: Year-end inventory reconciliation to physical count\n`);

  const insertResult = await pool.query(`
    INSERT INTO batch_volume_adjustments (
      batch_id, adjustment_amount, adjustment_date, adjustment_type,
      volume_before, volume_after, reason, adjusted_by,
      created_at, updated_at
    )
    VALUES ($1, $2, $3::date, 'measurement_error', $4, $5, $6, $7, NOW(), NOW())
    RETURNING id, CAST(adjustment_amount AS float) as amt
  `, [
    batch.id,
    GAP_L.toFixed(4),
    OPENING_DATE,
    volumeBefore.toFixed(3),
    volumeAfter.toFixed(3),
    `Year-end inventory reconciliation to physical count (${TARGET_OPENING_GAL} gal = 1061 hardCider + 60 wine16To21)`,
    adjustedBy
  ]);

  console.log(`Inserted adjustment: id=${insertResult.rows[0].id}, amount=+${insertResult.rows[0].amt.toFixed(4)} L`);
  console.log(`\nExpected new opening: ${TARGET_OPENING_GAL.toFixed(1)} gal`);
  console.log(`\nRefresh the reconciliation page to verify.`);

  await pool.end();
}

main().catch(console.error);
