import { db } from "../src/index";
import { sql } from "drizzle-orm";

async function traceBatchLineage(batchId: string, label: string) {
  console.log(`\n=== Lineage for "${label}" (${batchId}) ===`);

  // Step 0: the batch itself
  const self = await db.execute(sql`
    SELECT b.id, b.name, b.custom_name, b.status, b.start_date, b.initial_volume_liters,
           v.name AS current_vessel
    FROM batches b
    LEFT JOIN vessels v ON b.vessel_id = v.id
    WHERE b.id = ${batchId}::uuid
  `);
  const sb = (self.rows as any[])[0];
  if (sb) {
    console.log(
      `  Self: ${sb.custom_name || sb.name} (status=${sb.status}, start=${sb.start_date}, initialVol=${sb.initial_volume_liters}L, currentVessel=${sb.current_vessel ?? "—"})`,
    );
  }

  // Step 1: all transfers where this batch was the DESTINATION
  const transfersIn = await db.execute(sql`
    SELECT
      bt.id,
      bt.transferred_at,
      bt.volume_transferred,
      bt.volume_transferred_unit,
      bt.loss,
      bt.notes,
      src_v.id AS source_vessel_id,
      src_v.name AS source_vessel_name,
      src_b.id AS source_batch_id,
      src_b.name AS source_batch_name,
      src_b.custom_name AS source_batch_custom_name,
      dst_v.name AS dest_vessel_name
    FROM batch_transfers bt
    LEFT JOIN vessels src_v ON bt.source_vessel_id = src_v.id
    LEFT JOIN batches src_b ON bt.source_batch_id = src_b.id
    LEFT JOIN vessels dst_v ON bt.destination_vessel_id = dst_v.id
    WHERE bt.destination_batch_id = ${batchId}::uuid AND bt.deleted_at IS NULL
    ORDER BY bt.transferred_at DESC
  `);
  console.log(`  Transfers IN (${transfersIn.rows.length}):`);
  for (const row of transfersIn.rows as any[]) {
    console.log(
      `    ${row.transferred_at}  ← vessel "${row.source_vessel_name}", source batch "${row.source_batch_custom_name || row.source_batch_name}" (${row.source_batch_id})  | ${row.volume_transferred}${row.volume_transferred_unit}, loss=${row.loss}`,
    );
  }

  // Step 2: for each unique source batch, find ITS transfers in (one more step back)
  const sourceBatchIds = Array.from(
    new Set((transfersIn.rows as any[]).map((r) => r.source_batch_id).filter(Boolean)),
  ) as string[];

  for (const srcBatchId of sourceBatchIds) {
    const srcSelf = await db.execute(sql`
      SELECT b.id, b.name, b.custom_name, b.status, b.start_date, b.initial_volume_liters,
             v.name AS current_vessel
      FROM batches b
      LEFT JOIN vessels v ON b.vessel_id = v.id
      WHERE b.id = ${srcBatchId}::uuid
    `);
    const sr = (srcSelf.rows as any[])[0];
    console.log(
      `\n  -- Source batch upstream: "${sr?.custom_name || sr?.name}" (${srcBatchId}) — status=${sr?.status}, start=${sr?.start_date}, initialVol=${sr?.initial_volume_liters}L`,
    );

    const upstream = await db.execute(sql`
      SELECT
        bt.transferred_at,
        bt.volume_transferred,
        bt.volume_transferred_unit,
        src_v.name AS source_vessel_name,
        src_b.name AS source_batch_name,
        src_b.custom_name AS source_batch_custom_name
      FROM batch_transfers bt
      LEFT JOIN vessels src_v ON bt.source_vessel_id = src_v.id
      LEFT JOIN batches src_b ON bt.source_batch_id = src_b.id
      WHERE bt.destination_batch_id = ${srcBatchId}::uuid AND bt.deleted_at IS NULL
      ORDER BY bt.transferred_at DESC
    `);
    if (upstream.rows.length === 0) {
      console.log(`     (no upstream transfers — this batch likely originated from a press run / juice lot)`);

      // Check if it came from a press run
      const press = await db.execute(sql`
        SELECT pr.id, pr.press_run_name, pr.date_completed, pr.total_juice_volume, v.name AS vessel_name
        FROM press_runs pr
        LEFT JOIN vessels v ON pr.vessel_id = v.id
        WHERE pr.id IN (
          SELECT DISTINCT press_run_id FROM juice_lots WHERE batch_id = ${srcBatchId}::uuid
        )
        OR pr.vessel_id = ${sb?.current_vessel ?? null}
      `).catch(() => ({ rows: [] }));
      // ignore if schema differs
    } else {
      for (const row of upstream.rows as any[]) {
        console.log(
          `     ${row.transferred_at}  ← vessel "${row.source_vessel_name}", source batch "${row.source_batch_custom_name || row.source_batch_name}"  | ${row.volume_transferred}${row.volume_transferred_unit}`,
        );
      }
    }
  }
}

async function check() {
  // The two batches that were kegged most recently
  const ids = await db.execute(sql`
    SELECT b.id, COALESCE(b.custom_name, b.name) AS label, MAX(kf.filled_at) AS last_keg_fill
    FROM keg_fills kf
    JOIN batches b ON kf.batch_id = b.id
    WHERE kf.deleted_at IS NULL AND kf.voided_at IS NULL
    GROUP BY b.id, b.name, b.custom_name
    ORDER BY last_keg_fill DESC
    LIMIT 2
  `);

  for (const row of ids.rows as any[]) {
    await traceBatchLineage(row.id, row.label);
  }

  process.exit(0);
}

check().catch((e) => {
  console.error(e);
  process.exit(1);
});
