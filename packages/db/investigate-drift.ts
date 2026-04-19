/**
 * Investigate all 4 drifting batches to find root causes.
 */
import postgres from 'postgres';
import { readFileSync } from 'fs';
const env = readFileSync('.env', 'utf8');
const url = env.match(/DATABASE_URL=(.+)/)?.[1]?.trim().replace(/^["']|["']$/g, '');
const sql = postgres(url!, { connect_timeout: 60 });

const GAL = 3.78541;

async function investigateBatch(name: string, label: string) {
  const [b] = await sql`
    SELECT b.*, v.name as vessel_name, v.capacity_liters
    FROM batches b LEFT JOIN vessels v ON b.vessel_id = v.id
    WHERE b.name = ${name} AND b.deleted_at IS NULL
  `;
  if (!b) { console.log(`  ❌ Batch not found: ${name}`); return; }

  const id = b.id;
  const init = Number(b.initial_volume_liters);
  const cur = Number(b.current_volume_liters);

  console.log(`\n${'='.repeat(80)}`);
  console.log(`${label}`);
  console.log(`DB: ${b.name} (${b.product_type})`);
  console.log(`${'='.repeat(80)}`);
  console.log(`  Init: ${init.toFixed(2)} L (${(init/GAL).toFixed(2)} gal) | Cur: ${cur.toFixed(2)} L (${(cur/GAL).toFixed(2)} gal)`);
  console.log(`  Vessel: ${b.vessel_name || 'NONE'} | Parent: ${b.parent_batch_id ? 'YES (' + b.parent_batch_id + ')' : 'ROOT'}`);
  console.log(`  Recon: ${b.reconciliation_status} | Verified Year: ${b.reconciliation_verified_for_year}`);

  // Volume adjustments
  const adjs = await sql`
    SELECT adjustment_type, adjustment_amount, volume_before, volume_after, reason, adjustment_date
    FROM batch_volume_adjustments WHERE batch_id = ${id} AND deleted_at IS NULL ORDER BY adjustment_date
  `;
  if (adjs.length > 0) {
    console.log(`  Adjustments (${adjs.length}):`);
    for (const a of adjs) console.log(`    ${a.adjustment_date}: ${a.adjustment_type} ${Number(a.adjustment_amount).toFixed(2)} L (${Number(a.volume_before).toFixed(2)} -> ${Number(a.volume_after).toFixed(2)}) - ${a.reason}`);
  }

  // Transfers OUT
  const txOut = await sql`
    SELECT bt.transferred_at, bt.volume_transferred, bt.volume_transferred_unit, bt.loss, bt.loss_unit,
           bt.remaining_volume, bt.remaining_volume_unit, bt.total_volume_processed, bt.total_volume_processed_unit,
           db.name as dest, bt.notes
    FROM batch_transfers bt LEFT JOIN batches db ON bt.destination_batch_id = db.id
    WHERE bt.source_batch_id = ${id} AND bt.deleted_at IS NULL ORDER BY bt.transferred_at
  `;
  if (txOut.length) {
    console.log(`  Transfers OUT (${txOut.length}):`);
    for (const t of txOut) {
      console.log(`    ${t.transferred_at}: ${Number(t.volume_transferred).toFixed(2)} ${t.volume_transferred_unit} (loss: ${Number(t.loss||0).toFixed(2)} ${t.loss_unit||''}) -> ${t.dest}`);
      if (t.remaining_volume) console.log(`      remaining: ${Number(t.remaining_volume).toFixed(2)} ${t.remaining_volume_unit}, total_processed: ${Number(t.total_volume_processed||0).toFixed(2)} ${t.total_volume_processed_unit||''}`);
    }
  }

  // Transfers IN
  const txIn = await sql`
    SELECT bt.transferred_at, bt.volume_transferred, bt.volume_transferred_unit, bt.loss, bt.loss_unit,
           sb.name as src, bt.notes
    FROM batch_transfers bt LEFT JOIN batches sb ON bt.source_batch_id = sb.id
    WHERE bt.destination_batch_id = ${id} AND bt.deleted_at IS NULL ORDER BY bt.transferred_at
  `;
  if (txIn.length) {
    console.log(`  Transfers IN (${txIn.length}):`);
    for (const t of txIn) console.log(`    ${t.transferred_at}: ${Number(t.volume_transferred).toFixed(2)} ${t.volume_transferred_unit} from ${t.src}`);
  }

  // Racking
  const rackings = await sql`
    SELECT racked_at, volume_before, volume_after, volume_loss, notes,
           source_vessel_id, destination_vessel_id
    FROM batch_racking_operations WHERE batch_id = ${id} AND deleted_at IS NULL ORDER BY racked_at
  `;
  if (rackings.length) {
    console.log(`  Racking (${rackings.length}):`);
    for (const r of rackings) {
      const hist = r.notes?.includes('Historical Record') ? ' [HIST]' : '';
      const self = r.source_vessel_id === r.destination_vessel_id ? ' [SELF]' : '';
      console.log(`    ${r.racked_at}: ${Number(r.volume_before).toFixed(2)} -> ${Number(r.volume_after).toFixed(2)} L (loss: ${Number(r.volume_loss).toFixed(2)})${hist}${self}`);
      if (r.notes && !hist) console.log(`      notes: ${r.notes}`);
    }
  }

  // Bottle runs
  const bottles = await sql`
    SELECT packaged_at, volume_taken_liters, units_produced, package_size_ml, loss, loss_unit, status
    FROM bottle_runs WHERE batch_id = ${id} AND status != 'voided' ORDER BY packaged_at
  `;
  if (bottles.length) {
    console.log(`  Bottle Runs (${bottles.length}):`);
    for (const p of bottles) {
      const productVol = ((p.units_produced || 0) * (p.package_size_ml || 0)) / 1000;
      console.log(`    ${p.packaged_at}: taken: ${Number(p.volume_taken_liters).toFixed(2)} L, product: ${productVol.toFixed(2)} L (${p.units_produced}x${p.package_size_ml}ml), loss: ${Number(p.loss||0).toFixed(2)} ${p.loss_unit||'L'} [${p.status}]`);
    }
  }

  // Keg fills
  const kegs = await sql`
    SELECT filled_at, volume_taken, volume_taken_unit, loss, loss_unit, status
    FROM keg_fills WHERE batch_id = ${id} AND status != 'voided' ORDER BY filled_at
  `;
  if (kegs.length) {
    console.log(`  Keg Fills (${kegs.length}):`);
    for (const k of kegs) console.log(`    ${k.filled_at}: ${Number(k.volume_taken).toFixed(2)} ${k.volume_taken_unit}, loss: ${Number(k.loss||0).toFixed(2)} ${k.loss_unit||''} [${k.status}]`);
  }

  // Distillation
  const distills = await sql`
    SELECT sent_at, source_volume_liters, status
    FROM distillation_records WHERE source_batch_id = ${id} AND deleted_at IS NULL ORDER BY sent_at
  `;
  if (distills.length) {
    console.log(`  Distillation (${distills.length}):`);
    for (const d of distills) console.log(`    ${d.sent_at}: ${Number(d.source_volume_liters).toFixed(2)} L (${d.status})`);
  }

  // Filters
  const filters = await sql`
    SELECT filtered_at, volume_before, volume_after, volume_loss
    FROM batch_filter_operations WHERE batch_id = ${id} AND deleted_at IS NULL ORDER BY filtered_at
  `;
  if (filters.length) {
    console.log(`  Filters (${filters.length}):`);
    for (const f of filters) console.log(`    ${f.filtered_at}: ${Number(f.volume_before).toFixed(2)} -> ${Number(f.volume_after).toFixed(2)} L (loss: ${Number(f.volume_loss).toFixed(2)})`);
  }

  // Merges IN
  const mergesIn = await sql`
    SELECT bmh.merged_at, bmh.volume_added, bmh.volume_added_unit,
           bmh.target_volume_before, bmh.target_volume_after,
           COALESCE(sb.name, 'press/juice') as src
    FROM batch_merge_history bmh LEFT JOIN batches sb ON bmh.source_batch_id = sb.id
    WHERE bmh.target_batch_id = ${id} AND bmh.deleted_at IS NULL ORDER BY bmh.merged_at
  `;
  if (mergesIn.length) {
    console.log(`  Merges IN (${mergesIn.length}):`);
    for (const m of mergesIn) console.log(`    ${m.merged_at}: +${Number(m.volume_added).toFixed(2)} ${m.volume_added_unit} from ${m.src} (before: ${Number(m.target_volume_before).toFixed(2)}, after: ${Number(m.target_volume_after).toFixed(2)})`);
  }

  // Merges OUT
  const mergesOut = await sql`
    SELECT bmh.merged_at, bmh.volume_added, bmh.volume_added_unit, tb.name as tgt
    FROM batch_merge_history bmh LEFT JOIN batches tb ON bmh.target_batch_id = tb.id
    WHERE bmh.source_batch_id = ${id} AND bmh.deleted_at IS NULL ORDER BY bmh.merged_at
  `;
  if (mergesOut.length) {
    console.log(`  Merges OUT (${mergesOut.length}):`);
    for (const m of mergesOut) console.log(`    ${m.merged_at}: -${Number(m.volume_added).toFixed(2)} ${m.volume_added_unit} to ${m.tgt}`);
  }

  // ─── Volume balance calculation ───
  const totalTxInL = txIn.reduce((s: number, t: any) => {
    const vol = Number(t.volume_transferred);
    return s + (t.volume_transferred_unit === 'gal' ? vol * GAL : vol);
  }, 0);
  const totalTxOutL = txOut.reduce((s: number, t: any) => {
    const vol = Number(t.volume_transferred);
    return s + (t.volume_transferred_unit === 'gal' ? vol * GAL : vol);
  }, 0);
  const totalTxLossL = txOut.reduce((s: number, t: any) => {
    const vol = Number(t.loss || 0);
    return s + (t.loss_unit === 'gal' ? vol * GAL : vol);
  }, 0);
  const totalAdj = adjs.reduce((s: number, a: any) => s + Number(a.adjustment_amount), 0);
  const totalRackLoss = rackings
    .filter((r: any) => !r.notes?.includes('Historical Record'))
    .reduce((s: number, r: any) => s + Number(r.volume_loss), 0);
  const totalBottleTaken = bottles.reduce((s: number, p: any) => s + Number(p.volume_taken_liters), 0);
  const totalBottleLoss = bottles.reduce((s: number, p: any) => {
    const taken = Number(p.volume_taken_liters);
    const lossVal = Number(p.loss || 0);
    const productVol = ((p.units_produced || 0) * (p.package_size_ml || 0)) / 1000;
    const included = Math.abs(taken - (productVol + lossVal)) < 2;
    return s + (included ? 0 : lossVal);
  }, 0);
  const totalKegTaken = kegs.reduce((s: number, k: any) => {
    const vol = Number(k.volume_taken);
    return s + (k.volume_taken_unit === 'gal' ? vol * GAL : vol);
  }, 0);
  const totalKegLoss = kegs.reduce((s: number, k: any) => {
    const vol = Number(k.loss || 0);
    return s + (k.loss_unit === 'gal' ? vol * GAL : vol);
  }, 0);
  const totalFilterLoss = filters.reduce((s: number, f: any) => s + Number(f.volume_loss), 0);
  const totalDistill = distills.reduce((s: number, d: any) => s + Number(d.source_volume_liters), 0);
  const totalMergeIn = mergesIn.reduce((s: number, m: any) => {
    const vol = Number(m.volume_added);
    return s + (m.volume_added_unit === 'gal' ? vol * GAL : vol);
  }, 0);
  const totalMergeOut = mergesOut.reduce((s: number, m: any) => {
    const vol = Number(m.volume_added);
    return s + (m.volume_added_unit === 'gal' ? vol * GAL : vol);
  }, 0);

  const isTransferCreated = b.parent_batch_id && totalTxInL >= init * 0.9;
  const effectiveInitial = isTransferCreated ? 0 : init;

  const expected = effectiveInitial + totalTxInL + totalMergeIn
    - totalTxOutL - totalTxLossL
    - totalBottleTaken - totalBottleLoss
    - totalKegTaken - totalKegLoss
    - totalDistill + totalAdj
    - totalRackLoss - totalFilterLoss
    - totalMergeOut;

  const discrepancy = cur - expected;

  console.log(`\n  === VOLUME BALANCE ===`);
  console.log(`  Effective Initial: ${effectiveInitial.toFixed(2)} L ${isTransferCreated ? '(transfer-created)' : ''}`);
  console.log(`  + Transfers In: ${totalTxInL.toFixed(2)} L`);
  console.log(`  + Merges In: ${totalMergeIn.toFixed(2)} L`);
  console.log(`  - Transfers Out: ${totalTxOutL.toFixed(2)} L (loss: ${totalTxLossL.toFixed(2)} L)`);
  console.log(`  - Bottles: ${totalBottleTaken.toFixed(2)} L (extra loss: ${totalBottleLoss.toFixed(2)} L)`);
  console.log(`  - Kegs: ${totalKegTaken.toFixed(2)} L (loss: ${totalKegLoss.toFixed(2)} L)`);
  console.log(`  - Distillation: ${totalDistill.toFixed(2)} L`);
  console.log(`  - Racking Loss: ${totalRackLoss.toFixed(2)} L`);
  console.log(`  - Filter Loss: ${totalFilterLoss.toFixed(2)} L`);
  console.log(`  - Merges Out: ${totalMergeOut.toFixed(2)} L`);
  console.log(`  + Adjustments: ${totalAdj.toFixed(2)} L`);
  console.log(`  = Expected Current: ${expected.toFixed(2)} L (${(expected/GAL).toFixed(2)} gal)`);
  console.log(`  Actual Current: ${cur.toFixed(2)} L (${(cur/GAL).toFixed(2)} gal)`);
  console.log(`  DISCREPANCY: ${discrepancy.toFixed(2)} L (${(discrepancy/GAL).toFixed(2)} gal)`);
}

async function main() {
  // The 4 batches with drift from the reconciliation report
  await investigateBatch('2025-11-26_IBC-1000-11_JONA_A', 'Jonathan Juice #2 (drift -13.2 gal)');
  await investigateBatch('2025-11-26_IBC-1000-10_JONA_A', 'Jonathan #1 (drift -3.4 gal)');
  await investigateBatch('2025-10-14_120 Barrel 3_BDBO_A', 'Traditional English Sharp (drift -2.6 gal)');
  await investigateBatch('2025-11-16_120 Barrel 10_BLEND_A', 'OBC Traditional Cider (drift -1.3 gal)');

  await sql.end();
}
main().catch(e => { console.error(e); process.exit(1); });
