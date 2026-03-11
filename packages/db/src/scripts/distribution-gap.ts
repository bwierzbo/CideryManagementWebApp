import { db } from "..";
import { sql } from "drizzle-orm";

const GAL = 0.264172;

async function main() {
  // All bottle runs volume vs only distributed ones
  const br = await db.execute(
    sql.raw(`
    SELECT
      COALESCE(SUM(CAST(br.volume_taken_liters AS NUMERIC)), 0) as all_vol,
      COALESCE(SUM(CASE WHEN br.status IN ('distributed','completed') THEN CAST(br.volume_taken_liters AS NUMERIC) ELSE 0 END), 0) as dist_vol,
      COUNT(*) as total_count,
      COUNT(*) FILTER (WHERE br.status IN ('distributed','completed')) as dist_count,
      COUNT(*) FILTER (WHERE br.status NOT IN ('distributed','completed')) as undist_count
    FROM bottle_runs br INNER JOIN batches b ON br.batch_id = b.id
    WHERE b.deleted_at IS NULL AND br.voided_at IS NULL
      AND br.packaged_at::date > '2024-12-31' AND br.packaged_at::date <= '2025-12-31'
  `)
  );
  const r = br.rows[0] as any;
  console.log("Bottle runs (2025):");
  console.log(
    "  All:          " +
      (parseFloat(r.all_vol) * GAL).toFixed(1) +
      " gal (" +
      r.total_count +
      " runs)"
  );
  console.log(
    "  Distributed:  " +
      (parseFloat(r.dist_vol) * GAL).toFixed(1) +
      " gal (" +
      r.dist_count +
      " runs)"
  );
  console.log(
    "  Undistributed:" +
      ((parseFloat(r.all_vol) - parseFloat(r.dist_vol)) * GAL).toFixed(1) +
      " gal (" +
      r.undist_count +
      " runs)"
  );

  // Undistributed bottle run details
  const undist = await db.execute(
    sql.raw(`
    SELECT br.status, COUNT(*) as cnt,
           COALESCE(SUM(CAST(br.volume_taken_liters AS NUMERIC)), 0) as vol
    FROM bottle_runs br INNER JOIN batches b ON br.batch_id = b.id
    WHERE b.deleted_at IS NULL AND br.voided_at IS NULL
      AND br.packaged_at::date > '2024-12-31' AND br.packaged_at::date <= '2025-12-31'
      AND br.status NOT IN ('distributed','completed')
    GROUP BY br.status
  `)
  );
  if ((undist.rows as any[]).length > 0) {
    console.log("\nUndistributed bottle runs by status:");
    for (const u of undist.rows as any[]) {
      console.log(
        "  " +
          u.status +
          ": " +
          u.cnt +
          " runs, " +
          (parseFloat(u.vol) * GAL).toFixed(1) +
          " gal"
      );
    }
  }

  // Keg fills
  const kf = await db.execute(
    sql.raw(`
    SELECT
      COALESCE(SUM(CASE WHEN kf.volume_taken_unit='gal' THEN kf.volume_taken::numeric*3.78541 ELSE kf.volume_taken::numeric END), 0) as all_vol,
      COALESCE(SUM(CASE WHEN kf.distributed_at IS NOT NULL THEN
        CASE WHEN kf.volume_taken_unit='gal' THEN kf.volume_taken::numeric*3.78541 ELSE kf.volume_taken::numeric END
       ELSE 0 END), 0) as dist_vol,
      COUNT(*) as total_count,
      COUNT(*) FILTER (WHERE kf.distributed_at IS NOT NULL) as dist_count,
      COUNT(*) FILTER (WHERE kf.distributed_at IS NULL) as undist_count
    FROM keg_fills kf INNER JOIN batches b ON kf.batch_id = b.id
    WHERE b.deleted_at IS NULL AND kf.voided_at IS NULL AND kf.deleted_at IS NULL
      AND kf.filled_at::date > '2024-12-31' AND kf.filled_at::date <= '2025-12-31'
  `)
  );
  const k = kf.rows[0] as any;
  console.log("\nKeg fills (2025):");
  console.log(
    "  All:          " +
      (parseFloat(k.all_vol) * GAL).toFixed(1) +
      " gal (" +
      k.total_count +
      " fills)"
  );
  console.log(
    "  Distributed:  " +
      (parseFloat(k.dist_vol) * GAL).toFixed(1) +
      " gal (" +
      k.dist_count +
      " fills)"
  );
  console.log(
    "  Undistributed:" +
      ((parseFloat(k.all_vol) - parseFloat(k.dist_vol)) * GAL).toFixed(1) +
      " gal (" +
      k.undist_count +
      " fills)"
  );

  // Total comparison
  const waterfallDist =
    parseFloat(r.dist_vol) * GAL + parseFloat(k.dist_vol) * GAL;
  const actualRemoved =
    parseFloat(r.all_vol) * GAL + parseFloat(k.all_vol) * GAL;
  console.log("\n=== PACKAGING vs DISTRIBUTION ===");
  console.log(
    "Total packaged (removed from bulk): " + actualRemoved.toFixed(1) + " gal"
  );
  console.log(
    "Total distributed (sold to customers): " +
      waterfallDist.toFixed(1) +
      " gal"
  );
  console.log(
    "Still in packaged inventory (not yet sold): " +
      (actualRemoved - waterfallDist).toFixed(1) +
      " gal"
  );

  // Check inventory_items for remaining packaged stock
  const invItems = await db.execute(
    sql.raw(`
    SELECT COALESCE(SUM(CAST(ii.current_quantity AS NUMERIC) * CAST(ii.package_size_ml AS NUMERIC) / 1000.0), 0) as total_l
    FROM inventory_items ii
    WHERE ii.deleted_at IS NULL AND ii.current_quantity > 0
  `)
  );
  console.log(
    "\nInventory items (actual packaged on hand): " +
      (parseFloat((invItems.rows[0] as any).total_l) * GAL).toFixed(1) +
      " gal"
  );

  process.exit(0);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
