import { db } from "..";
import { sql } from "drizzle-orm";

async function main() {
  // Find all batches with carbonation operations
  const results = await db.execute(sql.raw(`
    SELECT b.id, b.custom_name, b.product_type, b.batch_number,
           b.actual_abv::numeric as abv, b.estimated_abv::numeric as est_abv,
           bco.final_co2_volumes::numeric as co2_volumes,
           bco.carbonation_process,
           b.status, b.reconciliation_status,
           CAST(b.current_volume_liters AS NUMERIC) as current_l
    FROM batch_carbonation_operations bco
    JOIN batches b ON bco.batch_id = b.id
    WHERE bco.deleted_at IS NULL
      AND bco.final_co2_volumes IS NOT NULL
      AND b.deleted_at IS NULL
    ORDER BY bco.completed_at DESC NULLS LAST, bco.created_at DESC
  `));

  console.log("=== Batches with Carbonation Operations ===\n");
  for (const r of results.rows as any[]) {
    const co2 = parseFloat(r.co2_volumes);
    const co2Grams = co2 * 0.1977; // co2VolumesToGramsPer100ml
    const abv = r.abv ? parseFloat(r.abv) : (r.est_abv ? parseFloat(r.est_abv) : null);
    
    // Determine if this would be classified as carbonatedWine
    const isHardCiderFruit = ['cider', 'perry'].includes(r.product_type);
    const hardCiderMaxCo2 = 0.392; // default threshold
    const stillWineMaxCo2 = 0.392;
    
    let taxClass: string;
    if (isHardCiderFruit && co2Grams <= hardCiderMaxCo2) {
      taxClass = "hardCider (3c safeguard)";
    } else if (co2Grams > stillWineMaxCo2) {
      taxClass = r.carbonation_process === 'bottle_conditioning' ? 'sparklingWine' : 'carbonatedWine';
    } else if (abv && abv <= 8.5 && isHardCiderFruit) {
      taxClass = "hardCider (3b)";
    } else {
      taxClass = "other";
    }
    
    console.log(`"${r.custom_name}" [${r.product_type}]`);
    console.log(`  CO2: ${co2.toFixed(2)} volumes (${co2Grams.toFixed(3)} g/100ml), Method: ${r.carbonation_process}`);
    console.log(`  ABV: ${abv ?? 'null'}, Current: ${parseFloat(r.current_l).toFixed(1)}L`);
    console.log(`  Status: ${r.status}, Recon: ${r.reconciliation_status}`);
    console.log(`  → Tax class: ${taxClass}`);
    console.log();
  }

  // Also check the hardCider max CO2 config threshold
  console.log("=== Thresholds ===");
  console.log("  Hard cider max CO2: 0.392 g/100ml = ~1.98 CO2 volumes");
  console.log("  Still wine max CO2: 0.392 g/100ml = ~1.98 CO2 volumes");
  console.log("  Any CO2 > 1.98 volumes on non-cider/perry → carbonatedWine or sparklingWine");
  console.log("  Any CO2 > hard cider limit on cider/perry → also carbonatedWine/sparklingWine (bypasses 3c)");

  process.exit(0);
}

main().catch((e) => { console.error(e); process.exit(1); });
