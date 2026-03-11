import { db } from "../client";
import { sql } from "drizzle-orm";

async function main() {
  // Check which negative adjustments fall within the 2025 period
  const adj = await db.execute(sql.raw(`
    SELECT b.name, COALESCE(b.custom_name, '') as cn, b.product_type,
      bva.adjustment_date::date, round(bva.adjustment_amount::numeric, 2) as amt,
      round(bva.adjustment_amount::numeric / 3.78541, 2) as gal,
      bva.adjustment_type, bva.reason
    FROM batch_volume_adjustments bva
    JOIN batches b ON bva.batch_id = b.id
    WHERE bva.deleted_at IS NULL
      AND bva.adjustment_amount::numeric < 0
      AND bva.adjustment_date::date > '2024-12-31'
      AND bva.adjustment_date::date <= '2025-12-31'
    ORDER BY bva.adjustment_amount::numeric
  `));

  console.log("Negative adjustments in 2025 period:");
  let totalGal = 0;
  for (const r of adj.rows) {
    const g = Number(r.gal);
    totalGal += g;
    console.log(
      `${g.toFixed(2)} gal | ${r.adjustment_date} | ${r.cn || r.name} | ${r.product_type} | ${r.adjustment_type} | ${(r.reason as string || "").substring(0, 60)}`
    );
  }
  console.log(`\nTotal negative adj in period: ${totalGal.toFixed(2)} gal`);

  // Also check ALL our new adjustments regardless of date
  console.log("\n\nALL sediment/donation/other adjustments we created:");
  const all = await db.execute(sql.raw(`
    SELECT b.name, COALESCE(b.custom_name, '') as cn, b.product_type,
      bva.adjustment_date::date,
      round(bva.adjustment_amount::numeric / 3.78541, 2) as gal,
      bva.adjustment_type
    FROM batch_volume_adjustments bva
    JOIN batches b ON bva.batch_id = b.id
    WHERE bva.deleted_at IS NULL
      AND bva.adjustment_type IN ('sediment', 'donation', 'other')
      AND bva.reason ILIKE '%lees%' OR bva.reason ILIKE '%donated%'
    ORDER BY bva.adjustment_date
  `));

  for (const r of all.rows) {
    const inPeriod = r.adjustment_date >= "2025-01-01" && r.adjustment_date <= "2025-12-31";
    console.log(
      `${Number(r.gal).toFixed(2)} gal | ${r.adjustment_date} | ${inPeriod ? "IN PERIOD" : "OUTSIDE"} | ${r.cn || r.name} | ${r.product_type} | ${r.adjustment_type}`
    );
  }

  process.exit(0);
}
main().catch((e) => { console.error(e); process.exit(1); });
