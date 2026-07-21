/**
 * Apply a .sql migration file to the database.
 *
 * Replaces the hand-rolled `_tmp-migrate-NNNN.ts` scripts we kept re-writing
 * (drizzle-kit migrate is broken in this repo — see CLAUDE.md). Splits on
 * drizzle's `--> statement-breakpoint` markers (and falls back to `;`), runs
 * each statement in order, and stops on the first error.
 *
 * Usage (from repo root):
 *   pnpm --filter db exec tsx scripts/apply-migration.ts migrations/0141_additive_rate_g_per_l.sql
 *   pnpm --filter db exec tsx scripts/apply-migration.ts migrations/0141_additive_rate_g_per_l.sql --dry-run
 *
 * Re-run guard: applied files are recorded in `applied_migrations` (created on
 * first use) and refused on a second apply unless --force is passed. Guards
 * against re-firing one-time data backfills — migration 0113's backfill
 * silently clobbered batches.initial_volume_liters once already; a re-run
 * would do it again.
 */
import { readFileSync } from "fs";
import { resolve } from "path";
import { db } from "../src/index";
import { sql } from "drizzle-orm";

function splitStatements(raw: string): string[] {
  const stripped = raw
    .split("\n")
    .filter((l) => !l.trim().startsWith("--") || l.includes("statement-breakpoint"))
    .join("\n");
  const parts = stripped.includes("statement-breakpoint")
    ? stripped.split(/-->\s*statement-breakpoint/)
    : stripped.split(/;\s*(?:\n|$)/);
  return parts
    .map((s) => s.replace(/-->\s*statement-breakpoint/g, "").trim())
    .map((s) => s.replace(/;\s*$/, "").trim())
    .filter((s) => s.length > 0);
}

async function main() {
  const args = process.argv.slice(2);
  const dryRun = args.includes("--dry-run");
  const force = args.includes("--force");
  const file = args.find((a) => !a.startsWith("--"));

  if (!file) {
    console.error("Usage: apply-migration.ts <path-to.sql> [--dry-run] [--force]");
    process.exit(2);
  }

  const abs = resolve(process.cwd(), file);
  const filename = abs.split("/").pop()!;
  const statements = splitStatements(readFileSync(abs, "utf8"));

  if (!dryRun) {
    await db.execute(sql.raw(
      `CREATE TABLE IF NOT EXISTS applied_migrations (
        filename TEXT PRIMARY KEY,
        applied_at TIMESTAMPTZ NOT NULL DEFAULT now()
      )`,
    ));
    const prior: any = await db.execute(
      sql`SELECT applied_at FROM applied_migrations WHERE filename = ${filename}`,
    );
    const rows = prior.rows ?? prior;
    if (rows.length > 0) {
      if (!force) {
        console.error(
          `❌ ${filename} was already applied at ${rows[0].applied_at}. ` +
          `Re-running a migration can re-fire one-time data backfills. ` +
          `Pass --force only if you are certain it is safe.`,
        );
        process.exit(1);
      }
      console.log(`⚠️  ${filename} already applied at ${rows[0].applied_at} — re-running due to --force.`);
    }
  }
  console.log(`Applying ${statements.length} statement(s) from ${file}${dryRun ? " (DRY RUN)" : ""}\n`);

  for (let i = 0; i < statements.length; i++) {
    const stmt = statements[i];
    const preview = stmt.replace(/\s+/g, " ").slice(0, 120);
    console.log(`[${i + 1}/${statements.length}] ${preview}${stmt.length > 120 ? "…" : ""}`);
    if (!dryRun) await db.execute(sql.raw(stmt));
  }

  if (!dryRun) {
    await db.execute(sql`
      INSERT INTO applied_migrations (filename) VALUES (${filename})
      ON CONFLICT (filename) DO UPDATE SET applied_at = now()
    `);
  }

  console.log(dryRun ? "\nDry run complete — nothing executed." : "\n✅ Migration applied.");
  process.exit(0);
}

main().catch((e) => {
  console.error("\n❌ Migration failed:", e);
  process.exit(1);
});
