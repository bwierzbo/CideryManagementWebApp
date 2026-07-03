/**
 * Canonical one-off DB query runner.
 *
 * Run ANY read query without hand-rolling a throwaway script. Correct client
 * import + async wrapper + pool teardown are baked in, so you never re-derive
 * the `../src/index` vs `./src/client` / cwd / top-level-await boilerplate.
 *
 * Usage (ALWAYS from repo root — pnpm --filter sets cwd to packages/db):
 *   pnpm --filter db exec tsx scripts/query.ts "SELECT name, status FROM vessels LIMIT 5"
 *   pnpm --filter db exec tsx scripts/query.ts --json "SELECT * FROM batches WHERE custom_name ILIKE '%strawberry%'"
 *   echo "SELECT count(*) FROM batch_additives" | pnpm --filter db exec tsx scripts/query.ts
 *
 * READ-ONLY BY DEFAULT: statements that mutate (INSERT/UPDATE/DELETE/ALTER/DROP/
 * TRUNCATE) are rejected unless you pass --write. Keep destructive changes in a
 * reviewed migration + apply-migration.ts instead.
 */
import { db } from "../src/index";
import { sql } from "drizzle-orm";

async function readStdin(): Promise<string> {
  if (process.stdin.isTTY) return "";
  const chunks: Buffer[] = [];
  for await (const chunk of process.stdin) chunks.push(chunk as Buffer);
  return Buffer.concat(chunks).toString("utf8");
}

async function main() {
  const args = process.argv.slice(2);
  const asJson = args.includes("--json");
  const allowWrite = args.includes("--write");
  const query = args.filter((a) => a !== "--json" && a !== "--write").join(" ").trim()
    || (await readStdin()).trim();

  if (!query) {
    console.error(
      'No SQL provided.\n  pnpm --filter db exec tsx scripts/query.ts "SELECT ... "',
    );
    process.exit(2);
  }

  const isMutation = /^\s*(insert|update|delete|alter|drop|truncate|create|grant|revoke)\b/i.test(query);
  if (isMutation && !allowWrite) {
    console.error(
      "Refusing to run a mutating statement without --write.\n" +
        "For schema changes use a migration + `pnpm --filter db exec tsx scripts/apply-migration.ts <file.sql>`.",
    );
    process.exit(2);
  }

  const result: any = await db.execute(sql.raw(query));
  const rows = result?.rows ?? result ?? [];

  if (asJson) {
    console.log(JSON.stringify(rows, null, 2));
  } else if (Array.isArray(rows) && rows.length > 0 && typeof rows[0] === "object") {
    console.table(rows);
    console.log(`(${rows.length} row${rows.length === 1 ? "" : "s"})`);
  } else {
    console.log(rows);
  }

  process.exit(0);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
