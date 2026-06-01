import { db } from "../src/index";
import { sql } from "drizzle-orm";

async function check() {
  // Distinct batches by most recent keg fill
  const rows = await db.execute(sql`
    SELECT
      latest.batch_id,
      latest.last_filled_at,
      latest.fill_count,
      latest.total_volume_l,
      b.name AS batch_name,
      b.custom_name AS batch_custom_name,
      b.status AS batch_status,
      v.name AS source_vessel_name
    FROM (
      SELECT
        kf.batch_id,
        MAX(kf.filled_at) AS last_filled_at,
        COUNT(*) AS fill_count,
        SUM(kf.volume_taken) AS total_volume_l,
        (ARRAY_AGG(kf.vessel_id ORDER BY kf.filled_at DESC))[1] AS last_vessel_id
      FROM keg_fills kf
      WHERE kf.deleted_at IS NULL AND kf.voided_at IS NULL
      GROUP BY kf.batch_id
    ) latest
    LEFT JOIN batches b ON latest.batch_id = b.id
    LEFT JOIN vessels v ON latest.last_vessel_id = v.id
    ORDER BY latest.last_filled_at DESC
    LIMIT 5
  `);

  console.log("Most recent batches packaged in kegs (by latest keg fill):");
  for (const row of rows.rows as any[]) {
    console.log(
      `  ${row.last_filled_at}  | batch: ${row.batch_custom_name || row.batch_name} [${row.batch_status}]  | source vessel: ${row.source_vessel_name}  | ${row.fill_count} keg(s), ${row.total_volume_l}L total`,
    );
  }

  console.log("\n--- Individual keg fill rows for the two most recent batches ---");
  const detail = await db.execute(sql`
    WITH top_batches AS (
      SELECT batch_id, MAX(filled_at) AS last_filled_at
      FROM keg_fills
      WHERE deleted_at IS NULL AND voided_at IS NULL
      GROUP BY batch_id
      ORDER BY last_filled_at DESC
      LIMIT 2
    )
    SELECT
      kf.filled_at,
      kf.volume_taken,
      kf.volume_taken_unit,
      kf.loss,
      kf.abv_at_packaging,
      kf.status,
      kf.distributed_at,
      kf.distribution_location,
      k.keg_number,
      k.keg_type,
      k.capacity_ml,
      b.custom_name AS batch_custom_name,
      b.name AS batch_name,
      v.name AS vessel_name
    FROM keg_fills kf
    JOIN top_batches tb ON kf.batch_id = tb.batch_id
    LEFT JOIN kegs k ON kf.keg_id = k.id
    LEFT JOIN batches b ON kf.batch_id = b.id
    LEFT JOIN vessels v ON kf.vessel_id = v.id
    WHERE kf.deleted_at IS NULL AND kf.voided_at IS NULL
    ORDER BY kf.filled_at DESC, k.keg_number
  `);
  for (const row of detail.rows as any[]) {
    console.log(
      `  ${row.filled_at}  | ${row.batch_custom_name || row.batch_name}  | keg ${row.keg_number} (${row.keg_type}, ${row.capacity_ml}mL)  | from ${row.vessel_name}  | ${row.volume_taken}${row.volume_taken_unit}, ABV ${row.abv_at_packaging ?? "—"}  | status=${row.status}`,
    );
  }

  process.exit(0);
}

check().catch((e) => {
  console.error(e);
  process.exit(1);
});
