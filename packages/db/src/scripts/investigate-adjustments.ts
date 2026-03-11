import { db } from "..";
import { sql } from "drizzle-orm";

const GAL = 0.264172;

async function main() {
  // All positive adjustments during 2025
  const positiveAdj = await db.execute(
    sql.raw(`
    SELECT bva.id, bva.batch_id, bva.adjustment_amount::numeric as amt,
           bva.adjustment_type, bva.reason, bva.adjustment_date::text,
           bva.volume_before::numeric as vol_before, bva.volume_after::numeric as vol_after,
           b.custom_name, b.batch_number, b.reconciliation_status,
           b.product_type
    FROM batch_volume_adjustments bva
    JOIN batches b ON bva.batch_id = b.id
    WHERE bva.deleted_at IS NULL
      AND bva.adjustment_amount::numeric > 0
      AND bva.adjustment_date::date > '2024-12-31'
      AND bva.adjustment_date::date <= '2025-12-31'
    ORDER BY bva.adjustment_amount::numeric DESC
  `)
  );

  console.log("=== POSITIVE ADJUSTMENTS (2025) ===\n");
  let total = 0;
  for (const r of positiveAdj.rows as any[]) {
    const amt = parseFloat(r.amt);
    total += amt;
    console.log(
      `${r.custom_name || r.batch_number} [${r.reconciliation_status}]`
    );
    console.log(
      `  Date: ${r.adjustment_date}, Type: ${r.adjustment_type}`
    );
    console.log(
      `  Amount: +${(amt * GAL).toFixed(2)} gal (+${amt.toFixed(1)}L)`
    );
    console.log(
      `  Before: ${parseFloat(r.vol_before).toFixed(1)}L → After: ${parseFloat(r.vol_after).toFixed(1)}L`
    );
    console.log(`  Reason: "${r.reason}"`);
    console.log();
  }
  console.log(
    `\nTOTAL: +${(total * GAL).toFixed(1)} gal (+${total.toFixed(1)}L) across ${positiveAdj.rows.length} adjustments`
  );

  // Also show all negative adjustments for context
  const negativeAdj = await db.execute(
    sql.raw(`
    SELECT COUNT(*) as cnt, SUM(ABS(bva.adjustment_amount::numeric)) as total_abs
    FROM batch_volume_adjustments bva
    JOIN batches b ON bva.batch_id = b.id
    WHERE bva.deleted_at IS NULL
      AND bva.adjustment_amount::numeric < 0
      AND bva.adjustment_date::date > '2024-12-31'
      AND bva.adjustment_date::date <= '2025-12-31'
  `)
  );
  const neg = negativeAdj.rows[0] as any;
  console.log(
    `\nNegative adjustments: ${neg.cnt} entries, -${(parseFloat(neg.total_abs || "0") * GAL).toFixed(1)} gal total`
  );

  process.exit(0);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
