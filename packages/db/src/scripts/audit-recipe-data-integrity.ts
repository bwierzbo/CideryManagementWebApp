/**
 * Audits the recipes / recipe_inputs / recipe_steps / recipe_versions tables
 * for data integrity issues. Read-only — never modifies anything.
 *
 * What it catches:
 *   - Recipes with no current-version snapshot row
 *   - currentVersion drift (head out of sync with recipe_versions)
 *   - Status / archivedAt inconsistency
 *   - Orphan input/step/version rows
 *   - Empty recipes (no inputs AND no steps) — flagged as warning, not error
 *   - Step sequence gaps / duplicates
 *   - Ingredients missing additive metadata
 *   - Parent batch inputs missing sourceProductType
 *   - Negative / zero rate values
 *   - Trigger-data shape issues (e.g. date_offset_* missing days/hours)
 *
 * Run:  pnpm --filter db exec tsx src/scripts/audit-recipe-data-integrity.ts
 */

import { db } from "../client";
import { sql } from "drizzle-orm";

interface Issue {
  severity: "error" | "warn";
  category: string;
  recipeId: string;
  recipeName: string;
  detail: string;
}

async function main() {
  const issues: Issue[] = [];

  // ─── 1. Recipes with no current-version snapshot ───────────────────────────
  // recipes.currentVersion should match a row in recipe_versions for that
  // recipe. Missing row = the snapshot write was never recorded → bug.
  const missingSnapshot = await db.execute(sql`
    SELECT r.id, r.name, r.current_version
    FROM recipes r
    WHERE NOT EXISTS (
      SELECT 1 FROM recipe_versions rv
      WHERE rv.recipe_id = r.id AND rv.version = r.current_version
    )
  `);
  for (const row of missingSnapshot.rows as any[]) {
    issues.push({
      severity: "error",
      category: "missing-snapshot",
      recipeId: row.id,
      recipeName: row.name,
      detail: `currentVersion=${row.current_version} but no matching recipe_versions row`,
    });
  }

  // ─── 2. currentVersion drift ───────────────────────────────────────────────
  const versionDrift = await db.execute(sql`
    SELECT r.id, r.name, r.current_version, MAX(rv.version) AS max_version
    FROM recipes r
    JOIN recipe_versions rv ON rv.recipe_id = r.id
    GROUP BY r.id
    HAVING MAX(rv.version) <> r.current_version
  `);
  for (const row of versionDrift.rows as any[]) {
    issues.push({
      severity: "error",
      category: "version-drift",
      recipeId: row.id,
      recipeName: row.name,
      detail: `head says v${row.current_version}, recipe_versions max is v${row.max_version}`,
    });
  }

  // ─── 3. Status / archivedAt inconsistency ──────────────────────────────────
  const statusInconsistency = await db.execute(sql`
    SELECT id, name, status, archived_at
    FROM recipes
    WHERE (status = 'archived' AND archived_at IS NULL)
       OR (status <> 'archived' AND archived_at IS NOT NULL)
  `);
  for (const row of statusInconsistency.rows as any[]) {
    issues.push({
      severity: "error",
      category: "status-archived-mismatch",
      recipeId: row.id,
      recipeName: row.name,
      detail: `status=${row.status}, archived_at=${row.archived_at}`,
    });
  }

  // ─── 4. Orphans (FK CASCADE should prevent, but we check anyway) ───────────
  const orphans = await db.execute(sql`
    SELECT 'recipe_inputs'   AS kind, COUNT(*)::int AS n FROM recipe_inputs   ri WHERE NOT EXISTS (SELECT 1 FROM recipes r WHERE r.id = ri.recipe_id)
    UNION ALL
    SELECT 'recipe_steps',           COUNT(*)::int        FROM recipe_steps    rs WHERE NOT EXISTS (SELECT 1 FROM recipes r WHERE r.id = rs.recipe_id)
    UNION ALL
    SELECT 'recipe_versions',        COUNT(*)::int        FROM recipe_versions rv WHERE NOT EXISTS (SELECT 1 FROM recipes r WHERE r.id = rv.recipe_id)
  `);
  for (const row of orphans.rows as any[]) {
    if (row.n > 0) {
      issues.push({
        severity: "error",
        category: "orphan",
        recipeId: "—",
        recipeName: "—",
        detail: `${row.kind}: ${row.n} orphan row(s)`,
      });
    }
  }

  // ─── 5. Empty recipes (no inputs AND no steps) ─────────────────────────────
  // Drafts can legitimately be empty during authoring; flag as warn only.
  const emptyRecipes = await db.execute(sql`
    SELECT r.id, r.name, r.status
    FROM recipes r
    WHERE NOT EXISTS (SELECT 1 FROM recipe_inputs WHERE recipe_id = r.id)
      AND NOT EXISTS (SELECT 1 FROM recipe_steps  WHERE recipe_id = r.id)
      AND r.archived_at IS NULL
  `);
  for (const row of emptyRecipes.rows as any[]) {
    issues.push({
      severity: row.status === "draft" ? "warn" : "error",
      category: "empty-recipe",
      recipeId: row.id,
      recipeName: row.name,
      detail: `no inputs and no steps (status=${row.status})`,
    });
  }

  // ─── 6. Step sequence gaps / duplicates ────────────────────────────────────
  // Unique constraint on (recipe_id, sequence) prevents duplicates at the
  // DB level, but we still check for GAPS (e.g. 0,1,3 missing 2).
  const sequenceIssues = await db.execute(sql`
    SELECT r.id, r.name, COUNT(*)::int AS step_count, MAX(rs.sequence) AS max_seq
    FROM recipes r
    JOIN recipe_steps rs ON rs.recipe_id = r.id
    GROUP BY r.id
    HAVING COUNT(*) <> MAX(rs.sequence) + 1
  `);
  for (const row of sequenceIssues.rows as any[]) {
    issues.push({
      severity: "warn",
      category: "step-sequence-gap",
      recipeId: row.id,
      recipeName: row.name,
      detail: `${row.step_count} steps but max sequence is ${row.max_seq} (expected ${row.step_count - 1})`,
    });
  }

  // ─── 7. Ingredients missing additive metadata ──────────────────────────────
  const incompleteIngredients = await db.execute(sql`
    SELECT r.id, r.name, ri.label
    FROM recipe_inputs ri
    JOIN recipes r ON r.id = ri.recipe_id
    WHERE ri.kind = 'ingredient'
      AND (ri.additive_type IS NULL OR ri.additive_name IS NULL)
  `);
  for (const row of incompleteIngredients.rows as any[]) {
    issues.push({
      severity: "warn",
      category: "ingredient-missing-metadata",
      recipeId: row.id,
      recipeName: row.name,
      detail: `ingredient "${row.label}" is missing additive_type or additive_name`,
    });
  }

  // ─── 8. Parent batch inputs missing sourceProductType ──────────────────────
  const incompleteParents = await db.execute(sql`
    SELECT r.id, r.name, ri.label
    FROM recipe_inputs ri
    JOIN recipes r ON r.id = ri.recipe_id
    WHERE ri.kind = 'parent_batch_requirement'
      AND ri.source_product_type IS NULL
  `);
  for (const row of incompleteParents.rows as any[]) {
    issues.push({
      severity: "warn",
      category: "parent-input-missing-product-type",
      recipeId: row.id,
      recipeName: row.name,
      detail: `parent batch input "${row.label}" has no source_product_type`,
    });
  }

  // ─── 9. Negative / zero rate values (defense vs direct SQL inserts) ────────
  const badRates = await db.execute(sql`
    SELECT r.id, r.name, ri.label, ri.rate_value::text AS rate
    FROM recipe_inputs ri
    JOIN recipes r ON r.id = ri.recipe_id
    WHERE ri.rate_value IS NOT NULL AND ri.rate_value <= 0
  `);
  for (const row of badRates.rows as any[]) {
    issues.push({
      severity: "error",
      category: "non-positive-rate",
      recipeId: row.id,
      recipeName: row.name,
      detail: `input "${row.label}" has rate_value=${row.rate}`,
    });
  }

  // ─── 10. Date-offset triggers missing days/hours ───────────────────────────
  const badDateTriggers = await db.execute(sql`
    SELECT r.id, r.name, rs.label, rs.trigger_kind, rs.trigger_data
    FROM recipe_steps rs
    JOIN recipes r ON r.id = rs.recipe_id
    WHERE rs.trigger_kind IN ('date_offset_from_start', 'date_offset_from_previous')
      AND NOT (rs.trigger_data ? 'days' OR rs.trigger_data ? 'hours')
  `);
  for (const row of badDateTriggers.rows as any[]) {
    issues.push({
      severity: "warn",
      category: "trigger-data-incomplete",
      recipeId: row.id,
      recipeName: row.name,
      detail: `step "${row.label}" (${row.trigger_kind}) has neither days nor hours`,
    });
  }

  // ─── 11. SG threshold triggers missing sg or direction ─────────────────────
  const badSgTriggers = await db.execute(sql`
    SELECT r.id, r.name, rs.label, rs.trigger_data
    FROM recipe_steps rs
    JOIN recipes r ON r.id = rs.recipe_id
    WHERE rs.trigger_kind = 'sg_threshold'
      AND (NOT (rs.trigger_data ? 'sg') OR rs.trigger_data->>'sg' IS NULL)
  `);
  for (const row of badSgTriggers.rows as any[]) {
    issues.push({
      severity: "warn",
      category: "trigger-data-incomplete",
      recipeId: row.id,
      recipeName: row.name,
      detail: `step "${row.label}" (sg_threshold) has no target sg`,
    });
  }

  // ─── Report ────────────────────────────────────────────────────────────────
  const totalRecipes = await db.execute(sql`SELECT COUNT(*)::int AS n FROM recipes`);
  console.log(`\nAudited ${(totalRecipes.rows[0] as any).n} recipe(s).`);

  if (issues.length === 0) {
    console.log("✅ No integrity issues found.");
    process.exit(0);
  }

  // Sort: errors first, then by category, then by recipe name
  const errors = issues.filter((i) => i.severity === "error");
  const warnings = issues.filter((i) => i.severity === "warn");

  console.log(`\nFound ${errors.length} error(s) and ${warnings.length} warning(s):\n`);

  if (errors.length > 0) {
    console.log("━━━ ERRORS ━━━");
    for (const issue of errors) {
      console.log(`  [${issue.category}] ${issue.recipeName} (${issue.recipeId})`);
      console.log(`    → ${issue.detail}`);
    }
  }

  if (warnings.length > 0) {
    if (errors.length > 0) console.log();
    console.log("━━━ WARNINGS ━━━");
    for (const issue of warnings) {
      console.log(`  [${issue.category}] ${issue.recipeName} (${issue.recipeId})`);
      console.log(`    → ${issue.detail}`);
    }
  }

  // Exit 1 only when there are errors. Warnings are informational.
  process.exit(errors.length > 0 ? 1 : 0);
}

main().catch((e) => {
  console.error("Audit failed:", e);
  process.exit(2);
});
