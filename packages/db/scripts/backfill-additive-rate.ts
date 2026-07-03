/**
 * Backfill batch_additives.rate_grams_per_l for rows added before the column
 * existed, so historical additive intensities become comparable across batches.
 *
 * Uses the SAME lib helper as the live mutation. Denominator is the batch's
 * current volume in liters (falls back to initial volume). Idempotent — only
 * touches rows where rate_grams_per_l IS NULL. Rows that can't be reduced to a
 * mass intensity (pure-volume additions, unknown volume) are left NULL.
 *
 * Usage (from repo root):
 *   pnpm --filter db exec tsx scripts/backfill-additive-rate.ts --dry-run
 *   pnpm --filter db exec tsx scripts/backfill-additive-rate.ts
 */
import { db } from "../src/index";
import { sql } from "drizzle-orm";
import { additiveRateGramsPerL } from "../../lib/src/units/conversions";

async function main() {
  const dryRun = process.argv.includes("--dry-run");

  const result: any = await db.execute(sql`
    SELECT ba.id,
           ba.amount::float8              AS amount,
           ba.unit                        AS unit,
           ba.additive_name               AS name,
           -- Completed/emptied batches have current_volume_liters = 0; fall back
           -- to the batch's initial (production) volume for a sane intensity.
           COALESCE(NULLIF(b.current_volume_liters, 0), b.initial_volume_liters)::float8 AS volume_l
    FROM batch_additives ba
    JOIN batches b ON b.id = ba.batch_id
    WHERE ba.rate_grams_per_l IS NULL
      AND ba.deleted_at IS NULL
  `);
  const rows: any[] = result?.rows ?? result ?? [];

  let updated = 0;
  let skipped = 0;
  for (const r of rows) {
    const rate = additiveRateGramsPerL(r.amount, r.unit, r.volume_l);
    if (rate === null) {
      skipped++;
      continue;
    }
    console.log(
      `${r.name}: ${r.amount} ${r.unit} / ${r.volume_l} L = ${rate} g/L`,
    );
    if (!dryRun) {
      await db.execute(
        sql`UPDATE batch_additives SET rate_grams_per_l = ${rate.toString()}, updated_at = now() WHERE id = ${r.id}::uuid`,
      );
    }
    updated++;
  }

  console.log(
    `\n${dryRun ? "[DRY RUN] would update" : "Updated"} ${updated} row(s); left ${skipped} NULL (pure-volume / unknown volume).`,
  );
  process.exit(0);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
