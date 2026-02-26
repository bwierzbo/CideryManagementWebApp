import { db } from "../client";
import { sql } from "drizzle-orm";

async function main() {
  const rows = await db.execute(sql.raw(`
    SELECT
      b.name,
      b.product_type,
      COALESCE(b.reconciliation_status, 'pending') as recon_status,
      bva.adjustment_date::date,
      round(bva.adjustment_amount::numeric, 2) as liters,
      round(bva.adjustment_amount::numeric / 3.78541, 2) as gallons,
      bva.reason,
      bva.adjustment_type
    FROM batch_volume_adjustments bva
    JOIN batches b ON bva.batch_id = b.id
    WHERE bva.deleted_at IS NULL
      AND b.deleted_at IS NULL
      AND bva.adjustment_date::date > '2024-12-31'
      AND bva.adjustment_date::date <= '2025-12-31'
      AND bva.adjustment_amount::numeric > 0
    ORDER BY bva.adjustment_amount::numeric DESC
  `));

  console.log("\n=== POSITIVE VOLUME ADJUSTMENTS (2025) ===\n");
  let totalGal = 0;
  for (const r of rows.rows) {
    const gal = Number(r.gallons);
    totalGal += gal;
    console.log(`${gal.toFixed(2)} gal | ${Number(r.liters).toFixed(1)}L | ${r.name} (${r.product_type}) | ${r.recon_status} | ${r.adjustment_date} | ${r.reason || "no reason"} | type: ${r.adjustment_type}`);
  }
  console.log(`\nTotal: ${totalGal.toFixed(2)} gal (${(totalGal * 3.78541).toFixed(1)} L)`);

  // Also check Raspberry Blackberry batches
  const rb = await db.execute(sql.raw(`
    SELECT
      b.id, b.name, b.product_type, b.reconciliation_status,
      round(b.initial_volume_liters::numeric, 2) as initial_l,
      round(b.current_volume_liters::numeric, 2) as current_l,
      b.parent_batch_id,
      b.is_racking_derivative,
      b.status,
      b.start_date::date
    FROM batches b
    WHERE b.name ILIKE '%raspberry%' OR b.name ILIKE '%RB%'
    ORDER BY b.start_date
  `));

  console.log("\n=== RASPBERRY BLACKBERRY BATCHES ===\n");
  for (const r of rb.rows) {
    console.log(`${r.name} | ${r.product_type} | status: ${r.status} | recon: ${r.reconciliation_status || 'pending'} | initial: ${r.initial_l}L | current: ${r.current_l}L | parent: ${r.parent_batch_id ? 'yes' : 'no'} | racking: ${r.is_racking_derivative} | started: ${r.start_date}`);
  }

  process.exit(0);
}
main().catch((e) => { console.error(e); process.exit(1); });
