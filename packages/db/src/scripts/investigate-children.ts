import "dotenv/config";
import pg from "pg";

const c = new pg.Client({
  connectionString: process.env.DATABASE_URL,
  ssl: { rejectUnauthorized: false },
});

const G = (l: number) => (l / 3.78541).toFixed(4);

async function run() {
  await c.connect();

  // ──────────────────────────────────────────────────────────────────
  // 1. Find "Base Cider" batch
  // ──────────────────────────────────────────────────────────────────
  console.log("=== 1. FINDING BASE CIDER BATCH ===");
  const baseCiderRes = await c.query(
    `SELECT id, name, batch_number, product_type,
            CAST(initial_volume_liters AS float) AS init_l,
            CAST(current_volume_liters AS float) AS cur_l,
            parent_batch_id, start_date, reconciliation_status,
            is_racking_derivative, deleted_at
     FROM batches
     WHERE deleted_at IS NULL
       AND (name ILIKE '%Base Cider%' OR batch_number ILIKE '%UNKN_BLEND_A-R%')
       AND product_type IN ('wine', 'cider')
     ORDER BY start_date DESC`
  );

  if (baseCiderRes.rows.length === 0) {
    console.log("  BASE CIDER BATCH NOT FOUND!");
    await c.end();
    return;
  }

  for (const r of baseCiderRes.rows) {
    console.log(`  ID: ${r.id}`);
    console.log(`  Name: ${r.name}`);
    console.log(`  Batch#: ${r.batch_number}`);
    console.log(`  Product Type: ${r.product_type}`);
    console.log(`  Initial: ${r.init_l} L (${G(r.init_l)} gal)`);
    console.log(`  Current: ${r.cur_l} L (${G(r.cur_l)} gal)`);
    console.log(`  Recon Status: ${r.reconciliation_status}`);
    console.log(`  Is Racking Derivative: ${r.is_racking_derivative}`);
    console.log(`  Start Date: ${r.start_date}`);
    console.log();
  }

  // Use the first match
  const baseBatchId = baseCiderRes.rows[0].id;
  const baseBatchName = baseCiderRes.rows[0].name;
  console.log(`Using Base Cider batch: ${baseBatchName} (${baseBatchId})\n`);

  // ──────────────────────────────────────────────────────────────────
  // 2. List all child batches of Base Cider
  // ──────────────────────────────────────────────────────────────────
  console.log("=== 2. CHILD BATCHES (parent_batch_id = Base Cider) ===");
  const childRes = await c.query(
    `SELECT id, name, batch_number, product_type,
            CAST(initial_volume_liters AS float) AS init_l,
            CAST(current_volume_liters AS float) AS cur_l,
            is_racking_derivative, reconciliation_status,
            start_date, deleted_at
     FROM batches
     WHERE parent_batch_id = $1
     ORDER BY start_date`,
    [baseBatchId]
  );

  if (childRes.rows.length === 0) {
    console.log("  (no children found)\n");
  } else {
    console.log(`  Found ${childRes.rows.length} children:\n`);
    for (const child of childRes.rows) {
      console.log(`  --- ${child.name} (${child.id}) ---`);
      console.log(`    Batch#: ${child.batch_number}`);
      console.log(`    Product Type: ${child.product_type}`);
      console.log(`    Initial: ${child.init_l} L (${G(child.init_l)} gal)`);
      console.log(`    Current: ${child.cur_l} L (${G(child.cur_l)} gal)`);
      console.log(`    Is Racking Derivative: ${child.is_racking_derivative}`);
      console.log(`    Recon Status: ${child.reconciliation_status}`);
      console.log(`    Start Date: ${child.start_date}`);
      console.log(`    Deleted: ${child.deleted_at}`);
    }
    console.log();
  }

  // ──────────────────────────────────────────────────────────────────
  // 3. For each child, check batch_transfers where destination = child
  // ──────────────────────────────────────────────────────────────────
  console.log("=== 3. BATCH_TRANSFERS INTO EACH CHILD (destination_batch_id = child) ===");
  for (const child of childRes.rows) {
    const txIn = await c.query(
      `SELECT id, source_batch_id,
              CAST(volume_transferred AS float) AS vol,
              CAST(COALESCE(loss, '0') AS float) AS loss,
              transferred_at, deleted_at
       FROM batch_transfers
       WHERE destination_batch_id = $1
       ORDER BY transferred_at`,
      [child.id]
    );
    console.log(`  Child: ${child.name} (init=${child.init_l}L)`);
    if (txIn.rows.length === 0) {
      console.log(`    ** NO batch_transfers INTO this child **`);
    } else {
      for (const tx of txIn.rows) {
        console.log(`    Transfer ${tx.id}: ${tx.vol} L (${G(tx.vol)} gal) from batch ${tx.source_batch_id}, loss=${tx.loss} L, at=${tx.transferred_at}, deleted=${tx.deleted_at}`);
      }
    }
  }
  console.log();

  // ──────────────────────────────────────────────────────────────────
  // 4. Batch_transfers where source = Base Cider
  // ──────────────────────────────────────────────────────────────────
  console.log("=== 4. BATCH_TRANSFERS OUT OF BASE CIDER (source_batch_id = Base Cider) ===");
  const txFromBase = await c.query(
    `SELECT bt.id, bt.destination_batch_id,
            CAST(bt.volume_transferred AS float) AS vol,
            CAST(COALESCE(bt.loss, '0') AS float) AS loss,
            bt.transferred_at, bt.deleted_at,
            b.name AS dest_name
     FROM batch_transfers bt
     LEFT JOIN batches b ON b.id = bt.destination_batch_id
     WHERE bt.source_batch_id = $1
     ORDER BY bt.transferred_at`,
    [baseBatchId]
  );
  if (txFromBase.rows.length === 0) {
    console.log("  (no transfers out of Base Cider)\n");
  } else {
    console.log(`  Found ${txFromBase.rows.length} transfers out:\n`);
    for (const tx of txFromBase.rows) {
      console.log(`  Transfer ${tx.id}: ${tx.vol} L (${G(tx.vol)} gal) -> ${tx.dest_name} (${tx.destination_batch_id}), loss=${tx.loss} L, at=${tx.transferred_at}, deleted=${tx.deleted_at}`);
    }
    console.log();
  }

  // ──────────────────────────────────────────────────────────────────
  // 5. Summary: ALL batches with parent AND initial > 0, with/without transfers
  // ──────────────────────────────────────────────────────────────────
  console.log("=== 5. ALL NON-ZERO-INITIAL CHILDREN (parent_batch_id NOT NULL, initial > 0) ===");
  const allChildrenRes = await c.query(
    `SELECT b.id, b.name, b.batch_number, b.product_type,
            CAST(b.initial_volume_liters AS float) AS init_l,
            CAST(b.current_volume_liters AS float) AS cur_l,
            b.is_racking_derivative, b.reconciliation_status,
            b.parent_batch_id, b.deleted_at,
            EXISTS (
              SELECT 1 FROM batch_transfers bt
              WHERE bt.destination_batch_id = b.id AND bt.deleted_at IS NULL
            ) AS has_transfer_in,
            (
              SELECT COALESCE(SUM(CAST(bt.volume_transferred AS float)), 0)
              FROM batch_transfers bt
              WHERE bt.destination_batch_id = b.id AND bt.deleted_at IS NULL
            ) AS total_transfer_in
     FROM batches b
     WHERE b.parent_batch_id IS NOT NULL
       AND b.deleted_at IS NULL
       AND CAST(b.initial_volume_liters AS float) > 0
     ORDER BY b.start_date`
  );

  let withTransfer = 0;
  let withoutTransfer = 0;
  let sumInitWithTransfer = 0;
  let sumInitWithoutTransfer = 0;

  console.log(`  Found ${allChildrenRes.rows.length} non-zero-initial children:\n`);
  for (const r of allChildrenRes.rows) {
    const hasTx = r.has_transfer_in;
    if (hasTx) {
      withTransfer++;
      sumInitWithTransfer += r.init_l;
    } else {
      withoutTransfer++;
      sumInitWithoutTransfer += r.init_l;
    }
    console.log(`  ${hasTx ? "HAS_TX" : "NO_TX "} | ${r.name.substring(0, 55).padEnd(55)} | init=${r.init_l.toFixed(2)}L (${G(r.init_l)} gal) | txIn=${r.total_transfer_in.toFixed(2)}L | recon=${r.reconciliation_status} | racking=${r.is_racking_derivative}`);
  }
  console.log();
  console.log(`  WITH batch_transfers:    ${withTransfer} batches, SUM(initial)=${sumInitWithTransfer.toFixed(2)} L (${G(sumInitWithTransfer)} gal)`);
  console.log(`  WITHOUT batch_transfers: ${withoutTransfer} batches, SUM(initial)=${sumInitWithoutTransfer.toFixed(2)} L (${G(sumInitWithoutTransfer)} gal)`);
  console.log();

  // ──────────────────────────────────────────────────────────────────
  // 6. Aggregate transfer imbalance for eligible batches
  // ──────────────────────────────────────────────────────────────────
  console.log("=== 6. AGGREGATE TRANSFER IMBALANCE (eligible batches) ===");

  // Build eligible batch set:
  // deleted_at IS NULL AND product_type != 'juice'
  // AND (reconciliation_status NOT IN ('duplicate', 'excluded') OR is_racking_derivative OR parent_batch_id IS NOT NULL)
  const eligibleRes = await c.query(
    `SELECT id FROM batches
     WHERE deleted_at IS NULL
       AND product_type != 'juice'
       AND (
         COALESCE(reconciliation_status, 'pending') NOT IN ('duplicate', 'excluded')
         OR is_racking_derivative = true
         OR parent_batch_id IS NOT NULL
       )`
  );

  const eligibleIds = eligibleRes.rows.map((r: any) => r.id);
  console.log(`  Eligible batch count: ${eligibleIds.length}`);

  if (eligibleIds.length === 0) {
    console.log("  No eligible batches found.");
    await c.end();
    return;
  }

  // Use a temp approach with parameterized ANY()
  const transferOutRes = await c.query(
    `SELECT COALESCE(SUM(CAST(volume_transferred AS float)), 0) AS total_out,
            COALESCE(SUM(CAST(COALESCE(loss, '0') AS float)), 0) AS total_loss_out,
            COUNT(*) AS count_out
     FROM batch_transfers
     WHERE source_batch_id = ANY($1::uuid[])
       AND deleted_at IS NULL`,
    [eligibleIds]
  );

  const transferInRes = await c.query(
    `SELECT COALESCE(SUM(CAST(volume_transferred AS float)), 0) AS total_in,
            COALESCE(SUM(CAST(COALESCE(loss, '0') AS float)), 0) AS total_loss_in,
            COUNT(*) AS count_in
     FROM batch_transfers
     WHERE destination_batch_id = ANY($1::uuid[])
       AND deleted_at IS NULL`,
    [eligibleIds]
  );

  const outRow = transferOutRes.rows[0];
  const inRow = transferInRes.rows[0];

  console.log(`  Transfers OUT (source in eligible): ${outRow.total_out.toFixed(4)} L (${G(outRow.total_out)} gal), loss=${outRow.total_loss_out.toFixed(4)} L, count=${outRow.count_out}`);
  console.log(`  Transfers IN  (dest in eligible):   ${inRow.total_in.toFixed(4)} L (${G(inRow.total_in)} gal), loss=${inRow.total_loss_in.toFixed(4)} L, count=${inRow.count_in}`);
  console.log();
  const imbalance = inRow.total_in - outRow.total_out;
  console.log(`  IMBALANCE (IN - OUT): ${imbalance.toFixed(4)} L (${G(imbalance)} gal)`);
  console.log(`  (Positive = more volume entering than leaving eligible set via transfers)`);
  console.log(`  Transfer losses (OUT side): ${outRow.total_loss_out.toFixed(4)} L (${G(outRow.total_loss_out)} gal)`);

  // Also check: transfers where source is eligible but dest is NOT eligible (volume leaking out of set)
  const leakOutRes = await c.query(
    `SELECT COALESCE(SUM(CAST(bt.volume_transferred AS float)), 0) AS vol,
            COUNT(*) AS cnt
     FROM batch_transfers bt
     WHERE bt.source_batch_id = ANY($1::uuid[])
       AND bt.deleted_at IS NULL
       AND bt.destination_batch_id != ALL($1::uuid[])`,
    [eligibleIds]
  );

  // Transfers where dest is eligible but source is NOT eligible (volume leaking in from outside set)
  const leakInRes = await c.query(
    `SELECT COALESCE(SUM(CAST(bt.volume_transferred AS float)), 0) AS vol,
            COUNT(*) AS cnt
     FROM batch_transfers bt
     WHERE bt.destination_batch_id = ANY($1::uuid[])
       AND bt.deleted_at IS NULL
       AND bt.source_batch_id != ALL($1::uuid[])`,
    [eligibleIds]
  );

  console.log();
  console.log(`  Transfers OUT of eligible set (source=eligible, dest=NOT eligible): ${leakOutRes.rows[0].vol.toFixed(4)} L (${G(leakOutRes.rows[0].vol)} gal), count=${leakOutRes.rows[0].cnt}`);
  console.log(`  Transfers INTO eligible set (dest=eligible, source=NOT eligible):   ${leakInRes.rows[0].vol.toFixed(4)} L (${G(leakInRes.rows[0].vol)} gal), count=${leakInRes.rows[0].cnt}`);

  // Also show transfers where BOTH source and dest are in eligible (internal)
  const internalRes = await c.query(
    `SELECT COALESCE(SUM(CAST(bt.volume_transferred AS float)), 0) AS vol,
            COUNT(*) AS cnt
     FROM batch_transfers bt
     WHERE bt.source_batch_id = ANY($1::uuid[])
       AND bt.destination_batch_id = ANY($1::uuid[])
       AND bt.deleted_at IS NULL`,
    [eligibleIds]
  );
  console.log(`  Internal transfers (both source & dest eligible):                   ${internalRes.rows[0].vol.toFixed(4)} L (${G(internalRes.rows[0].vol)} gal), count=${internalRes.rows[0].cnt}`);

  // Check: are there children with initial > 0 but NO transfer record?
  // These would cause double-counting (initial counted as production but no transfer-out from parent)
  const phantomChildrenRes = await c.query(
    `SELECT b.id, b.name,
            CAST(b.initial_volume_liters AS float) AS init_l,
            b.reconciliation_status, b.is_racking_derivative, b.product_type,
            pb.name AS parent_name
     FROM batches b
     JOIN batches pb ON pb.id = b.parent_batch_id
     WHERE b.parent_batch_id IS NOT NULL
       AND b.deleted_at IS NULL
       AND CAST(b.initial_volume_liters AS float) > 0
       AND NOT EXISTS (
         SELECT 1 FROM batch_transfers bt
         WHERE bt.destination_batch_id = b.id AND bt.deleted_at IS NULL
       )
     ORDER BY b.start_date`
  );

  console.log();
  console.log("=== PHANTOM CHILDREN (parent set, initial > 0, NO transfer record) ===");
  console.log(`  Found ${phantomChildrenRes.rows.length}:\n`);
  let phantomTotal = 0;
  for (const r of phantomChildrenRes.rows) {
    phantomTotal += r.init_l;
    console.log(`  ${r.name.substring(0, 55).padEnd(55)} | init=${r.init_l.toFixed(2)}L (${G(r.init_l)} gal) | recon=${r.reconciliation_status} | racking=${r.is_racking_derivative} | type=${r.product_type} | parent=${r.parent_name}`);
  }
  console.log(`\n  TOTAL phantom initial: ${phantomTotal.toFixed(2)} L (${G(phantomTotal)} gal)`);
  console.log(`  (This volume would be double-counted if SBD treats initial as production without a matching transfer-out from parent)`);

  await c.end();
  console.log("\nDone.");
}

run().catch((e) => {
  console.error(e);
  process.exit(1);
});
