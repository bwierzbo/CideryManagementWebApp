import { Pool } from "pg";
import * as dotenv from "dotenv";
dotenv.config({ path: "packages/db/.env" });

const pool = new Pool({ connectionString: process.env.DATABASE_URL });

const BATCH_NUMBER = "2024-11-28_120 Barrel 2_BLEND_A";
const ADJUSTMENT_DATE = "2025-01-01";
const ADJUSTMENT_L = -105.0; // Remove double-counted blend volume

async function main() {
  // 1. Get batch
  const batchResult = await pool.query(`
    SELECT id, name, batch_number, CAST(current_volume_liters AS float) as cur_l
    FROM batches
    WHERE batch_number = $1 AND deleted_at IS NULL
  `, [BATCH_NUMBER]);

  if (batchResult.rowCount === 0) {
    console.error(`ERROR: Batch "${BATCH_NUMBER}" not found!`);
    await pool.end();
    return;
  }

  const batch = batchResult.rows[0];
  console.log(`Batch: ${batch.name} (${batch.batch_number})`);
  console.log(`Current volume: ${batch.cur_l}L\n`);

  // 2. Show existing adjustments
  const existingAdjs = await pool.query(`
    SELECT id, CAST(adjustment_amount AS float) as amt, adjustment_type, reason, adjustment_date
    FROM batch_volume_adjustments
    WHERE batch_id = $1 AND deleted_at IS NULL
    ORDER BY adjustment_date
  `, [batch.id]);

  if (existingAdjs.rowCount && existingAdjs.rowCount > 0) {
    console.log(`Existing adjustments:`);
    for (const a of existingAdjs.rows as any[]) {
      console.log(`  ${a.adjustment_type}: ${a.amt > 0 ? "+" : ""}${a.amt}L "${a.reason}" @ ${a.adjustment_date}`);
    }
    console.log();
  }

  // 3. Get admin user
  const adminUser = await pool.query(`SELECT id FROM users WHERE role = 'admin' LIMIT 1`);
  const adjustedBy = adminUser.rows[0]?.id;

  // 4. Insert correction adjustment
  // volume_before/after must satisfy: after - before = adjustment_amount
  // Use reconstructed volume as "before" since that's what the system thinks exists
  const volumeBefore = Math.abs(ADJUSTMENT_L); // 105 L (the phantom volume)
  const volumeAfter = 0;

  console.log(`Adding adjustment: ${ADJUSTMENT_L} L`);
  console.log(`  adjustment_date: ${ADJUSTMENT_DATE}`);
  console.log(`  reason: Double-counted blend volume (68L brandy + 37L blend) already accounted for in duplicate child batches\n`);

  const insertResult = await pool.query(`
    INSERT INTO batch_volume_adjustments (
      batch_id, adjustment_amount, adjustment_date, adjustment_type,
      volume_before, volume_after, reason, adjusted_by,
      created_at, updated_at
    )
    VALUES ($1, $2, $3::date, 'correction_down', $4, $5, $6, $7, NOW(), NOW())
    RETURNING id, CAST(adjustment_amount AS float) as amt
  `, [
    batch.id,
    ADJUSTMENT_L.toFixed(4),
    ADJUSTMENT_DATE,
    volumeBefore.toFixed(4),
    volumeAfter.toFixed(4),
    `Correction: 105L blend-in (68L brandy + 37L blend component) double-counted — volume already processed through duplicate child/grandchild racking batches`,
    adjustedBy
  ]);

  console.log(`Inserted adjustment: id=${insertResult.rows[0].id}, amount=${insertResult.rows[0].amt.toFixed(1)} L`);
  console.log(`\nExpected: drift should now be ~0 gal. Refresh reconciliation to verify.`);

  await pool.end();
}

main().catch(console.error);
