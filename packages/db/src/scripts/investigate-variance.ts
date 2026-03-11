import { db } from "..";
import { sql } from "drizzle-orm";

async function main() {
  // ========== 1. TTB Opening Balance Configuration ==========
  console.log("=".repeat(80));
  console.log("1. TTB OPENING BALANCE CONFIGURATION");
  console.log("=".repeat(80));
  const settings = await db.execute(sql.raw(`
    SELECT ttb_opening_balance_date, ttb_opening_balances
    FROM organization_settings LIMIT 1
  `));
  for (const row of settings.rows as any[]) {
    console.log(`  Date: ${row.ttb_opening_balance_date}`);
    console.log(`  Balances: ${JSON.stringify(row.ttb_opening_balances, null, 2)}`);
  }

  // ========== 2. All Salish-related batches ==========
  console.log("\n" + "=".repeat(80));
  console.log("2. ALL SALISH-RELATED BATCHES");
  console.log("=".repeat(80));
  const salishBatches = await db.execute(sql.raw(`
    SELECT id, custom_name, name, product_type,
           CAST(initial_volume_liters AS TEXT) as init_vol,
           CAST(current_volume_liters AS TEXT) as current_vol,
           reconciliation_status, start_date, vessel_id,
           deleted_at, parent_batch_id, is_racking_derivative
    FROM batches
    WHERE custom_name ILIKE '%salish%' OR name ILIKE '%salish%'
    ORDER BY start_date
  `));
  console.log(`  Found ${salishBatches.rows.length} batches:`);
  for (const row of salishBatches.rows as any[]) {
    console.log(`\n  ID: ${row.id}`);
    console.log(`    custom_name: ${row.custom_name}`);
    console.log(`    name: ${row.name}`);
    console.log(`    product_type: ${row.product_type}`);
    console.log(`    init_vol: ${row.init_vol}`);
    console.log(`    current_vol: ${row.current_vol}`);
    console.log(`    reconciliation_status: ${row.reconciliation_status}`);
    console.log(`    start_date: ${row.start_date}`);
    console.log(`    vessel_id: ${row.vessel_id}`);
    console.log(`    deleted_at: ${row.deleted_at}`);
    console.log(`    parent_batch_id: ${row.parent_batch_id}`);
    console.log(`    is_racking_derivative: ${row.is_racking_derivative}`);
  }

  // ========== 3. Positive adjustments in 2025 ==========
  console.log("\n" + "=".repeat(80));
  console.log("3. INVENTORY GAINS SOURCE - POSITIVE ADJUSTMENTS IN 2025");
  console.log("=".repeat(80));
  const posAdj = await db.execute(sql.raw(`
    SELECT ba.id, b.custom_name, b.name,
           CAST(ba.adjustment_amount AS TEXT) as adjustment_amount,
           ba.reason, ba.adjustment_date
    FROM batch_volume_adjustments ba
    JOIN batches b ON ba.batch_id = b.id
    WHERE ba.deleted_at IS NULL
      AND CAST(ba.adjustment_amount AS DECIMAL) > 0
      AND ba.adjustment_date >= '2025-01-01' AND ba.adjustment_date <= '2025-12-31'
    ORDER BY ba.adjustment_date
  `));
  console.log(`  Found ${posAdj.rows.length} positive adjustments:`);
  for (const row of posAdj.rows as any[]) {
    console.log(`\n  ID: ${row.id}`);
    console.log(`    batch: ${row.custom_name || row.name}`);
    console.log(`    amount: ${row.adjustment_amount}`);
    console.log(`    reason: ${row.reason}`);
    console.log(`    date: ${row.adjustment_date}`);
  }

  // ========== 4. Keg fills with gallon units ==========
  console.log("\n" + "=".repeat(80));
  console.log("4. KEG FILLS WITH GALLON UNITS");
  console.log("=".repeat(80));
  const kegGal = await db.execute(sql.raw(`
    SELECT kf.id, b.custom_name,
           CAST(kf.volume_taken AS TEXT) as volume_taken,
           kf.volume_taken_unit,
           CAST(kf.loss AS TEXT) as loss,
           kf.loss_unit, kf.filled_at
    FROM keg_fills kf
    JOIN batches b ON kf.batch_id = b.id
    WHERE kf.voided_at IS NULL AND kf.deleted_at IS NULL
      AND (kf.volume_taken_unit = 'gal' OR kf.loss_unit = 'gal')
    ORDER BY kf.filled_at
  `));
  console.log(`  Found ${kegGal.rows.length} keg fills with gallon units:`);
  for (const row of kegGal.rows as any[]) {
    console.log(`\n  ID: ${row.id}`);
    console.log(`    batch: ${row.custom_name}`);
    console.log(`    volume_taken: ${row.volume_taken} ${row.volume_taken_unit}`);
    console.log(`    loss: ${row.loss} ${row.loss_unit}`);
    console.log(`    filled_at: ${row.filled_at}`);
  }

  // ========== 5. Bottle runs with gallon loss units ==========
  console.log("\n" + "=".repeat(80));
  console.log("5. BOTTLE RUNS WITH GALLON LOSS UNITS");
  console.log("=".repeat(80));
  const bottleGal = await db.execute(sql.raw(`
    SELECT br.id, b.custom_name,
           CAST(br.volume_taken_liters AS TEXT) as volume_taken_liters,
           CAST(br.loss AS TEXT) as loss,
           br.loss_unit, br.packaged_at
    FROM bottle_runs br
    JOIN batches b ON br.batch_id = b.id
    WHERE br.voided_at IS NULL
      AND br.loss_unit = 'gal'
    ORDER BY br.packaged_at
  `));
  console.log(`  Found ${bottleGal.rows.length} bottle runs with gallon loss units:`);
  for (const row of bottleGal.rows as any[]) {
    console.log(`\n  ID: ${row.id}`);
    console.log(`    batch: ${row.custom_name}`);
    console.log(`    volume_taken_liters: ${row.volume_taken_liters}`);
    console.log(`    loss: ${row.loss} ${row.loss_unit}`);
    console.log(`    packaged_at: ${row.packaged_at}`);
  }

  // ========== 6. Batches for tax class debug ==========
  console.log("\n" + "=".repeat(80));
  console.log("6. BATCHES WITH WINE/POMMEAU PRODUCT TYPE (TAX CLASS DEBUG)");
  console.log("=".repeat(80));
  const taxBatches = await db.execute(sql.raw(`
    SELECT b.id, b.custom_name, b.product_type,
           CAST(b.current_volume_liters AS TEXT) as current_vol,
           CAST(b.initial_volume_liters AS TEXT) as init_vol,
           b.reconciliation_status,
           CAST(b.actual_abv AS TEXT) as actual_abv,
           CAST(b.estimated_abv AS TEXT) as estimated_abv
    FROM batches b
    WHERE b.deleted_at IS NULL
      AND COALESCE(b.reconciliation_status, 'pending') NOT IN ('duplicate', 'excluded')
      AND b.product_type IN ('wine', 'pommeau')
    ORDER BY b.product_type, b.start_date
  `));
  console.log(`  Found ${taxBatches.rows.length} batches:`);
  for (const row of taxBatches.rows as any[]) {
    console.log(`\n  ID: ${row.id}`);
    console.log(`    custom_name: ${row.custom_name}`);
    console.log(`    product_type: ${row.product_type}`);
    console.log(`    current_vol: ${row.current_vol}`);
    console.log(`    init_vol: ${row.init_vol}`);
    console.log(`    reconciliation_status: ${row.reconciliation_status}`);
    console.log(`    actual_abv: ${row.actual_abv}`);
    console.log(`    estimated_abv: ${row.estimated_abv}`);
  }

  // ========== 7. Transfers involving Salish batches ==========
  console.log("\n" + "=".repeat(80));
  console.log("7. ALL TRANSFERS INVOLVING SALISH BATCHES");
  console.log("=".repeat(80));
  const salishXfers = await db.execute(sql.raw(`
    SELECT t.id,
           sb.custom_name as source_name, db.custom_name as dest_name,
           CAST(t.volume_transferred AS TEXT) as vol,
           t.transferred_at
    FROM batch_transfers t
    LEFT JOIN batches sb ON t.source_batch_id = sb.id
    LEFT JOIN batches db ON t.destination_batch_id = db.id
    WHERE t.deleted_at IS NULL
      AND (sb.custom_name ILIKE '%salish%' OR db.custom_name ILIKE '%salish%')
    ORDER BY t.transferred_at
  `));
  console.log(`  Found ${salishXfers.rows.length} transfers:`);
  for (const row of salishXfers.rows as any[]) {
    console.log(`\n  ID: ${row.id}`);
    console.log(`    source: ${row.source_name}`);
    console.log(`    dest: ${row.dest_name}`);
    console.log(`    volume: ${row.vol}`);
    console.log(`    transferred_at: ${row.transferred_at}`);
  }

  console.log("\n" + "=".repeat(80));
  console.log("INVESTIGATION COMPLETE");
  console.log("=".repeat(80));

  process.exit(0);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
