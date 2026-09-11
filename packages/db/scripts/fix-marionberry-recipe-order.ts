/**
 * Marionberry recipe fixes (owner request 2026-09-11):
 * 1. Keg steps come BEFORE bottle steps.
 * 2. New 'Pasteurize Bottles' step between bottling and labeling
 *    (backsweetened fruited cider in bottles must be stabilized;
 *    pasteurize before labels so the bath doesn't ruin them).
 *
 * Applies to BOTH the recipe template (future batches) and the
 * already-materialized checklist of batch 2026-062 (tasks are
 * snapshots with no live link to recipe_steps).
 *
 * Run: pnpm --filter db exec tsx scripts/fix-marionberry-recipe-order.ts
 */
import { db } from "../src/index";
import { sql } from "drizzle-orm";

const RECIPE_ID = "c277f049-4f75-4855-bc21-b25d98d373a6";
const EXECUTION_ID = "06033397-f412-48f6-83d2-65ecbb2b46a4";

// old sequence -> new sequence (keg block 10-13 moves to 6-9;
// bottle block 6-9 moves to 10-12 + 14, leaving 13 for pasteurize)
const REMAP: Array<[number, number]> = [
  [10, 6], // Package Cider in Kegs
  [11, 7], // Force-Carbonate Kegs
  [12, 8], // Measure CO2 (keg)
  [13, 9], // Label Kegs
  [6, 10], // Carbonate Cider
  [7, 11], // Measure CO2 (bottle)
  [8, 12], // Package Cider in 750ml bottles
  [9, 14], // Label Bottles (pasteurize slots in at 13)
];

const PASTEURIZE = {
  label: "Pasteurize Bottles",
  description:
    "Hot-water bath pasteurize the filled bottles (target ~60+ PU) to stabilize the backsweetened fruited cider, then let them cool before labeling.",
};

async function remapTable(table: "recipe_steps" | "batch_step_tasks", whereCol: string, whereVal: string) {
  // Two-phase renumber to dodge any unique(sequence) collisions
  for (const [from] of REMAP) {
    await db.execute(
      sql.raw(
        `UPDATE ${table} SET sequence = ${from + 100}, updated_at = NOW()
         WHERE ${whereCol} = '${whereVal}' AND sequence = ${from}`,
      ),
    );
  }
  for (const [from, to] of REMAP) {
    await db.execute(
      sql.raw(
        `UPDATE ${table} SET sequence = ${to}, updated_at = NOW()
         WHERE ${whereCol} = '${whereVal}' AND sequence = ${from + 100}`,
      ),
    );
  }
}

async function main() {
  await db.transaction(async () => {
    // 1. Recipe template
    await remapTable("recipe_steps", "recipe_id", RECIPE_ID);
    await db.execute(sql`
      INSERT INTO recipe_steps
        (recipe_id, kind, sequence, label, description, trigger_kind, trigger_data, packaging_path, is_optional)
      VALUES
        (${RECIPE_ID}, 'pasteurize', 13, ${PASTEURIZE.label}, ${PASTEURIZE.description},
         'after_previous', '{}', 'bottle', false)
    `);

    // 2. The 2026-062 batch's materialized checklist
    await remapTable("batch_step_tasks", "execution_id", EXECUTION_ID);
    await db.execute(sql`
      INSERT INTO batch_step_tasks
        (execution_id, batch_id, sequence, kind, label, description, packaging_path,
         is_optional, trigger_kind, trigger_data, status, scheduled_date)
      SELECT ${EXECUTION_ID}, batch_id, 13, 'pasteurize', ${PASTEURIZE.label}, ${PASTEURIZE.description},
             'bottle', false, 'after_previous', '{}', 'pending', scheduled_date
      FROM batch_step_tasks
      WHERE execution_id = ${EXECUTION_ID} AND sequence = 14
      LIMIT 1
    `);
  });

  const check = await db.execute(sql`
    SELECT sequence, kind, packaging_path, status, label FROM batch_step_tasks
    WHERE execution_id = ${EXECUTION_ID} ORDER BY sequence
  `);
  console.table(check.rows);
}

main().then(() => process.exit(0)).catch((e) => { console.error(e); process.exit(1); });
