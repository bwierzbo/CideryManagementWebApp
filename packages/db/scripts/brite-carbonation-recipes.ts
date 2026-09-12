/**
 * Owner correction 2026-09-11: carbonation happens in the BRITE TANK
 * for both paths — fine filter -> transfer to brite -> carbonate ->
 * measure CO2, then kegs and bottles are filled already carbonated.
 *
 * - Pear Cider: template + running batch 2026-065 checklist (done
 *   steps 0-3 untouched; tail replaced, guarded against done tasks).
 * - Marionberry: TEMPLATE only (its batch is essentially complete;
 *   history is not rewritten). Keeps its fine-filter-only prep.
 *
 * Run: pnpm --filter db exec tsx scripts/brite-carbonation-recipes.ts
 */
import { db } from "../src/index";
import { sql } from "drizzle-orm";

const PEAR_RECIPE = "adc2429b-5d3d-4de5-8bb1-9ff118416ed9";
const PEAR_EXECUTION = "43b1b9db-c317-4be2-9fc0-bb1979599eb6";
const PEAR_BATCH = "ef470f97-695a-4429-b7cc-26157c484c99";
const MARION_RECIPE = "c277f049-4f75-4855-bc21-b25d98d373a6";
const SCHEDULED = "2026-09-11";

type Step = {
  seq: number;
  kind: string;
  path: "all" | "keg" | "bottle";
  label: string;
  description: string | null;
  actionData: Record<string, unknown>;
};

const CARB = { method: "forced", targetCo2Volumes: 2 };
const CO2 = { measures: ["co2"] };

/** Pear: replaces sequence >= 4 (after done steps 0-3). */
const PEAR_STEPS: Step[] = [
  { seq: 4, kind: "filter", path: "all", label: "Coarse Filter Cider",
    description: "Coarse pads first to knock out pear haze before fine filtration.", actionData: {} },
  { seq: 5, kind: "filter", path: "all", label: "Fine Filter Cider",
    description: "Use 1 micron pads.", actionData: {} },
  { seq: 6, kind: "transfer", path: "all", label: "Transfer to Brite Tank",
    description: "Transfer the filtered cider to the brite tank for carbonation.", actionData: {} },
  { seq: 7, kind: "carbonate", path: "all", label: "Carbonate to 2.0 vol",
    description: "Force-carbonate in the brite tank to 2.0 vol CO2 — permitted for hard cider (apple+pear); no brandy in this recipe, do not fortify or it reclassifies as wine.",
    actionData: CARB },
  { seq: 8, kind: "measurement", path: "all", label: "Measure CO2",
    description: null, actionData: CO2 },
  { seq: 9, kind: "package", path: "keg", label: "Package Cider in Kegs",
    description: "Fill 19.5 L kegs from the brite tank (already carbonated); purge headspace with CO2.", actionData: {} },
  { seq: 10, kind: "wait", path: "keg", label: "Label Kegs",
    description: "Label kegs with name, date, ABV, keg size. Backsweetened product: keep kegs cold.", actionData: {} },
  { seq: 11, kind: "package", path: "bottle", label: "Package Cider in 750ml bottles",
    description: "Counter-pressure fill 750ml bottles from the brite tank + cap.", actionData: {} },
  { seq: 12, kind: "pasteurize", path: "bottle", label: "Pasteurize Bottles",
    description: "Hot-water bath pasteurize the filled bottles to at least 20 PU to stabilize the backsweetened cider, then cool before labeling.", actionData: {} },
  { seq: 13, kind: "label", path: "bottle", label: "Label Bottles",
    description: "Apply the appropriate bottle labels.", actionData: {} },
];

/** Marionberry template: replaces sequence >= 6 (keeps 0-5 incl. fine filter). */
const MARION_STEPS: Step[] = [
  { seq: 6, kind: "transfer", path: "all", label: "Transfer to Brite Tank",
    description: "Transfer the filtered cider to the brite tank for carbonation.", actionData: {} },
  { seq: 7, kind: "carbonate", path: "all", label: "Carbonate to 2.0 vol",
    description: "Force-carbonate in the brite tank to 2.0 vol CO2.", actionData: CARB },
  { seq: 8, kind: "measurement", path: "all", label: "Measure CO2",
    description: null, actionData: CO2 },
  { seq: 9, kind: "package", path: "keg", label: "Package Cider in Kegs",
    description: "Fill 19.5 L kegs from the brite tank (already carbonated); purge headspace with CO2.", actionData: {} },
  { seq: 10, kind: "wait", path: "keg", label: "Label Kegs",
    description: "Label kegs with name, date, ABV, keg size.", actionData: {} },
  { seq: 11, kind: "package", path: "bottle", label: "Package Cider in 750ml bottles",
    description: "Counter-pressure fill 750ml bottles from the brite tank + cap.", actionData: {} },
  { seq: 12, kind: "pasteurize", path: "bottle", label: "Pasteurize Bottles",
    description: "Hot-water bath pasteurize the filled bottles (target ~60+ PU) to stabilize the backsweetened fruited cider, then let them cool before labeling.", actionData: {} },
  { seq: 13, kind: "label", path: "bottle", label: "Label Bottles",
    description: "Apply the appropriate bottle labels.", actionData: {} },
];

async function insertRecipeSteps(tx: any, recipeId: string, steps: Step[]) {
  for (const s of steps) {
    await tx.execute(sql`
      INSERT INTO recipe_steps
        (recipe_id, kind, sequence, label, description, trigger_kind, trigger_data,
         action_data, packaging_path, is_optional)
      VALUES (${recipeId}, ${s.kind}, ${s.seq}, ${s.label}, ${s.description},
              'after_previous', '{}', ${JSON.stringify(s.actionData)}, ${s.path}, false)
    `);
  }
}

async function main() {
  await db.transaction(async (tx) => {
    // Pear template
    await tx.execute(sql`DELETE FROM recipe_steps WHERE recipe_id = ${PEAR_RECIPE} AND sequence >= 4`);
    await insertRecipeSteps(tx, PEAR_RECIPE, PEAR_STEPS);

    // Pear running batch (guard: nothing >= 4 may be done)
    const guard = await tx.execute(sql`
      SELECT COUNT(*)::int AS n FROM batch_step_tasks
      WHERE execution_id = ${PEAR_EXECUTION} AND sequence >= 4 AND status = 'done'
    `);
    if (Number((guard.rows[0] as { n: number }).n) > 0) {
      throw new Error("A pear task at sequence >= 4 is already done — aborting");
    }
    await tx.execute(sql`DELETE FROM batch_step_tasks WHERE execution_id = ${PEAR_EXECUTION} AND sequence >= 4`);
    for (const s of PEAR_STEPS) {
      await tx.execute(sql`
        INSERT INTO batch_step_tasks
          (execution_id, batch_id, sequence, kind, label, description, packaging_path,
           is_optional, trigger_kind, trigger_data, action_data, status, scheduled_date)
        VALUES (${PEAR_EXECUTION}, ${PEAR_BATCH}, ${s.seq}, ${s.kind}, ${s.label}, ${s.description},
                ${s.path}, false, 'after_previous', '{}', ${JSON.stringify(s.actionData)},
                'pending', ${SCHEDULED})
      `);
    }

    // Marionberry template only
    await tx.execute(sql`DELETE FROM recipe_steps WHERE recipe_id = ${MARION_RECIPE} AND sequence >= 6`);
    await insertRecipeSteps(tx, MARION_RECIPE, MARION_STEPS);
  });

  const pear = await db.execute(sql`
    SELECT sequence, kind, packaging_path, status, label FROM batch_step_tasks
    WHERE execution_id = ${PEAR_EXECUTION} ORDER BY sequence
  `);
  console.table(pear.rows);
  const marion = await db.execute(sql`
    SELECT sequence, kind, packaging_path, label FROM recipe_steps
    WHERE recipe_id = ${MARION_RECIPE} ORDER BY sequence
  `);
  console.table(marion.rows);
}

main().then(() => process.exit(0)).catch((e) => { console.error(e); process.exit(1); });
