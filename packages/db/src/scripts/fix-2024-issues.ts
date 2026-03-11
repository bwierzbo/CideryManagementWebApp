import { db } from "..";
import { sql } from "drizzle-orm";

const GAL = 0.264172;

/**
 * Fix 3 batches with inflated initial_volume_liters (same pattern as Plum Wine fix).
 *
 * All three are `duplicate` status, excluded from SBD. These fixes resolve
 * per-batch volume trace discrepancies without affecting the waterfall.
 *
 * 1. Raspberry Blackberry (430cdcd3): init 150 → 18.9
 *    - Only 18.9L ever physically held. The 150L init was from the original
 *      racking but the volume was tracked through other batches.
 *
 * 2. Lavender Salal Cider (2f4bf687): init 230 → 0
 *    - Transfer-derived: all 80L came via transfer from Legacy BRITE.
 *      Init of 230L is phantom — never represented real volume in this batch.
 *
 * 3. Calvados Barrel Aged (b11200f5): init 105 → 0
 *    - Has parent_batch_id. Transfer IN of 105L from Calvados BA Cider = same
 *      liquid as init. Classic double-counting (same as Plum Wine pattern).
 */

const FIXES = [
  {
    id: "430cdcd3-af47-4260-a26f-6aab040f5b3f",
    name: "Raspberry Blackberry",
    newInit: 18.9,
    expectedCurrent: 18.9,
  },
  {
    id: "2f4bf687-f693-4f8a-b79c-91ce19dbec04",
    name: "Lavender Salal Cider",
    newInit: 0,
    expectedCurrent: 0,
  },
  {
    id: "b11200f5-c24d-4450-a75d-8feae24dd122",
    name: "Calvados Barrel Aged",
    newInit: 0,
    expectedCurrent: 79.7,
  },
];

async function reconstructBatch(batchId: string, init: number): Promise<number> {
  const xIn = await db.execute(
    sql.raw(`
    SELECT COALESCE(SUM(volume_transferred::numeric), 0) as t
    FROM batch_transfers WHERE destination_batch_id = '${batchId}' AND deleted_at IS NULL
  `)
  );
  const merges = await db.execute(
    sql.raw(`
    SELECT COALESCE(SUM(volume_added::numeric), 0) as t
    FROM batch_merge_history WHERE target_batch_id = '${batchId}' AND deleted_at IS NULL
  `)
  );
  const xOut = await db.execute(
    sql.raw(`
    SELECT COALESCE(SUM(volume_transferred::numeric + COALESCE(loss::numeric, 0)), 0) as t
    FROM batch_transfers WHERE source_batch_id = '${batchId}' AND deleted_at IS NULL
  `)
  );
  const bot = await db.execute(
    sql.raw(`
    SELECT COALESCE(SUM(volume_taken_liters::numeric), 0) as t
    FROM bottle_runs WHERE batch_id = '${batchId}' AND voided_at IS NULL
  `)
  );
  const keg = await db.execute(
    sql.raw(`
    SELECT COALESCE(SUM(CASE WHEN volume_taken_unit='gal' THEN volume_taken::numeric*3.78541
                             ELSE volume_taken::numeric END), 0) as t
    FROM keg_fills WHERE batch_id = '${batchId}' AND voided_at IS NULL AND deleted_at IS NULL
  `)
  );
  const rack = await db.execute(
    sql.raw(`
    SELECT COALESCE(SUM(volume_loss::numeric), 0) as t
    FROM batch_racking_operations WHERE batch_id = '${batchId}' AND deleted_at IS NULL
  `)
  );
  const filt = await db.execute(
    sql.raw(`
    SELECT COALESCE(SUM(volume_loss::numeric), 0) as t
    FROM batch_filter_operations WHERE batch_id = '${batchId}' AND deleted_at IS NULL
  `)
  );
  const adj = await db.execute(
    sql.raw(`
    SELECT COALESCE(SUM(adjustment_amount::numeric), 0) as t
    FROM batch_volume_adjustments WHERE batch_id = '${batchId}' AND deleted_at IS NULL
  `)
  );

  return (
    init +
    parseFloat((xIn.rows[0] as any).t) +
    parseFloat((merges.rows[0] as any).t) -
    parseFloat((xOut.rows[0] as any).t) -
    parseFloat((bot.rows[0] as any).t) -
    parseFloat((keg.rows[0] as any).t) -
    parseFloat((rack.rows[0] as any).t) -
    parseFloat((filt.rows[0] as any).t) +
    parseFloat((adj.rows[0] as any).t)
  );
}

async function main() {
  console.log("=== Fix 2024 Batch Issues ===\n");

  for (const fix of FIXES) {
    console.log(`--- ${fix.name} (${fix.id.slice(0, 8)}) ---`);

    // Get current state
    const before = await db.execute(
      sql.raw(`
      SELECT CAST(initial_volume_liters AS NUMERIC) as init,
             CAST(current_volume_liters AS NUMERIC) as current
      FROM batches WHERE id = '${fix.id}'
    `)
    );
    const oldInit = parseFloat((before.rows[0] as any).init);
    const current = parseFloat((before.rows[0] as any).current);
    console.log(`  Before: init=${oldInit.toFixed(1)}L, current=${current.toFixed(1)}L`);

    // Apply fix
    const result = await db.execute(
      sql.raw(`
      UPDATE batches
      SET initial_volume_liters = ${fix.newInit}, updated_at = NOW()
      WHERE id = '${fix.id}'
      RETURNING CAST(initial_volume_liters AS NUMERIC) as init
    `)
    );
    const newInit = parseFloat((result.rows[0] as any).init);
    console.log(`  After:  init=${newInit.toFixed(1)}L`);

    // Verify reconstruction
    const recon = await reconstructBatch(fix.id, newInit);
    const drift = recon - current;
    console.log(`  Recon: ${recon.toFixed(1)}L, Current: ${current.toFixed(1)}L, Drift: ${drift.toFixed(1)}L`);

    if (Math.abs(drift) > 0.5) {
      console.log(`  ** WARNING: Drift ${drift.toFixed(1)}L > 0.5L threshold **`);
    } else {
      console.log(`  OK — drift within tolerance`);
    }
    console.log();
  }

  console.log("=== Done ===");
  process.exit(0);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
