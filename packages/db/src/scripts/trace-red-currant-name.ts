import { Pool } from "pg";
import * as dotenv from "dotenv";
import { join } from "path";

dotenv.config({ path: join(__dirname, "../../../../.env") });

const BATCH_CEF = "cef85b11"; // DRUM-120-3 "Red Currant" ghost
const BATCH_6A0 = "6a06ce10"; // TANK-1000-2 parent (Summer Community Blend 1)
const BATCH_991 = "991bdbd1"; // DRUM-120-10

async function trace() {
  const pool = new Pool({ connectionString: process.env.DATABASE_URL });
  const client = await pool.connect();

  try {
    // Helper to pretty-print JSON
    const j = (v: unknown) => JSON.stringify(v, null, 2);

    // ─── 1. Current state of all three batches ───────────────────────
    console.log("═══════════════════════════════════════════════════════════");
    console.log("1. CURRENT STATE OF THE THREE BATCHES");
    console.log("═══════════════════════════════════════════════════════════\n");

    for (const prefix of [BATCH_CEF, BATCH_6A0, BATCH_991]) {
      const res = await client.query(
        `SELECT b.id, b.custom_name, b.status, b.created_at,
                v.name as vessel_name
         FROM batches b
         LEFT JOIN vessels v ON b.vessel_id = v.id
         WHERE b.id::text LIKE $1
         LIMIT 1`,
        [`${prefix}%`]
      );
      if (res.rows.length > 0) {
        const r = res.rows[0];
        console.log(
          `  ${prefix}: custom_name="${r.custom_name}", status=${r.status}, vessel=${r.vessel_name}, created=${r.created_at}`
        );
      } else {
        console.log(`  ${prefix}: NOT FOUND`);
      }
    }

    // ─── 2. All audit logs for batch cef85b11 ────────────────────────
    console.log("\n═══════════════════════════════════════════════════════════");
    console.log("2. ALL AUDIT LOGS FOR BATCH cef85b11 (DRUM-120-3)");
    console.log("═══════════════════════════════════════════════════════════\n");

    const cefLogs = await client.query(
      `SELECT al.*, u.name as user_name, u.email as user_email
       FROM audit_logs al
       LEFT JOIN users u ON al.changed_by = u.id
       WHERE al.table_name = 'batches'
         AND al.record_id::text LIKE $1
       ORDER BY al.changed_at ASC`,
      [`${BATCH_CEF}%`]
    );

    if (cefLogs.rows.length === 0) {
      console.log("  No audit logs found for this batch.");
    }
    for (const row of cefLogs.rows) {
      console.log(`  --- ${row.operation} at ${row.changed_at} ---`);
      console.log(`  Changed by: ${row.user_name || "UNKNOWN"} (${row.user_email || row.changed_by_email || "no email"})`);
      if (row.operation === "create") {
        const nd = row.new_data as Record<string, unknown> | null;
        console.log(`  [CREATE] custom_name in new_data: "${nd?.custom_name ?? nd?.customName ?? "NOT SET"}"`);
        console.log(`  Full new_data: ${j(nd)}`);
      } else if (row.operation === "update") {
        const dd = row.diff_data as Record<string, unknown> | null;
        const od = row.old_data as Record<string, unknown> | null;
        const nd = row.new_data as Record<string, unknown> | null;
        // Check if custom_name is in the diff
        const diffHasName =
          dd &&
          (("custom_name" in dd) || ("customName" in dd));
        if (diffHasName) {
          console.log(`  *** custom_name CHANGED in this update ***`);
          console.log(`  diff_data: ${j(dd)}`);
        }
        console.log(`  old custom_name: "${od?.custom_name ?? od?.customName ?? "N/A"}"`);
        console.log(`  new custom_name: "${nd?.custom_name ?? nd?.customName ?? "N/A"}"`);
        console.log(`  diff_data keys: ${dd ? Object.keys(dd).join(", ") : "null"}`);
      }
      console.log();
    }

    // ─── 3. Check if custom_name was set at creation for cef85b11 ────
    console.log("═══════════════════════════════════════════════════════════");
    console.log("3. WAS custom_name SET AT CREATION for cef85b11?");
    console.log("═══════════════════════════════════════════════════════════\n");

    const cefCreate = cefLogs.rows.find((r: { operation: string }) => r.operation === "create");
    if (cefCreate) {
      const nd = cefCreate.new_data as Record<string, unknown> | null;
      const nameAtCreation = nd?.custom_name ?? nd?.customName;
      if (nameAtCreation) {
        console.log(`  YES - custom_name was "${nameAtCreation}" at creation time.`);
        console.log(`  This means it was inherited from the parent batch during transfer.`);
      } else {
        console.log(`  NO - custom_name was not set at creation.`);
        console.log(`  It was set in a later update.`);
      }
    } else {
      console.log("  No 'create' audit log found for this batch.");
    }

    // ─── 4. Audit logs for parent batch 6a06ce10 ────────────────────
    console.log("\n═══════════════════════════════════════════════════════════");
    console.log("4. AUDIT LOGS FOR PARENT BATCH 6a06ce10 (TANK-1000-2)");
    console.log("   Looking for custom_name changes...");
    console.log("═══════════════════════════════════════════════════════════\n");

    const parentLogs = await client.query(
      `SELECT al.*, u.name as user_name, u.email as user_email
       FROM audit_logs al
       LEFT JOIN users u ON al.changed_by = u.id
       WHERE al.table_name = 'batches'
         AND al.record_id::text LIKE $1
       ORDER BY al.changed_at ASC`,
      [`${BATCH_6A0}%`]
    );

    console.log(`  Total audit entries: ${parentLogs.rows.length}\n`);

    for (const row of parentLogs.rows) {
      const dd = row.diff_data as Record<string, unknown> | null;
      const nd = row.new_data as Record<string, unknown> | null;
      const od = row.old_data as Record<string, unknown> | null;

      const nameInDiff = dd && (("custom_name" in dd) || ("customName" in dd));
      const nameInNew = nd && (nd.custom_name !== undefined || nd.customName !== undefined);

      if (row.operation === "create" || nameInDiff) {
        console.log(`  --- ${row.operation} at ${row.changed_at} ---`);
        console.log(`  Changed by: ${row.user_name || "UNKNOWN"} (${row.user_email || row.changed_by_email || "no email"})`);
        if (row.operation === "create") {
          console.log(`  [CREATE] custom_name: "${nd?.custom_name ?? nd?.customName ?? "NOT SET"}"`);
        }
        if (nameInDiff) {
          console.log(`  *** custom_name CHANGED ***`);
          console.log(`  old: "${od?.custom_name ?? od?.customName ?? "N/A"}"`);
          console.log(`  new: "${nd?.custom_name ?? nd?.customName ?? "N/A"}"`);
          console.log(`  diff_data: ${j(dd)}`);
        }
        console.log();
      }
    }

    // Show all entries summary
    console.log("  All entries summary (operation | timestamp | diff keys):");
    for (const row of parentLogs.rows) {
      const dd = row.diff_data as Record<string, unknown> | null;
      console.log(
        `    ${row.operation.padEnd(12)} | ${row.changed_at} | ${dd ? Object.keys(dd).join(", ") : "(no diff)"}`
      );
    }

    // ─── 5. All audit logs for batch 991bdbd1 ────────────────────────
    console.log("\n═══════════════════════════════════════════════════════════");
    console.log("5. ALL AUDIT LOGS FOR BATCH 991bdbd1 (DRUM-120-10)");
    console.log("═══════════════════════════════════════════════════════════\n");

    const b991Logs = await client.query(
      `SELECT al.*, u.name as user_name, u.email as user_email
       FROM audit_logs al
       LEFT JOIN users u ON al.changed_by = u.id
       WHERE al.table_name = 'batches'
         AND al.record_id::text LIKE $1
       ORDER BY al.changed_at ASC`,
      [`${BATCH_991}%`]
    );

    if (b991Logs.rows.length === 0) {
      console.log("  No audit logs found for this batch.");
    }
    for (const row of b991Logs.rows) {
      const dd = row.diff_data as Record<string, unknown> | null;
      const nd = row.new_data as Record<string, unknown> | null;
      const od = row.old_data as Record<string, unknown> | null;

      console.log(`  --- ${row.operation} at ${row.changed_at} ---`);
      console.log(`  Changed by: ${row.user_name || "UNKNOWN"} (${row.user_email || row.changed_by_email || "no email"})`);

      if (row.operation === "create") {
        console.log(`  [CREATE] custom_name: "${nd?.custom_name ?? nd?.customName ?? "NOT SET"}"`);
        console.log(`  Full new_data: ${j(nd)}`);
      } else if (row.operation === "update") {
        const nameInDiff = dd && (("custom_name" in dd) || ("customName" in dd));
        if (nameInDiff) {
          console.log(`  *** custom_name CHANGED ***`);
          console.log(`  old: "${od?.custom_name ?? od?.customName ?? "N/A"}"`);
          console.log(`  new: "${nd?.custom_name ?? nd?.customName ?? "N/A"}"`);
          console.log(`  diff_data: ${j(dd)}`);
        } else {
          console.log(`  diff_data keys: ${dd ? Object.keys(dd).join(", ") : "null"}`);
        }
      }
      console.log();
    }

    // ─── 6. Check batch_transfers records for context ──────────────
    console.log("═══════════════════════════════════════════════════════════");
    console.log("6. BATCH_TRANSFERS INVOLVING THESE BATCHES");
    console.log("═══════════════════════════════════════════════════════════\n");

    const transfers = await client.query(
      `SELECT t.id, t.source_batch_id, t.destination_batch_id,
              t.volume_transferred, t.transferred_at, t.created_at, t.notes,
              sb.custom_name as source_name, db.custom_name as dest_name,
              sv.name as source_vessel, dv.name as dest_vessel
       FROM batch_transfers t
       LEFT JOIN batches sb ON t.source_batch_id = sb.id
       LEFT JOIN batches db ON t.destination_batch_id = db.id
       LEFT JOIN vessels sv ON sb.vessel_id = sv.id
       LEFT JOIN vessels dv ON db.vessel_id = dv.id
       WHERE t.source_batch_id::text LIKE $1
          OR t.destination_batch_id::text LIKE $1
          OR t.source_batch_id::text LIKE $2
          OR t.destination_batch_id::text LIKE $2
          OR t.source_batch_id::text LIKE $3
          OR t.destination_batch_id::text LIKE $3
       ORDER BY t.transferred_at ASC`,
      [`${BATCH_CEF}%`, `${BATCH_6A0}%`, `${BATCH_991}%`]
    );

    for (const t of transfers.rows) {
      console.log(
        `  ${t.transferred_at}: ${t.source_vessel}(${t.source_name}) -> ${t.dest_vessel}(${t.dest_name}) [${t.volume_transferred} L] notes: ${t.notes || "none"}`
      );
    }

    // ─── 6b. Search ALL audit logs for "Red Currant" anywhere ────────
    console.log("\n═══════════════════════════════════════════════════════════");
    console.log("6b. ALL AUDIT LOGS MENTIONING 'Red Currant' (any table)");
    console.log("═══════════════════════════════════════════════════════════\n");

    const redCurrantLogs = await client.query(
      `SELECT al.*, u.name as user_name, u.email as user_email
       FROM audit_logs al
       LEFT JOIN users u ON al.changed_by = u.id
       WHERE al.new_data::text ILIKE '%Red Currant%'
          OR al.old_data::text ILIKE '%Red Currant%'
          OR al.diff_data::text ILIKE '%Red Currant%'
       ORDER BY al.changed_at ASC`
    );

    console.log(`  Found ${redCurrantLogs.rows.length} entries mentioning "Red Currant":\n`);
    for (const row of redCurrantLogs.rows) {
      console.log(`  --- ${row.table_name}.${row.record_id} ${row.operation} at ${row.changed_at} ---`);
      console.log(`  Changed by: ${row.user_name || "UNKNOWN"} (${row.user_email || row.changed_by_email || "no email"})`);
      // Show relevant custom_name info
      const nd = row.new_data as Record<string, unknown> | null;
      const od = row.old_data as Record<string, unknown> | null;
      const dd = row.diff_data as Record<string, unknown> | null;
      if (nd?.custom_name || nd?.customName) console.log(`  new_data custom_name: "${nd?.custom_name ?? nd?.customName}"`);
      if (od?.custom_name || od?.customName) console.log(`  old_data custom_name: "${od?.custom_name ?? od?.customName}"`);
      if (dd?.custom_name || dd?.customName) console.log(`  diff_data custom_name: "${dd?.custom_name ?? dd?.customName}"`);
      // Also check name field
      if (nd?.name) console.log(`  new_data name: "${nd.name}"`);
      if (od?.name) console.log(`  old_data name: "${od.name}"`);
      console.log();
    }

    // ─── 6c. Check if there are batch updates NOT in audit for cef85b11 ──
    console.log("═══════════════════════════════════════════════════════════");
    console.log("6c. BATCH cef85b11 updated_at vs audit log coverage");
    console.log("═══════════════════════════════════════════════════════════\n");

    const batchUpdatedAt = await client.query(
      `SELECT updated_at, created_at FROM batches WHERE id::text LIKE $1`,
      [`${BATCH_CEF}%`]
    );
    if (batchUpdatedAt.rows.length > 0) {
      console.log(`  created_at: ${batchUpdatedAt.rows[0].created_at}`);
      console.log(`  updated_at: ${batchUpdatedAt.rows[0].updated_at}`);
      console.log(`  Audit entries: ${cefLogs.rows.length}`);
      if (batchUpdatedAt.rows[0].updated_at > batchUpdatedAt.rows[0].created_at && cefLogs.rows.length <= 1) {
        console.log(`  WARNING: Batch was updated after creation but has no update audit logs!`);
        console.log(`  The custom_name change may have happened before audit logging was enabled.`);
      }
    }

    // ─── 7. Summary / Conclusion ─────────────────────────────────────
    console.log("\n═══════════════════════════════════════════════════════════");
    console.log("7. SUMMARY");
    console.log("═══════════════════════════════════════════════════════════\n");

    // Determine when cef85b11 got "Red Currant"
    if (cefCreate) {
      const nd = cefCreate.new_data as Record<string, unknown> | null;
      const nameAtCreation = nd?.custom_name ?? nd?.customName;
      if (nameAtCreation === "Red Currant") {
        console.log(`  Batch cef85b11 was created with custom_name="Red Currant".`);
        console.log(`  This was INHERITED during transfer at ${cefCreate.changed_at}.`);
        console.log(`  Changed by: ${cefCreate.user_name || cefCreate.changed_by_email || "UNKNOWN"}`);
      } else {
        // Find the update that set it
        const nameUpdate = cefLogs.rows.find((r: { operation: string; diff_data: Record<string, unknown> | null }) => {
          if (r.operation !== "update") return false;
          const d = r.diff_data as Record<string, unknown> | null;
          return d && (("custom_name" in d) || ("customName" in d));
        });
        if (nameUpdate) {
          console.log(`  Batch cef85b11 was MANUALLY renamed to "Red Currant".`);
          console.log(`  When: ${nameUpdate.changed_at}`);
          console.log(`  By: ${nameUpdate.user_name || nameUpdate.changed_by_email || "UNKNOWN"}`);
        } else {
          console.log(`  Could not determine when cef85b11 got the name "Red Currant".`);
          console.log(`  It was created with: "${nameAtCreation}" and no name-change update was found.`);
        }
      }
    }

    console.log("\nDone.");
  } finally {
    client.release();
    await pool.end();
  }
}

trace().catch((err) => {
  console.error("Error:", err);
  process.exit(1);
});
