import "dotenv/config";
import postgres from "postgres";

/**
 * Red Currant chain reconciliation fix:
 * 1. Clear phantom batch in DRUM-120-3 (cef85b11...)
 * 2. Set DRUM-120-3 vessel to "cleaning"
 * 3. Fix double-counted racking losses on Red Currant chain
 * 4. Soft-delete the phantom transfer record to DRUM-120-3
 * 5. Verify final state
 */

async function main() {
  const sql = postgres(process.env.DATABASE_URL!);

  console.log("=== Red Currant Chain Reconciliation Fix ===\n");

  // ──────────────────────────────────────────────
  // Step 1: Clear the phantom batch in DRUM-120-3
  // ──────────────────────────────────────────────
  console.log("--- Step 1: Clear phantom batch in DRUM-120-3 ---");

  const phantomBatches = await sql`
    SELECT b.id, b.custom_name, b.name, b.status, b.current_volume, b.current_volume_unit, v.name as vessel_name
    FROM batches b
    JOIN vessels v ON v.id = b.vessel_id
    WHERE v.name = 'DRUM-120-3'
      AND b.custom_name ILIKE '%Red Currant%'
      AND b.deleted_at IS NULL
  `;

  if (phantomBatches.length === 0) {
    console.log("  No phantom batch found in DRUM-120-3 (may already be fixed)");
  } else {
    const phantom = phantomBatches[0];
    console.log(`  Found phantom batch: ${phantom.custom_name} (${phantom.id})`);
    console.log(`    Status: ${phantom.status}, Volume: ${phantom.current_volume} ${phantom.current_volume_unit}`);

    // Verify it starts with the expected prefix
    if (!phantom.id.startsWith("cef85b11")) {
      console.log(`  WARNING: Batch ID ${phantom.id} does not start with cef85b11. Proceeding anyway since it matches DRUM-120-3 + Red Currant criteria.`);
    }

    const cleared = await sql`
      UPDATE batches
      SET status = 'completed',
          current_volume = '0',
          current_volume_unit = 'L',
          current_volume_liters = '0',
          vessel_id = NULL,
          deleted_at = NOW(),
          end_date = NOW(),
          updated_at = NOW(),
          reconciliation_notes = COALESCE(reconciliation_notes, '') || ' [Reconciliation fix: phantom batch cleared ' || NOW()::text || ']'
      WHERE id = ${phantom.id}
      RETURNING id, custom_name
    `;
    console.log(`  Cleared phantom batch: ${cleared[0].custom_name} (${cleared[0].id})`);
  }

  // ──────────────────────────────────────────────
  // Step 2: Set DRUM-120-3 vessel to cleaning
  // ──────────────────────────────────────────────
  console.log("\n--- Step 2: Set DRUM-120-3 to cleaning ---");

  const vesselUpdate = await sql`
    UPDATE vessels
    SET status = 'cleaning', updated_at = NOW()
    WHERE name = 'DRUM-120-3'
    RETURNING id, name, status
  `;

  if (vesselUpdate.length === 0) {
    console.log("  WARNING: Vessel DRUM-120-3 not found");
  } else {
    console.log(`  Vessel ${vesselUpdate[0].name} set to status: ${vesselUpdate[0].status}`);
  }

  // ──────────────────────────────────────────────
  // Step 3: Fix double-counted racking losses
  // ──────────────────────────────────────────────
  console.log("\n--- Step 3: Fix double-counted racking losses ---");

  // 3a: Batch 991bdbd1 (DRUM-120-10 Red Currant) - delete duplicate volume adjustment
  console.log("\n  3a: Batch 991bdbd1 (DRUM-120-10 Red Currant) - duplicate volume adjustment");

  const drumBatches = await sql`
    SELECT b.id, b.custom_name, v.name as vessel_name
    FROM batches b
    LEFT JOIN vessels v ON v.id = b.vessel_id
    WHERE b.id::text LIKE '991bdbd1%'
  `;

  if (drumBatches.length === 0) {
    console.log("    Batch 991bdbd1 not found");
  } else {
    const drumBatch = drumBatches[0];
    console.log(`    Found: ${drumBatch.custom_name} (${drumBatch.id})`);

    // Find the racking operation
    const rackingOps = await sql`
      SELECT id, volume_loss, racked_at, notes
      FROM batch_racking_operations
      WHERE batch_id = ${drumBatch.id} AND deleted_at IS NULL
      ORDER BY racked_at
    `;
    console.log(`    Racking operations: ${rackingOps.length}`);
    for (const op of rackingOps) {
      console.log(`      - ${op.volume_loss}L loss at ${op.racked_at} (${op.id})`);
    }

    // Find volume adjustments that look like sediment/racking duplicates
    const volAdjs = await sql`
      SELECT id, adjustment_amount, adjustment_type, reason, adjustment_date, notes
      FROM batch_volume_adjustments
      WHERE batch_id = ${drumBatch.id} AND deleted_at IS NULL
      ORDER BY adjustment_date
    `;
    console.log(`    Volume adjustments: ${volAdjs.length}`);
    for (const adj of volAdjs) {
      console.log(`      - ${adj.adjustment_amount}L (${adj.adjustment_type}) "${adj.reason}" at ${adj.adjustment_date} (${adj.id})`);
    }

    // Find the duplicate: a volume adjustment for sediment/racking that matches the racking op loss
    if (rackingOps.length > 0) {
      const rackingLoss = parseFloat(rackingOps[0].volume_loss);
      const duplicateAdjs = volAdjs.filter((adj: any) => {
        const adjAmount = Math.abs(parseFloat(adj.adjustment_amount));
        return Math.abs(adjAmount - rackingLoss) < 0.5 &&
          (adj.reason.toLowerCase().includes("sediment") ||
           adj.reason.toLowerCase().includes("racking") ||
           adj.reason.toLowerCase().includes("lees"));
      });

      if (duplicateAdjs.length > 0) {
        for (const dup of duplicateAdjs) {
          const deleted = await sql`
            UPDATE batch_volume_adjustments
            SET deleted_at = NOW(), updated_at = NOW()
            WHERE id = ${dup.id}
            RETURNING id, adjustment_amount, reason
          `;
          console.log(`    DELETED duplicate volume adjustment: ${deleted[0].adjustment_amount}L "${deleted[0].reason}" (${deleted[0].id})`);
        }
      } else {
        console.log("    No duplicate volume adjustment found matching racking loss");
      }
    }
  }

  // 3b: Batch b1c4f5b6 (TANK-120-MIX Red Currant) - delete phantom racking operation
  console.log("\n  3b: Batch b1c4f5b6 (TANK-120-MIX Red Currant) - phantom racking operation");

  const tankBatches = await sql`
    SELECT b.id, b.custom_name, v.name as vessel_name
    FROM batches b
    LEFT JOIN vessels v ON v.id = b.vessel_id
    WHERE b.id::text LIKE 'b1c4f5b6%'
  `;

  if (tankBatches.length === 0) {
    console.log("    Batch b1c4f5b6 not found");
  } else {
    const tankBatch = tankBatches[0];
    console.log(`    Found: ${tankBatch.custom_name} (${tankBatch.id})`);

    // Find racking operations on this batch
    const tankRackingOps = await sql`
      SELECT r.id, r.volume_loss, r.racked_at, r.notes,
             sv.name as source_vessel, dv.name as dest_vessel
      FROM batch_racking_operations r
      LEFT JOIN vessels sv ON sv.id = r.source_vessel_id
      LEFT JOIN vessels dv ON dv.id = r.destination_vessel_id
      WHERE r.batch_id = ${tankBatch.id} AND r.deleted_at IS NULL
      ORDER BY r.racked_at
    `;
    console.log(`    Racking operations: ${tankRackingOps.length}`);
    for (const op of tankRackingOps) {
      console.log(`      - ${op.volume_loss}L loss at ${op.racked_at}, ${op.source_vessel} -> ${op.dest_vessel} (${op.id})`);
    }

    // The phantom racking is on the TANK but the actual racking happened on the DRUM
    // Delete racking ops that match the DRUM's racking timestamp (within a few minutes)
    if (drumBatches.length > 0) {
      const drumRackingOps = await sql`
        SELECT racked_at FROM batch_racking_operations
        WHERE batch_id = ${drumBatches[0].id} AND deleted_at IS NULL
      `;

      for (const tankOp of tankRackingOps) {
        // Check if this tank racking matches a drum racking timestamp
        const isPhantom = drumRackingOps.some((drumOp: any) => {
          const timeDiff = Math.abs(new Date(tankOp.racked_at).getTime() - new Date(drumOp.racked_at).getTime());
          return timeDiff < 5 * 60 * 1000; // within 5 minutes
        });

        if (isPhantom) {
          const deleted = await sql`
            UPDATE batch_racking_operations
            SET deleted_at = NOW(), updated_at = NOW()
            WHERE id = ${tankOp.id}
            RETURNING id, volume_loss
          `;
          console.log(`    DELETED phantom racking: ${deleted[0].volume_loss}L loss (${deleted[0].id})`);
        }
      }
    }
  }

  // ──────────────────────────────────────────────
  // Step 4: Soft-delete the transfer record to DRUM-120-3
  // ──────────────────────────────────────────────
  console.log("\n--- Step 4: Soft-delete phantom transfer to DRUM-120-3 ---");

  const drum120_3 = await sql`
    SELECT id FROM vessels WHERE name = 'DRUM-120-3'
  `;

  if (drum120_3.length > 0) {
    // Find the specific transfer from Summer Community Blend to DRUM-120-3 for the phantom Red Currant batch
    const transfers = await sql`
      SELECT t.id, t.volume_transferred, t.volume_transferred_unit, t.transferred_at, t.notes,
             sb.custom_name as source_batch_name, db.custom_name as dest_batch_name,
             sv.name as source_vessel, dv.name as dest_vessel
      FROM batch_transfers t
      JOIN batches sb ON sb.id = t.source_batch_id
      JOIN batches db ON db.id = t.destination_batch_id
      JOIN vessels sv ON sv.id = t.source_vessel_id
      JOIN vessels dv ON dv.id = t.destination_vessel_id
      WHERE t.destination_vessel_id = ${drum120_3[0].id}
        AND t.deleted_at IS NULL
        AND sb.custom_name ILIKE '%Summer Community Blend%'
      ORDER BY t.transferred_at
    `;

    console.log(`  Transfers from Summer Community Blend to DRUM-120-3: ${transfers.length}`);
    for (const t of transfers) {
      console.log(`    - ${t.volume_transferred} ${t.volume_transferred_unit} from "${t.source_batch_name}" (${t.source_vessel}) at ${t.transferred_at} (${t.id})`);

      const deleted = await sql`
        UPDATE batch_transfers
        SET deleted_at = NOW(), updated_at = NOW()
        WHERE id = ${t.id}
        RETURNING id
      `;
      console.log(`    DELETED transfer ${deleted[0].id}`);
    }
  } else {
    console.log("  Vessel DRUM-120-3 not found");
  }

  // ──────────────────────────────────────────────
  // Step 5: Verify final state
  // ──────────────────────────────────────────────
  console.log("\n\n========== VERIFICATION ==========\n");

  // DRUM-120-3 vessel status
  console.log("--- DRUM-120-3 Vessel Status ---");
  const vesselState = await sql`
    SELECT v.id, v.name, v.status, v.capacity, v.capacity_unit
    FROM vessels v
    WHERE v.name = 'DRUM-120-3'
  `;
  if (vesselState.length > 0) {
    const v = vesselState[0];
    console.log(`  ${v.name}: status=${v.status}, capacity=${v.capacity} ${v.capacity_unit}`);

    // Check for any active batches still on this vessel
    const activeBatches = await sql`
      SELECT id, custom_name, status, current_volume, current_volume_unit
      FROM batches
      WHERE vessel_id = ${v.id} AND deleted_at IS NULL
    `;
    console.log(`  Active batches on vessel: ${activeBatches.length}`);
    for (const b of activeBatches) {
      console.log(`    - ${b.custom_name}: status=${b.status}, volume=${b.current_volume} ${b.current_volume_unit}`);
    }
  }

  // All Red Currant batches
  console.log("\n--- All Red Currant Batches ---");
  const redCurrantBatches = await sql`
    SELECT b.id, b.custom_name, b.name, b.status, b.current_volume, b.current_volume_unit,
           b.initial_volume, b.initial_volume_unit, b.deleted_at,
           v.name as vessel_name
    FROM batches b
    LEFT JOIN vessels v ON v.id = b.vessel_id
    WHERE b.custom_name ILIKE '%Red Currant%'
    ORDER BY b.created_at
  `;
  for (const b of redCurrantBatches) {
    const deletedTag = b.deleted_at ? " [DELETED]" : "";
    const vesselTag = b.vessel_name || "no vessel";
    console.log(`  ${b.custom_name} (${b.id.substring(0, 8)}...)${deletedTag}`);
    console.log(`    Status: ${b.status}, Vessel: ${vesselTag}`);
    console.log(`    Volume: ${b.initial_volume} ${b.initial_volume_unit} initial -> ${b.current_volume} ${b.current_volume_unit} current`);

    // Show remaining racking ops
    const ops = await sql`
      SELECT volume_loss, racked_at FROM batch_racking_operations
      WHERE batch_id = ${b.id} AND deleted_at IS NULL ORDER BY racked_at
    `;
    if (ops.length > 0) {
      console.log(`    Active racking ops: ${ops.map((o: any) => `${o.volume_loss}L`).join(", ")}`);
    }

    // Show remaining volume adjustments
    const adjs = await sql`
      SELECT adjustment_amount, reason FROM batch_volume_adjustments
      WHERE batch_id = ${b.id} AND deleted_at IS NULL ORDER BY adjustment_date
    `;
    if (adjs.length > 0) {
      console.log(`    Active vol adjustments: ${adjs.map((a: any) => `${a.adjustment_amount}L (${a.reason})`).join(", ")}`);
    }
  }

  // Summer Community Blend parent batch
  console.log("\n--- Summer Community Blend Parent Batch ---");
  const parentBatches = await sql`
    SELECT b.id, b.custom_name, b.name, b.status, b.current_volume, b.current_volume_unit,
           b.initial_volume, b.initial_volume_unit,
           v.name as vessel_name
    FROM batches b
    LEFT JOIN vessels v ON v.id = b.vessel_id
    WHERE b.custom_name ILIKE '%Summer Community Blend%'
      AND b.deleted_at IS NULL
    ORDER BY b.created_at
  `;
  for (const b of parentBatches) {
    console.log(`  ${b.custom_name} (${b.id.substring(0, 8)}...)`);
    console.log(`    Status: ${b.status}, Vessel: ${b.vessel_name || "no vessel"}`);
    console.log(`    Volume: ${b.initial_volume} ${b.initial_volume_unit} initial -> ${b.current_volume} ${b.current_volume_unit} current`);

    // Show active transfers from this batch
    const outTransfers = await sql`
      SELECT t.volume_transferred, t.volume_transferred_unit, t.loss, t.loss_unit,
             db.custom_name as dest_batch, dv.name as dest_vessel, t.deleted_at
      FROM batch_transfers t
      JOIN batches db ON db.id = t.destination_batch_id
      JOIN vessels dv ON dv.id = t.destination_vessel_id
      WHERE t.source_batch_id = ${b.id}
      ORDER BY t.transferred_at
    `;
    console.log(`    Transfers out (including deleted):`);
    for (const t of outTransfers) {
      const tag = t.deleted_at ? " [DELETED]" : "";
      console.log(`      -> ${t.dest_batch} (${t.dest_vessel}): ${t.volume_transferred} ${t.volume_transferred_unit}, loss=${t.loss} ${t.loss_unit}${tag}`);
    }

    // Show racking ops
    const rOps = await sql`
      SELECT volume_loss, racked_at, deleted_at FROM batch_racking_operations
      WHERE batch_id = ${b.id} ORDER BY racked_at
    `;
    if (rOps.length > 0) {
      console.log(`    Racking ops:`);
      for (const op of rOps) {
        const tag = op.deleted_at ? " [DELETED]" : "";
        console.log(`      ${op.volume_loss}L at ${op.racked_at}${tag}`);
      }
    }

    // Show volume adjustments
    const vAdjs = await sql`
      SELECT adjustment_amount, reason, deleted_at FROM batch_volume_adjustments
      WHERE batch_id = ${b.id} ORDER BY adjustment_date
    `;
    if (vAdjs.length > 0) {
      console.log(`    Volume adjustments:`);
      for (const adj of vAdjs) {
        const tag = adj.deleted_at ? " [DELETED]" : "";
        console.log(`      ${adj.adjustment_amount}L (${adj.reason})${tag}`);
      }
    }
  }

  console.log("\n=== Reconciliation fix complete ===");
  await sql.end();
}

main().catch((err) => {
  console.error("FATAL:", err);
  process.exit(1);
});
