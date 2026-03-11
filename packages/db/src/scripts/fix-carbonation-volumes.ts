import { db } from "..";
import { sql } from "drizzle-orm";

async function main() {
  console.log("=== Fix Carbonation Volumes → 1.9 CO2 Volumes ===\n");

  // Show current state
  const before = await db.execute(sql.raw(`
    SELECT bco.id, bco.batch_id, bco.final_co2_volumes::numeric as co2,
           bco.carbonation_process, b.custom_name, b.product_type
    FROM batch_carbonation_operations bco
    JOIN batches b ON bco.batch_id = b.id
    WHERE bco.deleted_at IS NULL
      AND bco.final_co2_volumes IS NOT NULL
      AND b.deleted_at IS NULL
    ORDER BY b.custom_name, bco.created_at
  `));

  console.log(`Found ${before.rows.length} carbonation records to update:\n`);
  for (const r of before.rows as any[]) {
    const co2 = parseFloat(r.co2);
    console.log(`  "${r.custom_name}" [${r.product_type}]: ${co2.toFixed(2)} → 1.90 (${r.carbonation_process})`);
  }

  // Update all to 1.9
  const result = await db.execute(sql.raw(`
    UPDATE batch_carbonation_operations
    SET final_co2_volumes = 1.9,
        updated_at = NOW()
    WHERE deleted_at IS NULL
      AND final_co2_volumes IS NOT NULL
    RETURNING id
  `));

  console.log(`\n✓ Updated ${result.rows.length} carbonation records to 1.9 CO2 volumes`);

  // Verify
  const after = await db.execute(sql.raw(`
    SELECT DISTINCT bco.final_co2_volumes::numeric as co2
    FROM batch_carbonation_operations bco
    WHERE bco.deleted_at IS NULL
      AND bco.final_co2_volumes IS NOT NULL
  `));
  console.log(`\nVerification — distinct CO2 values: ${(after.rows as any[]).map((r: any) => parseFloat(r.co2).toFixed(2)).join(', ')}`);

  // Show new classification
  const co2Grams = 1.9 * 0.1977;
  console.log(`\n1.9 volumes = ${co2Grams.toFixed(4)} g/100ml (threshold: 0.3920)`);
  console.log(`All batches now UNDER the still wine threshold → no more "artificially carbonated" classification`);

  console.log("\n=== Done ===");
  process.exit(0);
}

main().catch((e) => { console.error(e); process.exit(1); });
