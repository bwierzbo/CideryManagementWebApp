import { db } from "..";
import { sql } from "drizzle-orm";

const GAL = 0.264172;

async function main() {
  console.log("=== Fix Salish - Racked 2025-03-07 ===\n");

  const SALISH_RACKED = "5ce0e31a";
  const SALISH_SOURCE = "91bb8d67";

  // Step 0: Get full IDs
  const salishRacked = await db.execute(sql.raw(`
    SELECT id, custom_name, parent_batch_id, actual_abv, estimated_abv, vessel_id,
           CAST(initial_volume_liters AS NUMERIC) as init,
           CAST(current_volume_liters AS NUMERIC) as current,
           status, reconciliation_status
    FROM batches WHERE id::text LIKE '${SALISH_RACKED}%'
  `));
  const sr = (salishRacked.rows as any[])[0];
  console.log(`Target: "${sr.custom_name}" (${sr.id})`);
  console.log(`  Init: ${parseFloat(sr.init).toFixed(1)}L, Current: ${parseFloat(sr.current).toFixed(1)}L`);
  console.log(`  Status: ${sr.status}, Recon: ${sr.reconciliation_status}`);
  console.log(`  Parent: ${sr.parent_batch_id || "NONE"}, ABV: ${sr.actual_abv || sr.estimated_abv || "NONE"}`);
  console.log(`  Vessel: ${sr.vessel_id || "NONE"}`);

  const salishSource = await db.execute(sql.raw(`
    SELECT id, custom_name FROM batches WHERE id::text LIKE '${SALISH_SOURCE}%'
  `));
  const ss = (salishSource.rows as any[])[0];
  console.log(`\nSource: "${ss.custom_name}" (${ss.id})`);

  // Step 1: Find available carboys
  console.log("\n--- Available 5G Carboys ---");
  const carboys = await db.execute(sql.raw(`
    SELECT v.id, v.name, CAST(v.capacity_liters AS NUMERIC) as cap,
           (SELECT COUNT(*) FROM batches b WHERE b.vessel_id = v.id AND b.deleted_at IS NULL AND b.status != 'completed') as active_batches
    FROM vessels v
    WHERE v.name LIKE 'CARBOY-5G%' AND v.deleted_at IS NULL
    ORDER BY v.name
  `));
  for (const c of carboys.rows as any[]) {
    const status = parseInt(c.active_batches) === 0 ? "EMPTY" : `${c.active_batches} active`;
    console.log(`  ${c.name}: cap=${parseFloat(c.cap).toFixed(0)}L, ${status} (${c.id})`);
  }

  // Pick first empty carboy
  const emptyCarboy = (carboys.rows as any[]).find((c: any) => parseInt(c.active_batches) === 0);
  if (!emptyCarboy) {
    console.log("ERROR: No empty carboys available!");
    process.exit(1);
  }
  console.log(`\nAssigning to: ${emptyCarboy.name} (${emptyCarboy.id})`);

  // Step 2: Get ABV from grandparent chain
  console.log("\n--- ABV from transfer chain ---");
  const measurements = await db.execute(sql.raw(`
    SELECT bm.abv, bm.measurement_date::text, b.custom_name, b.id as batch_id
    FROM batch_measurements bm
    JOIN batches b ON bm.batch_id = b.id
    WHERE bm.abv IS NOT NULL
      AND bm.batch_id IN (
        -- Source batch
        '${ss.id}',
        -- Grandparent: find parent of source
        (SELECT parent_batch_id FROM batches WHERE id = '${ss.id}'),
        -- Or original Salish
        (SELECT bt.source_batch_id FROM batch_transfers bt WHERE bt.destination_batch_id = '${ss.id}' AND bt.deleted_at IS NULL LIMIT 1)
      )
    ORDER BY bm.measurement_date DESC
    LIMIT 5
  `));
  for (const m of measurements.rows as any[]) {
    console.log(`  ${m.custom_name}: ABV=${m.abv}, date=${m.measurement_date}`);
  }

  // Also check grandparent directly
  const gpAbv = await db.execute(sql.raw(`
    SELECT bm.abv, bm.measurement_date::text, b.custom_name
    FROM batch_measurements bm
    JOIN batches b ON bm.batch_id = b.id
    WHERE bm.abv IS NOT NULL
      AND b.custom_name LIKE '%Salish%'
    ORDER BY bm.measurement_date DESC
    LIMIT 5
  `));
  console.log("\n  All Salish ABV measurements:");
  for (const m of gpAbv.rows as any[]) {
    console.log(`    ${m.custom_name}: ABV=${m.abv}, date=${m.measurement_date}`);
  }

  const abvValue = (gpAbv.rows as any[]).length > 0 ? parseFloat((gpAbv.rows as any[])[0].abv) : 18.0;
  console.log(`\n  Using ABV: ${abvValue}`);

  // Step 3: Apply fixes
  console.log("\n--- Applying Fixes ---");

  // Set parent_batch_id, actual_abv, vessel_id
  const result = await db.execute(sql.raw(`
    UPDATE batches
    SET parent_batch_id = '${ss.id}',
        actual_abv = ${abvValue},
        vessel_id = '${emptyCarboy.id}',
        updated_at = NOW()
    WHERE id = '${sr.id}'
    RETURNING custom_name, parent_batch_id, actual_abv, vessel_id
  `));
  const updated = (result.rows as any[])[0];
  console.log(`  ✓ parent_batch_id = ${updated.parent_batch_id}`);
  console.log(`  ✓ actual_abv = ${updated.actual_abv}`);
  console.log(`  ✓ vessel_id = ${updated.vessel_id}`);

  // Step 4: Create measurement record (bring forward from source)
  const existingMeasurement = await db.execute(sql.raw(`
    SELECT COUNT(*) as cnt FROM batch_measurements WHERE batch_id = '${sr.id}'
  `));
  if (parseInt((existingMeasurement.rows[0] as any).cnt) === 0) {
    await db.execute(sql.raw(`
      INSERT INTO batch_measurements (batch_id, abv, measurement_date, created_at, updated_at)
      VALUES ('${sr.id}', ${abvValue}, '2025-03-07', NOW(), NOW())
    `));
    console.log(`  ✓ Created measurement record: ABV=${abvValue}, date=2025-03-07`);
  } else {
    console.log(`  (measurement already exists, skipping)`);
  }

  // Verify
  console.log("\n--- Verification ---");
  const verify = await db.execute(sql.raw(`
    SELECT custom_name, parent_batch_id, actual_abv, vessel_id,
           CAST(initial_volume_liters AS NUMERIC) as init,
           CAST(current_volume_liters AS NUMERIC) as current,
           v.name as vessel_name
    FROM batches b
    LEFT JOIN vessels v ON b.vessel_id = v.id
    WHERE b.id = '${sr.id}'
  `));
  const v = (verify.rows as any[])[0];
  console.log(`  ${v.custom_name}:`);
  console.log(`    Init: ${parseFloat(v.init).toFixed(1)}L, Current: ${parseFloat(v.current).toFixed(1)}L`);
  console.log(`    Parent: ${v.parent_batch_id}`);
  console.log(`    ABV: ${v.actual_abv}`);
  console.log(`    Vessel: ${v.vessel_name} (${v.vessel_id})`);

  console.log("\n=== Done ===");
  process.exit(0);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
