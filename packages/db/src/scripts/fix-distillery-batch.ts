import { Pool } from "pg";
import * as dotenv from "dotenv";
dotenv.config({ path: "packages/db/.env" });

const pool = new Pool({ connectionString: process.env.DATABASE_URL });

const BATCH_ID = "1539d85e-299a-4e13-ae0e-ee2ca38b7ea6";
const ADJ_1_ID = "23ff02e9-bbb1-42f9-acd2-b3b4aab963f2"; // +20.047L correction_up
const ADJ_2_ID = "cef9d933-7bbf-4242-a9d7-f7a4601e2022"; // +19.684L measurement_error
const DIST_ID = "8dc9239e-6020-4804-a0a1-c4cf3dbdb53f";
const DRIFT_L = 19.684; // The opening adjustment amount that created the drift

async function main() {
  const client = await pool.connect();
  try {
    await client.query("BEGIN");

    // 1. Get both adjustments
    const adj1 = await client.query(
      `SELECT CAST(adjustment_amount AS float) as amt FROM batch_volume_adjustments WHERE id = $1 AND deleted_at IS NULL`,
      [ADJ_1_ID]
    );
    const adj2 = await client.query(
      `SELECT CAST(adjustment_amount AS float) as amt FROM batch_volume_adjustments WHERE id = $1 AND deleted_at IS NULL`,
      [ADJ_2_ID]
    );
    const amt1 = adj1.rows[0]?.amt || 0;
    const amt2 = adj2.rows[0]?.amt || 0;
    const combinedAmt = amt1 + amt2;
    console.log(`Adjustment 1: +${amt1}L`);
    console.log(`Adjustment 2: +${amt2}L`);
    console.log(`Combined:     +${combinedAmt.toFixed(4)}L\n`);

    // 2. Soft-delete both adjustments
    await client.query(`UPDATE batch_volume_adjustments SET deleted_at = NOW() WHERE id = $1`, [ADJ_1_ID]);
    await client.query(`UPDATE batch_volume_adjustments SET deleted_at = NOW() WHERE id = $1`, [ADJ_2_ID]);
    console.log("Deleted both existing adjustments\n");

    // 3. Create combined adjustment
    const adminUser = await client.query(`SELECT id FROM users WHERE role = 'admin' LIMIT 1`);
    const adjustedBy = adminUser.rows[0]?.id;

    const volumeBefore = 0;
    const volumeAfter = combinedAmt;

    const insertResult = await client.query(`
      INSERT INTO batch_volume_adjustments (
        batch_id, adjustment_amount, adjustment_date, adjustment_type,
        volume_before, volume_after, reason, adjusted_by,
        created_at, updated_at
      )
      VALUES ($1, $2, '2024-12-31'::date, 'correction_up', $3, $4, $5, $6, NOW(), NOW())
      RETURNING id, CAST(adjustment_amount AS float) as amt
    `, [
      BATCH_ID,
      combinedAmt.toFixed(4),
      volumeBefore.toFixed(4),
      volumeAfter.toFixed(4),
      `Year-end reconciliation: Legacy cider volume correction (+${amt1.toFixed(1)}L) and inventory reconciliation to 1121 gal physical count (+${amt2.toFixed(1)}L)`,
      adjustedBy,
    ]);
    console.log(`Created combined adjustment: id=${insertResult.rows[0].id}, +${insertResult.rows[0].amt.toFixed(4)}L\n`);

    // 4. Increase distillation source volume by drift amount
    const dist = await client.query(
      `SELECT CAST(source_volume AS float) as sv, CAST(source_volume_liters AS float) as svl
       FROM distillation_records WHERE id = $1`,
      [DIST_ID]
    );
    const oldSV = dist.rows[0].sv;
    const oldSVL = dist.rows[0].svl;
    const newSV = oldSV + DRIFT_L;
    const newSVL = oldSVL + DRIFT_L;

    await client.query(`
      UPDATE distillation_records
      SET source_volume = $1, source_volume_liters = $2, updated_at = NOW()
      WHERE id = $3
    `, [newSV.toFixed(3), newSVL.toFixed(3), DIST_ID]);

    console.log(`Distillation record updated:`);
    console.log(`  source_volume:        ${oldSV.toFixed(3)} -> ${newSV.toFixed(3)} L`);
    console.log(`  source_volume_liters: ${oldSVL.toFixed(3)} -> ${newSVL.toFixed(3)} L`);
    console.log(`  received_volume: unchanged`);

    await client.query("COMMIT");
    console.log(`\nDone. Drift should now be ~0.`);
  } catch (err) {
    await client.query("ROLLBACK");
    throw err;
  } finally {
    client.release();
    await pool.end();
  }
}

main().catch(console.error);
