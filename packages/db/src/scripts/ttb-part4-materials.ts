import { db } from "..";
import { sql } from "drizzle-orm";

/**
 * TTB Form 5120.17 Part IV — "Summary of Materials Received and Used"
 *
 * Filing Period: 2025 (Jan 1 – Dec 31)
 * Cidery — columns (a)-(d) Grape Material are all 0.
 * Relevant: (e)(f)(g) Other Fruit (Pounds/Gallons), (h) Dry Sugar (Pounds), (i) Liquid Sugar (Gallons)
 *
 * Actual DB schema:
 *   basefruit_purchases/basefruit_purchase_items — fruit bought from vendors
 *   press_runs + press_run_loads — fruit pressed into juice (loads link to purchase items)
 *   juice_purchases/juice_purchase_items — juice bought (not pressed)
 *   additive_purchases/additive_purchase_items — sugar, honey, yeast, etc.
 *   batch_merge_history — juice merged into batches for fermentation
 *   batches — production batches with product_type and volume
 *   base_fruit_varieties — fruit variety reference with fruit_type (apple, pear, plum, quince, etc.)
 */

const PERIOD_START = "2025-01-01";
const PERIOD_END = "2025-12-31";

const KG_TO_LBS = 2.20462;
const LITERS_TO_GAL = 0.264172;

function fmtLbs(kg: number): string {
  return `${(kg * KG_TO_LBS).toFixed(1)} lbs`;
}
function fmtGal(liters: number): string {
  return `${(liters * LITERS_TO_GAL).toFixed(2)} gal`;
}
function n(val: any): number {
  return parseFloat(val || "0");
}

async function main() {
  console.log("╔══════════════════════════════════════════════════════════════════╗");
  console.log("║  TTB Form 5120.17 Part IV — Summary of Materials               ║");
  console.log("║  Filing Period: 2025 (Jan 1 – Dec 31)                           ║");
  console.log("╚══════════════════════════════════════════════════════════════════╝\n");

  // ═══════════════════════════════════════════════════════════════
  //  LINE 1: ON HAND — Beginning of Period
  // ═══════════════════════════════════════════════════════════════
  console.log("═══════════════════════════════════════════════════════════════");
  console.log("  LINE 1: ON HAND — Beginning of Period (Jan 1, 2025)");
  console.log("═══════════════════════════════════════════════════════════════\n");

  // --- Fruit on hand (beginning) ---
  // Check basefruit_purchase_items not yet depleted as of Jan 1 2025
  const fruitOnHandStart = await db.execute(sql.raw(`
    SELECT
      bfv.name as variety_name,
      bfv.fruit_type,
      SUM(CAST(COALESCE(bpi.quantity_kg, '0') AS NUMERIC)) as total_kg,
      COUNT(*) as item_count
    FROM basefruit_purchase_items bpi
    JOIN basefruit_purchases bp ON bp.id = bpi.purchase_id
    LEFT JOIN base_fruit_varieties bfv ON bfv.id = bpi.fruit_variety_id
    WHERE bp.purchase_date < '${PERIOD_START}'
      AND bp.deleted_at IS NULL
      AND bpi.deleted_at IS NULL
      AND (bpi.is_depleted = false OR bpi.depleted_at >= '${PERIOD_START}')
    GROUP BY bfv.name, bfv.fruit_type
    ORDER BY total_kg DESC
  `));

  let fruitOnHandStartKg = 0;
  if (fruitOnHandStart.rows.length > 0) {
    console.log("  Fruit on hand (purchased before 2025, not yet depleted):");
    for (const r of fruitOnHandStart.rows as any[]) {
      const kg = n(r.total_kg);
      fruitOnHandStartKg += kg;
      console.log(`    ${r.fruit_type || "?"} / ${r.variety_name || "?"}: ${kg.toFixed(1)} kg = ${fmtLbs(kg)} [${r.item_count} items]`);
    }
  } else {
    console.log("  No undepleted fruit from before 2025.");
  }
  console.log(`  FRUIT ON HAND (beginning): ${fruitOnHandStartKg.toFixed(1)} kg = ${fmtLbs(fruitOnHandStartKg)}\n`);

  // --- Juice on hand (beginning) ---
  // Unallocated juice_purchase_items from before 2025
  const jpOnHandStart = await db.execute(sql.raw(`
    SELECT
      jpi.variety_name, jpi.juice_type,
      CAST(COALESCE(jpi.volume, '0') AS NUMERIC) as total_vol,
      jpi.volume_unit,
      CAST(COALESCE(jpi.volume_allocated, '0') AS NUMERIC) as allocated
    FROM juice_purchase_items jpi
    JOIN juice_purchases jp ON jp.id = jpi.purchase_id
    WHERE jp.purchase_date < '${PERIOD_START}'
      AND jp.deleted_at IS NULL AND jpi.deleted_at IS NULL
    ORDER BY jp.purchase_date
  `));

  let juiceOnHandStartL = 0;
  if (jpOnHandStart.rows.length > 0) {
    for (const r of jpOnHandStart.rows as any[]) {
      const rem = n(r.total_vol) - n(r.allocated);
      const unit = r.volume_unit || "liters";
      const remL = unit === "gallons" ? rem / LITERS_TO_GAL : rem;
      if (rem > 0.1) {
        juiceOnHandStartL += remL;
        console.log(`  Juice purchase: ${r.variety_name || r.juice_type || "?"}: remaining ${rem.toFixed(1)} ${unit} (${fmtGal(remL)})`);
      }
    }
  }

  // Press run juice from pre-2025 not fully merged
  const preJuiceRemainder = await db.execute(sql.raw(`
    SELECT
      pr.press_run_name, pr.date_completed,
      CAST(COALESCE(pr.total_juice_volume_liters, '0') AS NUMERIC) as total_juice_l,
      COALESCE(SUM(CAST(COALESCE(bmh.volume_added, '0') AS NUMERIC)), 0) as merged_before_2025
    FROM press_runs pr
    LEFT JOIN batch_merge_history bmh ON bmh.source_press_run_id = pr.id
      AND bmh.merged_at < '${PERIOD_START}'
    WHERE pr.date_completed < '${PERIOD_START}'
      AND pr.deleted_at IS NULL
    GROUP BY pr.id, pr.press_run_name, pr.date_completed, pr.total_juice_volume_liters
    HAVING CAST(COALESCE(pr.total_juice_volume_liters, '0') AS NUMERIC)
           - COALESCE(SUM(CAST(COALESCE(bmh.volume_added, '0') AS NUMERIC)), 0) > 0.5
    ORDER BY pr.date_completed
  `));

  if (preJuiceRemainder.rows.length > 0) {
    console.log("\n  Press run juice from pre-2025 (not fully merged):");
    for (const r of preJuiceRemainder.rows as any[]) {
      const rem = n(r.total_juice_l) - n(r.merged_before_2025);
      juiceOnHandStartL += rem;
      console.log(`    ${r.press_run_name || r.date_completed}: ${rem.toFixed(1)} L (${fmtGal(rem)})`);
    }
  }
  console.log(`\n  JUICE ON HAND (beginning): ${juiceOnHandStartL.toFixed(1)} L = ${fmtGal(juiceOnHandStartL)}`);

  // ═══════════════════════════════════════════════════════════════
  //  LINE 2: RECEIVED — Materials Purchased
  // ═══════════════════════════════════════════════════════════════
  console.log("\n═══════════════════════════════════════════════════════════════");
  console.log("  LINE 2: RECEIVED — Fruit & Juice Purchased During 2025");
  console.log("═══════════════════════════════════════════════════════════════\n");

  // --- 2a. FRUIT RECEIVED by type (from basefruit_purchase_items) ---
  console.log("  --- FRUIT RECEIVED (basefruit_purchase_items) by variety/fruit_type ---\n");
  const fruitReceived = await db.execute(sql.raw(`
    SELECT
      bfv.fruit_type,
      bfv.name as variety_name,
      SUM(CAST(COALESCE(bpi.quantity_kg, '0') AS NUMERIC)) as total_kg,
      SUM(CAST(COALESCE(bpi.total_cost, '0') AS NUMERIC)) as total_cost,
      COUNT(*) as item_count
    FROM basefruit_purchase_items bpi
    JOIN basefruit_purchases bp ON bp.id = bpi.purchase_id
    LEFT JOIN base_fruit_varieties bfv ON bfv.id = bpi.fruit_variety_id
    WHERE bp.purchase_date >= '${PERIOD_START}'
      AND bp.purchase_date <= '${PERIOD_END}'
      AND bp.deleted_at IS NULL
      AND bpi.deleted_at IS NULL
    GROUP BY bfv.fruit_type, bfv.name
    ORDER BY bfv.fruit_type, total_kg DESC
  `));

  let totalFruitReceivedKg = 0;
  const fruitByType: Record<string, number> = {}; // fruit_type → kg
  if (fruitReceived.rows.length > 0) {
    for (const r of fruitReceived.rows as any[]) {
      const kg = n(r.total_kg);
      totalFruitReceivedKg += kg;
      const ft = (r.fruit_type || "unknown").toLowerCase();
      fruitByType[ft] = (fruitByType[ft] || 0) + kg;
      console.log(
        `    ${r.fruit_type || "?"} / ${r.variety_name || "?"}: ${kg.toFixed(1)} kg = ${fmtLbs(kg)} | $${n(r.total_cost).toFixed(2)} [${r.item_count} items]`
      );
    }
    console.log(`\n  TOTAL FRUIT RECEIVED: ${totalFruitReceivedKg.toFixed(1)} kg = ${fmtLbs(totalFruitReceivedKg)}`);
    console.log("\n  Breakdown by fruit type:");
    for (const [ft, kg] of Object.entries(fruitByType).sort((a, b) => b[1] - a[1])) {
      console.log(`    ${ft}: ${kg.toFixed(1)} kg = ${fmtLbs(kg)}`);
    }
  } else {
    console.log("    No fruit purchases found in 2025.");
  }

  // Cross-check: press_runs total_apple_weight_kg
  const pressRunTotals = await db.execute(sql.raw(`
    SELECT
      SUM(CAST(COALESCE(pr.total_apple_weight_kg, '0') AS NUMERIC)) as total_kg
    FROM press_runs pr
    WHERE pr.date_completed >= '${PERIOD_START}'
      AND pr.date_completed <= '${PERIOD_END}'
      AND pr.deleted_at IS NULL
  `));
  const pressRunTotalKg = n((pressRunTotals.rows[0] as any).total_kg);
  console.log(`\n  Cross-check: press_runs.total_apple_weight_kg sum = ${pressRunTotalKg.toFixed(1)} kg = ${fmtLbs(pressRunTotalKg)}`);

  // Also get total from press_run_loads
  const loadTotals = await db.execute(sql.raw(`
    SELECT
      SUM(CAST(COALESCE(prl.apple_weight_kg, '0') AS NUMERIC)) as total_kg,
      COUNT(*) as load_count
    FROM press_run_loads prl
    JOIN press_runs pr ON pr.id = prl.press_run_id
    WHERE pr.date_completed >= '${PERIOD_START}'
      AND pr.date_completed <= '${PERIOD_END}'
      AND pr.deleted_at IS NULL
      AND prl.deleted_at IS NULL
  `));
  const loadTotalKg = n((loadTotals.rows[0] as any).total_kg);
  console.log(`  Cross-check: press_run_loads.apple_weight_kg sum = ${loadTotalKg.toFixed(1)} kg = ${fmtLbs(loadTotalKg)} [${(loadTotals.rows[0] as any).load_count} loads]`);

  // press_run_loads breakdown by fruit type
  console.log("\n  --- FRUIT PRESSED by type (from press_run_loads → base_fruit_varieties) ---\n");
  const loadsByFruit = await db.execute(sql.raw(`
    SELECT
      bfv.fruit_type,
      bfv.name as variety_name,
      SUM(CAST(COALESCE(prl.apple_weight_kg, '0') AS NUMERIC)) as total_kg,
      COUNT(*) as load_count
    FROM press_run_loads prl
    JOIN press_runs pr ON pr.id = prl.press_run_id
    LEFT JOIN base_fruit_varieties bfv ON bfv.id = prl.fruit_variety_id
    WHERE pr.date_completed >= '${PERIOD_START}'
      AND pr.date_completed <= '${PERIOD_END}'
      AND pr.deleted_at IS NULL
      AND prl.deleted_at IS NULL
    GROUP BY bfv.fruit_type, bfv.name
    ORDER BY bfv.fruit_type, total_kg DESC
  `));

  const pressedByType: Record<string, number> = {};
  if (loadsByFruit.rows.length > 0) {
    for (const r of loadsByFruit.rows as any[]) {
      const kg = n(r.total_kg);
      const ft = (r.fruit_type || "unknown").toLowerCase();
      pressedByType[ft] = (pressedByType[ft] || 0) + kg;
      console.log(`    ${r.fruit_type || "?"} / ${r.variety_name || "?"}: ${kg.toFixed(1)} kg = ${fmtLbs(kg)} [${r.load_count} loads]`);
    }
    console.log("\n  Pressed by fruit type:");
    for (const [ft, kg] of Object.entries(pressedByType).sort((a, b) => b[1] - a[1])) {
      console.log(`    ${ft}: ${kg.toFixed(1)} kg = ${fmtLbs(kg)}`);
    }
  }

  // --- 2b. JUICE RECEIVED (purchased, not pressed) ---
  console.log("\n  --- JUICE RECEIVED (juice_purchase_items) ---\n");
  const juicePurchased = await db.execute(sql.raw(`
    SELECT
      jpi.variety_name, jpi.juice_type,
      CAST(COALESCE(jpi.volume, '0') AS NUMERIC) as volume,
      jpi.volume_unit,
      CAST(COALESCE(jpi.total_cost, '0') AS NUMERIC) as cost,
      jp.purchase_date,
      vend.name as vendor_name
    FROM juice_purchase_items jpi
    JOIN juice_purchases jp ON jp.id = jpi.purchase_id
    LEFT JOIN vendors vend ON vend.id = jp.vendor_id
    WHERE jp.purchase_date >= '${PERIOD_START}'
      AND jp.purchase_date <= '${PERIOD_END}'
      AND jp.deleted_at IS NULL AND jpi.deleted_at IS NULL
    ORDER BY jp.purchase_date
  `));

  let totalJuicePurchasedL = 0;
  if (juicePurchased.rows.length > 0) {
    for (const r of juicePurchased.rows as any[]) {
      const vol = n(r.volume);
      const unit = r.volume_unit || "liters";
      const volL = unit === "gallons" ? vol / LITERS_TO_GAL : vol;
      totalJuicePurchasedL += volL;
      console.log(
        `    ${r.purchase_date} | ${r.variety_name || r.juice_type || "?"} | ` +
          `Vendor: ${r.vendor_name || "?"} | ${vol.toFixed(1)} ${unit} (${fmtGal(volL)}) | $${n(r.cost).toFixed(2)}`
      );
    }
  } else {
    console.log("    No juice purchases in 2025.");
  }
  console.log(`\n  TOTAL JUICE PURCHASED: ${totalJuicePurchasedL.toFixed(1)} L = ${fmtGal(totalJuicePurchasedL)}`);

  // ═══════════════════════════════════════════════════════════════
  //  LINE 3: JUICE / CONCENTRATE PRODUCED
  // ═══════════════════════════════════════════════════════════════
  console.log("\n═══════════════════════════════════════════════════════════════");
  console.log("  LINE 3: JUICE / CONCENTRATE PRODUCED (Press Runs in 2025)");
  console.log("═══════════════════════════════════════════════════════════════\n");

  const pressRuns = await db.execute(sql.raw(`
    SELECT
      pr.press_run_name, pr.date_completed,
      CAST(COALESCE(pr.total_apple_weight_kg, '0') AS NUMERIC) as fruit_kg,
      CAST(COALESCE(pr.total_juice_volume_liters, '0') AS NUMERIC) as juice_l,
      CAST(COALESCE(pr.extraction_rate, '0') AS NUMERIC) as yield_pct
    FROM press_runs pr
    WHERE pr.date_completed >= '${PERIOD_START}'
      AND pr.date_completed <= '${PERIOD_END}'
      AND pr.deleted_at IS NULL
      AND CAST(COALESCE(pr.total_juice_volume_liters, '0') AS NUMERIC) > 0
    ORDER BY pr.date_completed
  `));

  let totalJuiceProducedL = 0;
  if (pressRuns.rows.length > 0) {
    for (const r of pressRuns.rows as any[]) {
      const jL = n(r.juice_l);
      totalJuiceProducedL += jL;
      console.log(
        `    ${r.date_completed} | ${r.press_run_name} | ` +
          `Fruit: ${n(r.fruit_kg).toFixed(0)} kg → Juice: ${jL.toFixed(1)} L (${fmtGal(jL)}) | ` +
          `Yield: ${(n(r.yield_pct) * 100).toFixed(1)}%`
      );
    }
  } else {
    console.log("    No press runs with juice output in 2025.");
  }

  // Also count press runs with 0 juice (may have loads but no juice recorded yet)
  const zeroJuiceRuns = await db.execute(sql.raw(`
    SELECT COUNT(*) as cnt
    FROM press_runs pr
    WHERE pr.date_completed >= '${PERIOD_START}'
      AND pr.date_completed <= '${PERIOD_END}'
      AND pr.deleted_at IS NULL
      AND CAST(COALESCE(pr.total_juice_volume_liters, '0') AS NUMERIC) = 0
  `));
  const zeroJuiceCnt = n((zeroJuiceRuns.rows[0] as any).cnt);
  if (zeroJuiceCnt > 0) {
    console.log(`\n  NOTE: ${zeroJuiceCnt} press runs in 2025 have 0 juice_volume_liters (may be load-level only or incomplete).`);
  }

  console.log(`\n  TOTAL JUICE PRODUCED: ${totalJuiceProducedL.toFixed(1)} L = ${fmtGal(totalJuiceProducedL)}`);

  // ═══════════════════════════════════════════════════════════════
  //  LINE 5: USED FOR WINE PRODUCTION
  // ═══════════════════════════════════════════════════════════════
  console.log("\n═══════════════════════════════════════════════════════════════");
  console.log("  LINE 5: USED FOR WINE PRODUCTION");
  console.log("═══════════════════════════════════════════════════════════════\n");

  // Fruit used = all fruit pressed (fruit goes directly into pressing = production)
  console.log(`  FRUIT USED: ${totalFruitReceivedKg.toFixed(1)} kg = ${fmtLbs(totalFruitReceivedKg)}`);
  console.log("  (All fruit purchased is pressed for cider production)\n");

  // Juice used = juice merged into batches during 2025
  console.log("  --- Pressed juice merged into batches ---\n");
  const mergesFromPress = await db.execute(sql.raw(`
    SELECT
      b.custom_name as batch_name, b.product_type,
      pr.press_run_name,
      CAST(COALESCE(bmh.volume_added, '0') AS NUMERIC) as volume_l,
      bmh.merged_at
    FROM batch_merge_history bmh
    JOIN batches b ON b.id = bmh.target_batch_id
    LEFT JOIN press_runs pr ON pr.id = bmh.source_press_run_id
    WHERE bmh.source_press_run_id IS NOT NULL
      AND bmh.merged_at >= '${PERIOD_START}'
      AND bmh.merged_at <= '${PERIOD_END} 23:59:59'
    ORDER BY bmh.merged_at
  `));

  let totalPressJuiceUsedL = 0;
  if (mergesFromPress.rows.length > 0) {
    for (const r of mergesFromPress.rows as any[]) {
      const vol = n(r.volume_l);
      totalPressJuiceUsedL += vol;
      console.log(
        `    ${r.merged_at} | ${r.batch_name} (${r.product_type || "cider"}) ← Press: ${r.press_run_name || "?"} | ${vol.toFixed(1)} L (${fmtGal(vol)})`
      );
    }
  } else {
    console.log("    No press-run juice merges in 2025.");
  }
  console.log(`  Subtotal (pressed juice used): ${totalPressJuiceUsedL.toFixed(1)} L = ${fmtGal(totalPressJuiceUsedL)}`);

  console.log("\n  --- Purchased juice merged into batches ---\n");
  const mergesFromJP = await db.execute(sql.raw(`
    SELECT
      b.custom_name as batch_name, b.product_type,
      jpi.variety_name, jpi.juice_type,
      CAST(COALESCE(bmh.volume_added, '0') AS NUMERIC) as volume_l,
      bmh.merged_at
    FROM batch_merge_history bmh
    JOIN batches b ON b.id = bmh.target_batch_id
    LEFT JOIN juice_purchase_items jpi ON jpi.id = bmh.source_juice_purchase_item_id
    WHERE bmh.source_juice_purchase_item_id IS NOT NULL
      AND bmh.merged_at >= '${PERIOD_START}'
      AND bmh.merged_at <= '${PERIOD_END} 23:59:59'
    ORDER BY bmh.merged_at
  `));

  let totalJPJuiceUsedL = 0;
  if (mergesFromJP.rows.length > 0) {
    for (const r of mergesFromJP.rows as any[]) {
      const vol = n(r.volume_l);
      totalJPJuiceUsedL += vol;
      console.log(
        `    ${r.merged_at} | ${r.batch_name} (${r.product_type || "cider"}) ← Juice: ${r.variety_name || r.juice_type || "?"} | ${vol.toFixed(1)} L (${fmtGal(vol)})`
      );
    }
  } else {
    console.log("    No juice-purchase merges in 2025.");
  }
  console.log(`  Subtotal (purchased juice used): ${totalJPJuiceUsedL.toFixed(1)} L = ${fmtGal(totalJPJuiceUsedL)}`);

  const totalJuiceUsedL = totalPressJuiceUsedL + totalJPJuiceUsedL;
  console.log(`\n  TOTAL JUICE USED IN PRODUCTION: ${totalJuiceUsedL.toFixed(1)} L = ${fmtGal(totalJuiceUsedL)}`);

  // ═══════════════════════════════════════════════════════════════
  //  SUGAR & OTHER ADDITIONS (Columns h, i)
  // ═══════════════════════════════════════════════════════════════
  console.log("\n═══════════════════════════════════════════════════════════════");
  console.log("  SUGAR & OTHER ADDITIONS (Columns h, i)");
  console.log("═══════════════════════════════════════════════════════════════\n");

  // Check additive_purchases / additive_purchase_items
  const additives = await db.execute(sql.raw(`
    SELECT
      av.name as additive_name,
      av.item_type,
      api.additive_type,
      api.product_name,
      api.quantity,
      api.unit,
      CAST(COALESCE(api.quantity_used, '0') AS NUMERIC) as qty_used,
      CAST(COALESCE(api.total_cost, '0') AS NUMERIC) as cost,
      ap.purchase_date,
      vend.name as vendor_name
    FROM additive_purchase_items api
    JOIN additive_purchases ap ON ap.id = api.purchase_id
    LEFT JOIN additive_varieties av ON av.id = api.additive_variety_id
    LEFT JOIN vendors vend ON vend.id = ap.vendor_id
    WHERE ap.purchase_date >= '${PERIOD_START}'
      AND ap.purchase_date <= '${PERIOD_END}'
      AND ap.deleted_at IS NULL AND api.deleted_at IS NULL
    ORDER BY ap.purchase_date, api.additive_type
  `));

  let sugarDryKg = 0;
  let sugarLiquidL = 0;
  let honeyKg = 0;

  if (additives.rows.length > 0) {
    console.log("  Additive purchases in 2025:");
    for (const r of additives.rows as any[]) {
      const qty = n(r.quantity);
      const used = n(r.qty_used);
      const type = (r.additive_type || r.item_type || "").toLowerCase();
      const name = r.product_name || r.additive_name || "?";
      const unit = r.unit || "?";

      // Classify for TTB columns
      const isSugar = type.includes("sugar") || name.toLowerCase().includes("sugar") || name.toLowerCase().includes("dextrose");
      const isHoney = type.includes("honey") || name.toLowerCase().includes("honey");
      const isLiquid = unit === "liters" || unit === "gallons" || unit === "L" || unit === "gal"
        || name.toLowerCase().includes("liquid") || name.toLowerCase().includes("syrup");

      if (isSugar && !isLiquid) {
        // Dry sugar — convert to kg if in lbs/grams
        const kgVal = unit === "lbs" || unit === "lb" ? qty / KG_TO_LBS
          : unit === "g" || unit === "grams" ? qty / 1000
            : qty; // assume kg
        sugarDryKg += kgVal;
      } else if (isSugar && isLiquid) {
        const lVal = unit === "gallons" || unit === "gal" ? qty / LITERS_TO_GAL : qty;
        sugarLiquidL += lVal;
      } else if (isHoney) {
        const kgVal = unit === "lbs" || unit === "lb" ? qty / KG_TO_LBS
          : unit === "g" || unit === "grams" ? qty / 1000
            : qty;
        honeyKg += kgVal;
      }

      console.log(
        `    ${r.purchase_date} | ${r.additive_type || "?"} | ${name} | ` +
          `Qty: ${qty} ${unit} (used: ${used}) | ` +
          `Vendor: ${r.vendor_name || "?"} | $${n(r.cost).toFixed(2)}`
      );
    }

    console.log(`\n  Sugar (dry) purchased: ${sugarDryKg.toFixed(1)} kg = ${fmtLbs(sugarDryKg)}`);
    console.log(`  Sugar (liquid) purchased: ${sugarLiquidL.toFixed(1)} L = ${fmtGal(sugarLiquidL)}`);
    if (honeyKg > 0) {
      console.log(`  Honey purchased: ${honeyKg.toFixed(1)} kg = ${fmtLbs(honeyKg)} (report as "Other" or classify per TTB guidance)`);
    }
  } else {
    console.log("  No additive purchases found in 2025.");
    console.log("  Column (h) Dry Sugar = 0 lbs");
    console.log("  Column (i) Liquid Sugar = 0 gal");
  }

  // ═══════════════════════════════════════════════════════════════
  //  LINE 8: REMOVED — Juice/Fruit Given Away or Disposed
  // ═══════════════════════════════════════════════════════════════
  console.log("\n═══════════════════════════════════════════════════════════════");
  console.log("  LINE 8: REMOVED — Juice/Fruit Given Away or Disposed");
  console.log("═══════════════════════════════════════════════════════════════\n");

  // Juice-type batches (product_type='juice') — e.g. "Juice for Community"
  const juiceBatches = await db.execute(sql.raw(`
    SELECT
      b.custom_name, b.batch_number, b.start_date,
      CAST(COALESCE(b.initial_volume_liters, '0') AS NUMERIC) as initial_l,
      CAST(COALESCE(b.current_volume_liters, '0') AS NUMERIC) as current_l
    FROM batches b
    WHERE b.deleted_at IS NULL
      AND b.product_type = 'juice'
      AND b.start_date >= '${PERIOD_START}'
      AND b.start_date <= '${PERIOD_END}'
    ORDER BY b.start_date
  `));

  let totalJuiceRemovedL = 0;
  if (juiceBatches.rows.length > 0) {
    console.log("  Juice batches (product_type = 'juice') created in 2025:");
    for (const r of juiceBatches.rows as any[]) {
      const init = n(r.initial_l);
      const curr = n(r.current_l);
      const used = init - curr;
      totalJuiceRemovedL += Math.max(used, 0);
      console.log(
        `    ${r.start_date} | ${r.custom_name || r.batch_number} | ` +
          `Initial: ${init.toFixed(1)} L → Current: ${curr.toFixed(1)} L | ` +
          `Given away: ${used.toFixed(1)} L (${fmtGal(used)})`
      );
    }
  } else {
    console.log("  No juice batches in 2025.");
  }

  // Negative volume adjustments on any batch
  const negAdj = await db.execute(sql.raw(`
    SELECT
      b.custom_name, b.batch_number, b.product_type,
      CAST(bva.adjustment_amount AS NUMERIC) as adj_l,
      bva.reason, bva.created_at
    FROM batch_volume_adjustments bva
    JOIN batches b ON b.id = bva.batch_id
    WHERE bva.created_at >= '${PERIOD_START}'
      AND bva.created_at <= '${PERIOD_END} 23:59:59'
      AND bva.deleted_at IS NULL
      AND CAST(bva.adjustment_amount AS NUMERIC) < 0
    ORDER BY bva.created_at
  `));

  if (negAdj.rows.length > 0) {
    console.log("\n  Negative volume adjustments in 2025 (possible disposals):");
    for (const r of negAdj.rows as any[]) {
      const adj = n(r.adj_l);
      console.log(
        `    ${r.created_at} | ${r.custom_name || r.batch_number} (${r.product_type || "cider"}) | ` +
          `${adj.toFixed(1)} L (${fmtGal(Math.abs(adj))}) | ${r.reason || "N/A"}`
      );
    }
  } else {
    console.log("\n  No negative volume adjustments in 2025.");
  }

  console.log(`\n  JUICE REMOVED: ${totalJuiceRemovedL.toFixed(1)} L = ${fmtGal(totalJuiceRemovedL)}`);

  // ═══════════════════════════════════════════════════════════════
  //  LINE 9: ON HAND — End of Period
  // ═══════════════════════════════════════════════════════════════
  console.log("\n═══════════════════════════════════════════════════════════════");
  console.log("  LINE 9: ON HAND — End of Period (Dec 31, 2025)");
  console.log("═══════════════════════════════════════════════════════════════\n");

  // Fruit on hand end — undepleted basefruit_purchase_items
  const fruitOnHandEnd = await db.execute(sql.raw(`
    SELECT
      bfv.fruit_type, bfv.name as variety_name,
      SUM(CAST(COALESCE(bpi.quantity_kg, '0') AS NUMERIC)) as total_kg,
      COUNT(*) as item_count
    FROM basefruit_purchase_items bpi
    JOIN basefruit_purchases bp ON bp.id = bpi.purchase_id
    LEFT JOIN base_fruit_varieties bfv ON bfv.id = bpi.fruit_variety_id
    WHERE bp.purchase_date <= '${PERIOD_END}'
      AND bp.deleted_at IS NULL AND bpi.deleted_at IS NULL
      AND (bpi.is_depleted = false OR bpi.depleted_at > '${PERIOD_END}')
    GROUP BY bfv.fruit_type, bfv.name
    ORDER BY total_kg DESC
  `));

  let fruitOnHandEndKg = 0;
  if (fruitOnHandEnd.rows.length > 0) {
    console.log("  Undepleted fruit at end of 2025:");
    for (const r of fruitOnHandEnd.rows as any[]) {
      const kg = n(r.total_kg);
      fruitOnHandEndKg += kg;
      console.log(`    ${r.fruit_type || "?"} / ${r.variety_name || "?"}: ${kg.toFixed(1)} kg = ${fmtLbs(kg)} [${r.item_count} items]`);
    }
  } else {
    console.log("  No undepleted fruit at end of 2025.");
  }
  console.log(`  FRUIT ON HAND (end): ${fruitOnHandEndKg.toFixed(1)} kg = ${fmtLbs(fruitOnHandEndKg)}\n`);

  // Juice on hand end — unallocated juice_purchase_items
  const jpOnHandEnd = await db.execute(sql.raw(`
    SELECT
      jpi.variety_name, jpi.juice_type,
      CAST(COALESCE(jpi.volume, '0') AS NUMERIC) as total_vol,
      jpi.volume_unit,
      CAST(COALESCE(jpi.volume_allocated, '0') AS NUMERIC) as allocated,
      jp.purchase_date
    FROM juice_purchase_items jpi
    JOIN juice_purchases jp ON jp.id = jpi.purchase_id
    WHERE jp.purchase_date <= '${PERIOD_END}'
      AND jp.deleted_at IS NULL AND jpi.deleted_at IS NULL
    ORDER BY jp.purchase_date
  `));

  let juiceOnHandEndL = 0;
  if (jpOnHandEnd.rows.length > 0) {
    console.log("  Unallocated juice purchase items:");
    for (const r of jpOnHandEnd.rows as any[]) {
      const rem = n(r.total_vol) - n(r.allocated);
      const unit = r.volume_unit || "liters";
      const remL = unit === "gallons" ? rem / LITERS_TO_GAL : rem;
      if (rem > 0.1) {
        juiceOnHandEndL += remL;
        console.log(`    ${r.purchase_date} | ${r.variety_name || r.juice_type || "?"}: remaining ${rem.toFixed(1)} ${unit} (${fmtGal(remL)})`);
      }
    }
  }

  // Press run juice not merged by end of 2025
  const unmergedEnd = await db.execute(sql.raw(`
    SELECT
      pr.press_run_name, pr.date_completed,
      CAST(COALESCE(pr.total_juice_volume_liters, '0') AS NUMERIC) as total_juice_l,
      COALESCE(SUM(CAST(COALESCE(bmh.volume_added, '0') AS NUMERIC)), 0) as total_merged
    FROM press_runs pr
    LEFT JOIN batch_merge_history bmh ON bmh.source_press_run_id = pr.id
      AND bmh.merged_at <= '${PERIOD_END} 23:59:59'
    WHERE pr.date_completed <= '${PERIOD_END}'
      AND pr.deleted_at IS NULL
    GROUP BY pr.id, pr.press_run_name, pr.date_completed, pr.total_juice_volume_liters
    HAVING CAST(COALESCE(pr.total_juice_volume_liters, '0') AS NUMERIC)
           - COALESCE(SUM(CAST(COALESCE(bmh.volume_added, '0') AS NUMERIC)), 0) > 0.5
    ORDER BY pr.date_completed
  `));

  if (unmergedEnd.rows.length > 0) {
    console.log("\n  Press run juice not yet merged by end of 2025:");
    for (const r of unmergedEnd.rows as any[]) {
      const rem = n(r.total_juice_l) - n(r.total_merged);
      juiceOnHandEndL += rem;
      console.log(`    ${r.press_run_name || r.date_completed}: ${rem.toFixed(1)} L (${fmtGal(rem)})`);
    }
  }

  console.log(`\n  JUICE ON HAND (end): ${juiceOnHandEndL.toFixed(1)} L = ${fmtGal(juiceOnHandEndL)}`);

  // ═══════════════════════════════════════════════════════════════
  //  FINAL SUMMARY TABLE
  // ═══════════════════════════════════════════════════════════════
  console.log("\n\n╔══════════════════════════════════════════════════════════════════════════════════════════════════╗");
  console.log("║  TTB FORM 5120.17 PART IV — COMPUTED SUMMARY                                                    ║");
  console.log("╚══════════════════════════════════════════════════════════════════════════════════════════════════╝\n");

  console.log("  Grape Material cols (a)-(d): ALL ZERO (cidery, not winery)\n");

  // Convert everything to display units
  const fruitStartLbs = fruitOnHandStartKg * KG_TO_LBS;
  const fruitReceivedLbs = totalFruitReceivedKg * KG_TO_LBS;
  const fruitUsedLbs = fruitReceivedLbs; // all received fruit is pressed
  const fruitEndLbs = fruitOnHandEndKg * KG_TO_LBS;

  const juiceStartGal = juiceOnHandStartL * LITERS_TO_GAL;
  const juicePurchasedGal = totalJuicePurchasedL * LITERS_TO_GAL;
  const juiceProducedGal = totalJuiceProducedL * LITERS_TO_GAL;
  const juiceUsedGal = totalJuiceUsedL * LITERS_TO_GAL;
  const juiceRemovedGal = totalJuiceRemovedL * LITERS_TO_GAL;
  const juiceEndGal = juiceOnHandEndL * LITERS_TO_GAL;

  const sugarDryLbs = sugarDryKg * KG_TO_LBS;
  const sugarLiquidGal = sugarLiquidL * LITERS_TO_GAL;

  // Totals
  const line4Fruit = fruitStartLbs + fruitReceivedLbs;
  const line4Juice = juiceStartGal + juicePurchasedGal + juiceProducedGal;
  const line7Fruit = fruitUsedLbs + 0; // L5 + L6
  const line7Juice = juiceUsedGal + 0;
  const line10Fruit = line7Fruit + 0 + fruitEndLbs; // L7 + L8 + L9
  const line10Juice = line7Juice + juiceRemovedGal + juiceEndGal;

  const p = (v: number, w: number = 10) => v.toFixed(1).padStart(w);
  const pg = (v: number, w: number = 10) => v.toFixed(2).padStart(w);

  console.log("                                  Other Fruit    Juice       Dry Sugar   Liquid Sugar");
  console.log("                                  (e)(f)(g)      (e)(f)(g)   (h)         (i)         ");
  console.log("                                  Pounds         Gallons     Pounds      Gallons     ");
  console.log("  ─────────────────────────────────────────────────────────────────────────────────");
  console.log(`  L1  On hand beginning          ${p(fruitStartLbs)}  ${pg(juiceStartGal)}  ${p(0)}  ${pg(0)}`);
  console.log(`  L2  Received                   ${p(fruitReceivedLbs)}  ${pg(juicePurchasedGal)}  ${p(sugarDryLbs)}  ${pg(sugarLiquidGal)}`);
  console.log(`  L3  Juice/conc produced         ${p(0, 10)}  ${pg(juiceProducedGal)}  ${p(0, 10)}  ${pg(0)}`);
  console.log(`  L4  TOTAL (L1+L2+L3)           ${p(line4Fruit)}  ${pg(line4Juice)}  ${p(sugarDryLbs)}  ${pg(sugarLiquidGal)}`);
  console.log("  ─────────────────────────────────────────────────────────────────────────────────");
  console.log(`  L5  Used for wine production   ${p(fruitUsedLbs)}  ${pg(juiceUsedGal)}  ${p(sugarDryLbs)}  ${pg(sugarLiquidGal)}`);
  console.log(`  L6  Used for other purposes    ${p(0)}  ${pg(0)}  ${p(0)}  ${pg(0)}`);
  console.log(`  L7  Total used (L5+L6)         ${p(line7Fruit)}  ${pg(line7Juice)}  ${p(sugarDryLbs)}  ${pg(sugarLiquidGal)}`);
  console.log(`  L8  Removed                    ${p(0)}  ${pg(juiceRemovedGal)}  ${p(0)}  ${pg(0)}`);
  console.log(`  L9  On hand end                ${p(fruitEndLbs)}  ${pg(juiceEndGal)}  ${p(0)}  ${pg(0)}`);
  console.log(`  L10 TOTAL (L7+L8+L9)           ${p(line10Fruit)}  ${pg(line10Juice)}  ${p(sugarDryLbs)}  ${pg(sugarLiquidGal)}`);
  console.log("  ─────────────────────────────────────────────────────────────────────────────────");

  // Balance check
  const fruitDiff = line4Fruit - line10Fruit;
  const juiceDiff = line4Juice - line10Juice;
  console.log(`\n  Balance check (L4 should equal L10):`);
  console.log(`    Fruit: L4=${line4Fruit.toFixed(1)} - L10=${line10Fruit.toFixed(1)} = ${fruitDiff.toFixed(1)} lbs`);
  console.log(`    Juice: L4=${line4Juice.toFixed(2)} - L10=${line10Juice.toFixed(2)} = ${juiceDiff.toFixed(2)} gal`);

  if (Math.abs(fruitDiff) > 0.5 || Math.abs(juiceDiff) > 0.5) {
    console.log("\n  WARNING: Imbalance detected. Possible causes:");
    if (Math.abs(fruitDiff) > 0.5) {
      console.log(`    - Fruit: ${fruitDiff.toFixed(1)} lbs unaccounted (on-hand-start + received != used + end)`);
    }
    if (Math.abs(juiceDiff) > 0.5) {
      console.log(`    - Juice: ${juiceDiff.toFixed(2)} gal unaccounted`);
      console.log("      Likely cause: juice from press runs directly created batches (origin_press_run_id)");
      console.log("      without going through batch_merge_history. These batches' initial_volume_liters");
      console.log("      represents juice consumed but not tracked as a merge.");
    }
  } else {
    console.log("    Balanced.");
  }

  // Fruit type breakdown for columns (e), (f), (g)
  console.log("\n  ─── FRUIT TYPE BREAKDOWN for Columns (e), (f), (g) ───\n");
  console.log("  TTB 5120.17 Part IV columns (e)(f)(g) are for 'Kinds of Materials Other Than Grape'.");
  console.log("  Each distinct fruit type gets its own sub-column.\n");

  const allFruitTypes = { ...fruitByType };
  for (const [ft, kg] of Object.entries(allFruitTypes).sort((a, b) => b[1] - a[1])) {
    const lbsVal = kg * KG_TO_LBS;
    console.log(`    ${ft.charAt(0).toUpperCase() + ft.slice(1)}: ${lbsVal.toFixed(1)} lbs (${kg.toFixed(1)} kg)`);
  }

  console.log("\n  NOTES:");
  console.log("  - Columns (a)-(d) Grape Material = 0 for all lines (cidery)");
  console.log("  - Fruit received = basefruit_purchase_items purchased in 2025");
  console.log("  - Juice produced = press_runs.total_juice_volume_liters in 2025");
  console.log("  - Juice used = batch_merge_history merges from press_runs + juice_purchases in 2025");
  console.log("  - Juice removed = 'Juice for Community' batch (product_type='juice', 520L given away)");
  console.log("  - Juice on hand = unmerged press run juice + unallocated juice purchase volume");
  console.log("  - Sugar tracking via additive_purchases/additive_purchase_items");
  console.log("");

  process.exit(0);
}

main().catch((e) => {
  console.error("Error:", e);
  process.exit(1);
});
