/**
 * Tank volume integrity audit: for every batch holding volume (or
 * active with zero), compare the stored current_volume_liters against
 * the ledger-reconstructed balance and the vessel capacity.
 *
 * Read-only. Run: pnpm --filter db exec tsx scripts/audit-tank-volumes.ts
 */
import { db } from "../src/index";
import { sql } from "drizzle-orm";

async function main() {
  const rows = await db.execute(sql`
    WITH ledger AS (
      SELECT batch_id,
             SUM(volume_change)::numeric AS ledger_sum,
             COUNT(*) AS entries,
             BOOL_OR(event_type = 'creation') AS has_creation,
             MIN(event_date) AS first_event,
             MAX(event_date) AS last_event
      FROM batch_volume_ledger
      GROUP BY batch_id
    )
    SELECT
      b.batch_number,
      COALESCE(b.custom_name, '') AS custom_name,
      b.status,
      v.name AS vessel,
      COALESCE(v.capacity::numeric, 0) AS capacity,
      v.capacity_unit,
      b.current_volume_liters::numeric AS stored_l,
      l.ledger_sum,
      l.entries,
      l.has_creation,
      (b.current_volume_liters::numeric - COALESCE(l.ledger_sum, 0)) AS drift_l
    FROM batches b
    LEFT JOIN vessels v ON v.id = b.vessel_id
    LEFT JOIN ledger l ON l.batch_id = b.id
    WHERE b.deleted_at IS NULL
      AND b.destroyed_at IS NULL
      AND (
        b.current_volume_liters::numeric > 0.01
        OR b.status IN ('juice', 'fermentation', 'aging', 'conditioning')
      )
    ORDER BY ABS(b.current_volume_liters::numeric - COALESCE(l.ledger_sum, 0)) DESC
  `);

  const out = (rows.rows as any[]).map((r) => ({
    batch: (r.custom_name || r.batch_number).slice(0, 38),
    status: r.status,
    vessel: r.vessel ?? "—",
    stored_L: Number(r.stored_l).toFixed(1),
    ledger_L: r.ledger_sum !== null ? Number(r.ledger_sum).toFixed(1) : "no ledger",
    drift_L: r.ledger_sum !== null ? Number(r.drift_l).toFixed(1) : "—",
    entries: r.entries ?? 0,
    has_creation: r.has_creation ?? false,
    capacity: r.capacity_unit === "gal"
      ? (Number(r.capacity) * 3.78541).toFixed(0)
      : Number(r.capacity).toFixed(0),
    over_capacity:
      Number(r.capacity) > 0 &&
      Number(r.stored_l) >
        (r.capacity_unit === "gal" ? Number(r.capacity) * 3.78541 : Number(r.capacity)) + 1,
  }));
  console.table(out);
  const flagged = out.filter(
    (r) => (r.drift_L !== "—" && Math.abs(Number(r.drift_L)) > 2) || r.over_capacity,
  );
  console.log(`\n${flagged.length} of ${out.length} batches flagged (|drift| > 2 L or over capacity)`);
}

main().then(() => process.exit(0)).catch((e) => { console.error(e); process.exit(1); });
