/**
 * Owner request 2026-09-11: restructure the Pear Cider recipe to match
 * the Marionberry fruited-cider pattern — coarse + fine filtration,
 * separate keg path (first) and bottle path, in-keg carbonation,
 * pasteurize-then-label for bottles.
 *
 * Steps 0-3 (transfer, backsweeten, malic acid, SG/pH — all done on
 * batch 2026-065) are untouched. Everything from sequence 4 up is
 * replaced on BOTH the recipe template and the running batch's
 * checklist (none of those tasks were done). Pear-specific notes are
 * preserved: the no-brandy TTB warning and the >=20 PU pasteurization
 * spec.
 *
 * Run: pnpm --filter db exec tsx scripts/restructure-pear-cider-recipe.ts
 */
import { db } from "../src/index";
import { sql } from "drizzle-orm";

const RECIPE_ID = "adc2429b-5d3d-4de5-8bb1-9ff118416ed9";
const EXECUTION_ID = "43b1b9db-c317-4be2-9fc0-bb1979599eb6";
const BATCH_ID = "ef470f97-695a-4429-b7cc-26157c484c99";
const SCHEDULED = "2026-09-11";

type Step = {
  seq: number;
  kind: string;
  path: "all" | "keg" | "bottle";
  label: string;
  description: string | null;
  actionData: Record<string, unknown>;
};

const STEPS: Step[] = [
  { seq: 4, kind: "filter", path: "all", label: "Coarse Filter Cider",
    description: "Coarse pads first to knock out pear haze before fine filtration.", actionData: {} },
  { seq: 5, kind: "filter", path: "all", label: "Fine Filter Cider",
    description: "Use 1 micron pads.", actionData: {} },
  { seq: 6, kind: "package", path: "keg", label: "Package Cider in Kegs",
    description: "Fill 19.5 L kegs and purge headspace with CO2.", actionData: {} },
  { seq: 7, kind: "carbonate", path: "keg", label: "Force-Carbonate Kegs",
    description: "Force-carbonate in the keg to 2.0 vol CO2.",
    actionData: { method: "forced", targetCo2Volumes: 2 } },
  { seq: 8, kind: "measurement", path: "keg", label: "Measure CO2",
    description: null, actionData: { measures: ["co2"] } },
  { seq: 9, kind: "wait", path: "keg", label: "Label Kegs",
    description: "Label kegs with name, date, ABV, keg size. Backsweetened product: keep kegs cold.", actionData: {} },
  { seq: 10, kind: "carbonate", path: "bottle", label: "Carbonate Cider",
    description: "Force-carbonate to 2.0 vol CO2 — permitted for hard cider (apple+pear); no brandy in this recipe, do not fortify or it reclassifies as wine.",
    actionData: { method: "forced", targetCo2Volumes: 2 } },
  { seq: 11, kind: "measurement", path: "bottle", label: "Measure CO2",
    description: null, actionData: { measures: ["co2"] } },
  { seq: 12, kind: "package", path: "bottle", label: "Package Cider in 750ml bottles",
    description: "Package into 750ml bottles + caps.", actionData: {} },
  { seq: 13, kind: "pasteurize", path: "bottle", label: "Pasteurize Bottles",
    description: "Hot-water bath pasteurize the filled bottles to at least 20 PU to stabilize the backsweetened cider, then cool before labeling.", actionData: {} },
  { seq: 14, kind: "label", path: "bottle", label: "Label Bottles",
    description: "Apply the appropriate bottle labels.", actionData: {} },
];

async function main() {
  await db.transaction(async (tx) => {
    // Recipe template
    await tx.execute(sql`DELETE FROM recipe_steps WHERE recipe_id = ${RECIPE_ID} AND sequence >= 4`);
    for (const s of STEPS) {
      await tx.execute(sql`
        INSERT INTO recipe_steps
          (recipe_id, kind, sequence, label, description, trigger_kind, trigger_data,
           action_data, packaging_path, is_optional)
        VALUES (${RECIPE_ID}, ${s.kind}, ${s.seq}, ${s.label}, ${s.description},
                'after_previous', '{}', ${JSON.stringify(s.actionData)}, ${s.path}, false)
      `);
    }

    // Running batch checklist — replace only the not-yet-done tail
    const guard = await tx.execute(sql`
      SELECT COUNT(*)::int AS n FROM batch_step_tasks
      WHERE execution_id = ${EXECUTION_ID} AND sequence >= 4 AND status = 'done'
    `);
    if (Number((guard.rows[0] as { n: number }).n) > 0) {
      throw new Error("A task at sequence >= 4 is already done — aborting");
    }
    await tx.execute(sql`DELETE FROM batch_step_tasks WHERE execution_id = ${EXECUTION_ID} AND sequence >= 4`);
    for (const s of STEPS) {
      await tx.execute(sql`
        INSERT INTO batch_step_tasks
          (execution_id, batch_id, sequence, kind, label, description, packaging_path,
           is_optional, trigger_kind, trigger_data, action_data, status, scheduled_date)
        VALUES (${EXECUTION_ID}, ${BATCH_ID}, ${s.seq}, ${s.kind}, ${s.label}, ${s.description},
                ${s.path}, false, 'after_previous', '{}', ${JSON.stringify(s.actionData)},
                'pending', ${SCHEDULED})
      `);
    }
  });

  const check = await db.execute(sql`
    SELECT sequence, kind, packaging_path, status, label FROM batch_step_tasks
    WHERE execution_id = ${EXECUTION_ID} ORDER BY sequence
  `);
  console.table(check.rows);
}

main().then(() => process.exit(0)).catch((e) => { console.error(e); process.exit(1); });
