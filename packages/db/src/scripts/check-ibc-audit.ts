import "dotenv/config";
import postgres from "postgres";

async function main() {
  const sql = postgres(process.env.DATABASE_URL!);

  const vesselId = "e2884284-2167-4ded-9b91-1cdd92d80958";

  // Check audit logs for vessel status changes
  const logs = await sql`
    SELECT al.action, al.entity_type, al.entity_id, al.changes, al.created_at, al.notes
    FROM audit_logs al
    WHERE al.entity_id = ${vesselId}
       OR al.notes LIKE '%IBC-1000-12%'
    ORDER BY al.created_at DESC
    LIMIT 15
  `;
  console.log("=== Audit Logs ===");
  for (const l of logs) {
    console.log(`${l.created_at} | ${l.action} ${l.entity_type} | ${l.notes || ""}`);
    if (l.changes) {
      const c = typeof l.changes === "string" ? JSON.parse(l.changes) : l.changes;
      if (c.status) console.log("  status change:", JSON.stringify(c.status));
      if (c.previousStatus) console.log("  previous status:", c.previousStatus);
    }
  }

  // Check vessel cleaning operations
  const cleanings = await sql`
    SELECT * FROM vessel_cleaning_operations
    WHERE vessel_id = ${vesselId}
    ORDER BY cleaned_at DESC LIMIT 5
  `;
  console.log("\n=== Cleaning Operations ===");
  console.log(cleanings);

  // Check transfers involving this vessel
  const transfers = await sql`
    SELECT bt.id, bt.transfer_type, bt.source_vessel_id, bt.destination_vessel_id,
           bt.volume, bt.volume_unit, bt.transfer_date, bt.notes,
           sv.name as source_vessel, dv.name as dest_vessel
    FROM batch_transfers bt
    LEFT JOIN vessels sv ON bt.source_vessel_id = sv.id
    LEFT JOIN vessels dv ON bt.destination_vessel_id = dv.id
    WHERE bt.source_vessel_id = ${vesselId} OR bt.destination_vessel_id = ${vesselId}
    ORDER BY bt.transfer_date DESC LIMIT 10
  `;
  console.log("\n=== Transfers ===");
  for (const t of transfers) {
    console.log(`${t.transfer_date}: ${t.transfer_type} ${t.volume}${t.volume_unit} ${t.source_vessel} → ${t.dest_vessel} | ${t.notes || ""}`);
  }

  await sql.end();
}

main().catch(console.error);
