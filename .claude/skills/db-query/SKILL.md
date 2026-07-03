---
name: db-query
description: Run a one-off SQL query or apply a migration against the cidery Postgres DB without hand-rolling a throwaway tsx script. Use whenever you need to inspect/trace data (batches, vessels, transfers, additives, lineage) or apply a .sql migration. Avoids the recurring import-path / cwd / top-level-await / "psql not installed" failures.
---

# db-query

This repo has **no working `psql` / `neonctl`** and `drizzle-kit migrate` is broken. Do NOT write a new `_tmp-*.ts` / `npx tsx -e "..."` script for every lookup — use the committed runners.

## Read a query

Always run from the repo root (`pnpm --filter` sets cwd to `packages/db`):

```bash
pnpm --filter db exec tsx scripts/query.ts "SELECT name, status, current_volume FROM vessels WHERE name ILIKE '%tank-500%'"
pnpm --filter db exec tsx scripts/query.ts --json "SELECT * FROM batch_additives WHERE batch_id = '<uuid>'"
```

- Output is a `console.table` by default, or raw JSON with `--json`.
- **Read-only by default.** Mutating statements (INSERT/UPDATE/DELETE/ALTER/…) are rejected unless you pass `--write`. Prefer a reviewed migration for any schema/data change.

## Apply a migration

```bash
pnpm --filter db exec tsx scripts/apply-migration.ts migrations/0141_whatever.sql --dry-run   # preview
pnpm --filter db exec tsx scripts/apply-migration.ts migrations/0141_whatever.sql              # apply
```

Splits on drizzle's `--> statement-breakpoint` markers, runs each statement in order, stops on first error.

**Per project rule ("always manually run the migration for me"): apply the migration with this runner yourself, then tell the user it's done.**

## When a reusable forensics query is worth keeping

If you find yourself tracing the same thing repeatedly (batch lineage, vessel volume, duplicate transfers), add a named script under `packages/db/scripts/` rather than another throwaway — the many existing `check-*.ts` / `trace-*.ts` there are the pattern.
