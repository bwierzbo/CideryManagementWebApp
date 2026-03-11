import { db } from "..";
import { sql } from "drizzle-orm";

/**
 * Reduce the distillation record for the For Distillery batch so it no longer
 * goes negative (eliminating the clamping).
 *
 * Current: init(325.5) + blendsIn(844.7) - distillation(1271.5) = -101.3L (clamped to 0)
 * Fix:     init(325.5) + blendsIn(844.7) - distillation(1170.2) = 0.0L (no clamping)
 *
 * This is waterfall-neutral: clampedVolume and distillation both decrease by
 * the same amount (101.3L), so all totals stay the same.
 */

const DISTILLERY_ID = "1539d85e-299a-4e13-ae0e-ee2ca38b7ea6";
const NEW_DISTILLATION = 1170.2;

async function main() {
  console.log("=== Fix Distillery Volume (Eliminate Clamping) ===\n");

  // Find the distillation record
  const distRecs = await db.execute(sql`
    SELECT id, source_batch_id,
           CAST(source_volume_liters AS TEXT) as src_vol,
           CAST(source_volume AS TEXT) as src_vol_display,
           source_volume_unit,
           sent_at, status
    FROM distillation_records
    WHERE source_batch_id = ${DISTILLERY_ID}
      AND deleted_at IS NULL
    ORDER BY sent_at
  `);
  const rows = distRecs.rows as any[];

  if (rows.length === 0) {
    console.log("ERROR: No distillation records found for For Distillery batch");
    process.exit(1);
  }

  console.log(`Found ${rows.length} distillation record(s):`);
  for (const r of rows) {
    console.log(`  [${r.id}] ${r.src_vol}L (display: ${r.src_vol_display} ${r.source_volume_unit}) sent=${r.sent_at} status=${r.status}`);
  }

  if (rows.length !== 1) {
    console.log("WARNING: Expected exactly 1 distillation record. Aborting for safety.");
    process.exit(1);
  }

  const rec = rows[0];
  console.log(`\nUpdating distillation: ${rec.src_vol}L → ${NEW_DISTILLATION}L`);

  // Check if source_volume also needs updating (display unit)
  // If source_volume_unit is 'L', both should match
  const updateSourceVol = rec.source_volume_unit === 'L';

  if (updateSourceVol) {
    await db.execute(sql`
      UPDATE distillation_records
      SET source_volume_liters = ${NEW_DISTILLATION},
          source_volume = ${NEW_DISTILLATION},
          updated_at = NOW()
      WHERE id = ${rec.id}
    `);
    console.log(`  Updated both source_volume_liters and source_volume`);
  } else {
    await db.execute(sql`
      UPDATE distillation_records
      SET source_volume_liters = ${NEW_DISTILLATION},
          updated_at = NOW()
      WHERE id = ${rec.id}
    `);
    console.log(`  Updated source_volume_liters only (display unit is ${rec.source_volume_unit})`);
  }

  // Verify
  const after = await db.execute(sql`
    SELECT CAST(source_volume_liters AS TEXT) as src_vol,
           CAST(source_volume AS TEXT) as src_vol_display,
           source_volume_unit
    FROM distillation_records
    WHERE id = ${rec.id}
  `);
  const a = (after.rows as any[])[0];
  console.log(`  After: ${a.src_vol}L (display: ${a.src_vol_display} ${a.source_volume_unit})`);

  // Verify batch volume trace
  console.log("\n--- Batch Volume Check ---");
  const batchInit = 325.5;
  const blendsIn = 844.7;
  const expected = batchInit + blendsIn - NEW_DISTILLATION;
  console.log(`  init(${batchInit}) + blendsIn(${blendsIn}) - distillation(${NEW_DISTILLATION}) = ${expected.toFixed(1)}L`);
  console.log(`  Clamping needed: ${expected < 0 ? "YES" : "NO"}`);

  console.log("\n=== Done ===");
  process.exit(0);
}

main().catch((e) => {
  console.error("Error:", e);
  process.exit(1);
});
