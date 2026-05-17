/**
 * One-shot setup script for Phase 1 of the recipes feature.
 *   Step 1: drop legacy recipes/recipe_ingredients/recipe_additives (0129)
 *   Step 2: apply the new recipes schema (0128)
 *
 * On a brand-new database both run cleanly in either order. On the dev DB
 * that already had legacy scaffolding, this order is required.
 */

import { db } from "../client";
import { sql } from "drizzle-orm";
import * as fs from "fs";
import * as path from "path";

async function applyMigration(filename: string) {
  const p = path.resolve(__dirname, "../../migrations", filename);
  const txt = fs.readFileSync(p, "utf-8");
  await db.execute(sql.raw(txt));
  console.log(`✓ Applied ${filename}`);
}

async function main() {
  await applyMigration("0129_drop_legacy_recipes.sql");
  await applyMigration("0128_recipes_phase1.sql");

  // Verify final state
  const tables = await db.execute(sql`
    SELECT table_name FROM information_schema.tables
    WHERE table_name IN ('recipes','recipe_inputs','recipe_steps','recipe_versions')
    ORDER BY table_name
  `);
  console.log("\nNew tables present:");
  for (const r of tables.rows as Array<{ table_name: string }>) {
    console.log("  " + r.table_name);
  }

  const col = await db.execute(sql`
    SELECT column_name FROM information_schema.columns
    WHERE table_name = 'users' AND column_name = 'permission_overrides'
  `);
  console.log(
    "users.permission_overrides:",
    col.rows.length > 0 ? "present" : "MISSING",
  );

  const legacy = await db.execute(sql`
    SELECT table_name FROM information_schema.tables
    WHERE table_name IN ('recipe_ingredients', 'recipe_additives')
  `);
  console.log(
    "Legacy tables:",
    legacy.rows.length === 0 ? "removed ✓" : `STILL PRESENT (${legacy.rows.length})`,
  );

  process.exit(0);
}

main().catch((e) => {
  console.error("FAILED:", e.message);
  process.exit(1);
});
