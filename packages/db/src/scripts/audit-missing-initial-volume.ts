/**
 * Audits batches where initialVolumeLiters is missing or zero.
 *
 * Why this matters: cogsBreakdown (and any other proration that divides by
 * initialVolumeLiters) goes haywire when this field is null. The router has
 * a fallback to "sum of bottle-run volumes drawn", but the data should still
 * be corrected so the underlying value is right.
 *
 * Run with:  pnpm --filter db exec tsx src/scripts/audit-missing-initial-volume.ts
 */

import { db } from "../client";
import { sql } from "drizzle-orm";

interface Row {
  id: string;
  name: string;
  custom_name: string | null;
  product_type: string;
  status: string;
  initial_volume_liters: string | null;
  current_volume_liters: string | null;
  vessel_name: string | null;
  start_date: Date;
  bottle_run_count: number;
  total_drawn_l: string | null;
  inferred_initial_l: string | null;
  affected_units: number;
}

async function main() {
  // Find every batch (incl. soft-deleted, since old bottle runs may still
  // reference them and inflate COGS) with missing initialVolumeLiters AND
  // at least one bottle run.
  // Count both bottle and keg outflows. Pre-aggregate per batch so the join
  // doesn't multiply rows.
  const result = await db.execute(sql`
    WITH bottle_agg AS (
      SELECT batch_id,
             COUNT(*)                                                                  AS run_count,
             COALESCE(SUM(CAST(COALESCE(volume_taken_liters, volume_taken) AS NUMERIC)), 0) AS drawn_l,
             COALESCE(SUM(units_produced), 0)                                          AS units
      FROM bottle_runs
      WHERE status <> 'voided'
      GROUP BY batch_id
    ),
    keg_agg AS (
      SELECT batch_id,
             COUNT(*)                                              AS fill_count,
             COALESCE(SUM(CAST(volume_taken AS NUMERIC)), 0)        AS kegged_l
      FROM keg_fills
      WHERE voided_at IS NULL AND deleted_at IS NULL
      GROUP BY batch_id
    )
    SELECT
      b.id,
      b.name,
      b.custom_name,
      b.product_type::text                                                AS product_type,
      b.status::text                                                      AS status,
      b.initial_volume_liters,
      b.current_volume_liters,
      v.name                                                              AS vessel_name,
      b.start_date,
      COALESCE(ba.run_count, 0) + COALESCE(ka.fill_count, 0)               AS bottle_run_count,
      (COALESCE(ba.drawn_l, 0) + COALESCE(ka.kegged_l, 0))                 AS total_drawn_l,
      COALESCE(ba.units, 0)                                                AS affected_units,
      (COALESCE(ba.drawn_l, 0) + COALESCE(ka.kegged_l, 0))                 AS inferred_initial_l
    FROM batches b
    LEFT JOIN vessels v   ON v.id = b.vessel_id
    LEFT JOIN bottle_agg ba ON ba.batch_id = b.id
    LEFT JOIN keg_agg    ka ON ka.batch_id = b.id
    WHERE
      (b.initial_volume_liters IS NULL OR CAST(b.initial_volume_liters AS NUMERIC) <= 0)
      AND (ba.batch_id IS NOT NULL OR ka.batch_id IS NOT NULL)
    ORDER BY affected_units DESC, total_drawn_l DESC
  `);

  const rows = result.rows as unknown as Row[];

  if (rows.length === 0) {
    console.log("✅ No batches with missing initialVolumeLiters that have bottle runs.");
    console.log("   (COGS proration is using correct denominators across the board.)");
    process.exit(0);
  }

  console.log(`Found ${rows.length} batch(es) with missing initialVolumeLiters AND active bottle runs.`);
  console.log("These are over-attributing costs in cogsBreakdown unless the fallback kicks in.\n");

  console.log(
    "name".padEnd(60) +
      "  type".padEnd(10) +
      "  status".padEnd(14) +
      "  vessel".padEnd(20) +
      "  runs".padStart(6) +
      "  units".padStart(8) +
      "  drawn(L)".padStart(12) +
      "  → suggested initial(L)",
  );
  console.log("-".repeat(150));

  let totalAffectedUnits = 0;

  for (const r of rows) {
    const display = (r.custom_name || r.name || "?").substring(0, 58);
    const drawn = Number(r.total_drawn_l ?? 0);
    const inferred = Number(r.inferred_initial_l ?? 0);
    totalAffectedUnits += Number(r.affected_units);

    console.log(
      display.padEnd(60) +
        `  ${r.product_type ?? "?"}`.padEnd(10) +
        `  ${r.status ?? "?"}`.padEnd(14) +
        `  ${(r.vessel_name ?? "—").substring(0, 18)}`.padEnd(20) +
        `  ${r.bottle_run_count}`.padStart(6) +
        `  ${r.affected_units}`.padStart(8) +
        `  ${drawn.toFixed(1)}`.padStart(12) +
        `  → ${inferred.toFixed(1)}L`,
    );
  }

  console.log("-".repeat(150));
  console.log(`Total affected bottle units: ${totalAffectedUnits}`);
  console.log(
    `\nNext step: for each batch above, set initial_volume_liters in Drizzle Studio` +
      ` (or via SQL UPDATE) to the actual starting volume. The "suggested" column is` +
      ` the volume drawn via bottle runs — it's a lower bound (real initial may be` +
      ` higher if the batch wasn't fully bottled or had losses).`,
  );

  process.exit(0);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
