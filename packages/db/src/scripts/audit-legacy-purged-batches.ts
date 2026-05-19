/**
 * Audits batches that were soft-deleted by the old vessel.purge flow before
 * the Destroy Batch / Prep for Cleaning rollout (commit 959f898 on
 * 2026-05-18). Those purges hid destroyed cider from TTB Form 5120.17
 * because the batch rows were soft-deleted (deleted_at IS NOT NULL) and
 * filtered out of every report.
 *
 * Categorization:
 *   - test: name contains "test" / "workflow" / "TEAP" / etc. — skip.
 *   - empty: current_volume_liters ≈ 0 at deletion time — already accounted
 *            for elsewhere (packaging, transfers). No TTB recovery needed.
 *   - destroyed: had volume > 0 at deletion — real lost cider that should
 *                be reclassified as 'discarded' with a destruction
 *                adjustment row, so TTB reports surface it.
 *
 * Read-only. Run fix-legacy-purged-batches.ts if you want to reclassify
 * the 'destroyed' bucket.
 *
 * Run:  pnpm --filter db exec tsx src/scripts/audit-legacy-purged-batches.ts
 */
import { db } from "../client";
import { sql } from "drizzle-orm";

const TEST_PATTERNS = [
  /test/i,
  /workflow/i,
  /\bteap\b/i,
  /tester/i,
];

function isTestData(name: string | null): boolean {
  if (!name) return false;
  return TEST_PATTERNS.some((re) => re.test(name));
}

async function main() {
  // Pull every soft-deleted batch, augmented with audit-log evidence of a
  // purge event (when we have it). Older purges before audit logging may
  // not have an audit row — we still flag those by deleted_at + status.
  const rows = await db.execute(sql`
    SELECT
      b.id, b.name, b.custom_name, b.status,
      b.current_volume_liters, b.initial_volume_liters,
      b.deleted_at, b.destroyed_at, b.created_at, b.vessel_id,
      al.reason AS audit_reason,
      al.changed_at AS audit_deleted_at
    FROM batches b
    LEFT JOIN audit_logs al ON al.record_id = b.id
      AND al.table_name = 'batches'
      AND (al.reason ILIKE '%vessel purge%' OR al.reason ILIKE '%purge%')
    WHERE b.deleted_at IS NOT NULL
    ORDER BY b.deleted_at DESC
  `);

  type Bucket = "test" | "empty" | "destroyed" | "already-handled";
  interface Row {
    id: string;
    label: string;
    deletedAt: string;
    volumeAtDeleteL: number;
    status: string;
    bucket: Bucket;
    auditReason: string | null;
  }

  const classified: Row[] = (rows.rows as any[]).map((r) => {
    const label = r.custom_name || r.name || "(unnamed)";
    const vol = parseFloat(r.current_volume_liters || "0");
    let bucket: Bucket;
    if (r.destroyed_at) bucket = "already-handled";
    else if (isTestData(label)) bucket = "test";
    else if (vol < 0.01) bucket = "empty";
    else bucket = "destroyed";
    return {
      id: r.id,
      label,
      deletedAt: r.deleted_at ? String(r.deleted_at).substring(0, 10) : "?",
      volumeAtDeleteL: vol,
      status: r.status,
      bucket,
      auditReason: r.audit_reason,
    };
  });

  const groups: Record<Bucket, Row[]> = {
    "destroyed": [],
    "test": [],
    "empty": [],
    "already-handled": [],
  };
  for (const r of classified) groups[r.bucket].push(r);

  console.log(`\n${classified.length} soft-deleted batch(es) total:\n`);

  if (groups.destroyed.length > 0) {
    console.log(`━━━ ${groups.destroyed.length} REAL DESTRUCTION(S) — TTB books incomplete ━━━`);
    let totalLostL = 0;
    for (const r of groups.destroyed) {
      totalLostL += r.volumeAtDeleteL;
      console.log(`  ${r.deletedAt} | ${r.label} (status=${r.status}) | ${r.volumeAtDeleteL.toFixed(3)} L lost`);
      if (r.auditReason) console.log(`    audit: "${r.auditReason}"`);
    }
    console.log(`\n  TOTAL UNRECORDED DESTRUCTION: ${totalLostL.toFixed(3)} L\n`);
    console.log(`  → run fix-legacy-purged-batches.ts to reclassify as 'discarded'`);
    console.log(`    with destruction_reason='Legacy vessel purge, reason unknown',`);
    console.log(`    so TTB Form 5120.17 loss reports surface them.\n`);
  } else {
    console.log("✅ No unrecorded destruction. TTB loss books are complete.\n");
  }

  if (groups.test.length > 0) {
    console.log(`▸ ${groups.test.length} test batches (skip):`);
    for (const r of groups.test) console.log(`  ${r.deletedAt} | ${r.label}`);
    console.log("");
  }

  if (groups.empty.length > 0) {
    console.log(`▸ ${groups.empty.length} empty batches (no recovery needed — volume was already 0 at deletion):`);
    for (const r of groups.empty.slice(0, 10)) {
      console.log(`  ${r.deletedAt} | ${r.label} (status=${r.status})`);
    }
    if (groups.empty.length > 10) console.log(`  … and ${groups.empty.length - 10} more`);
    console.log("");
  }

  if (groups["already-handled"].length > 0) {
    console.log(`▸ ${groups["already-handled"].length} already-handled (destroyed_at populated):`);
    for (const r of groups["already-handled"]) console.log(`  ${r.deletedAt} | ${r.label}`);
  }

  process.exit(0);
}

main().catch((e) => { console.error(e); process.exit(1); });
