import postgres from 'postgres';
import { readFileSync } from 'fs';
const env = readFileSync('.env', 'utf8');
const url = env.match(/DATABASE_URL=(.+)/)?.[1]?.trim().replace(/^["']|["']$/g, '');
const sql = postgres(url!, { connect_timeout: 60 });

const GAL = 3.78541;

async function investigateBatch(batchId: string, label: string) {
  const [b] = await sql`
    SELECT b.*, v.name as vessel_name, v.capacity_liters
    FROM batches b LEFT JOIN vessels v ON b.vessel_id = v.id
    WHERE b.id = ${batchId}
  `;

  const init = Number(b.initial_volume_liters);
  const cur = Number(b.current_volume_liters);

  console.log(`\n${'='.repeat(80)}`);
  console.log(`${label}`);
  console.log(`DB: ${b.name} (${b.product_type})`);
  console.log(`${'='.repeat(80)}`);
  console.log(`  Init: ${init.toFixed(2)} L (${(init/GAL).toFixed(2)} gal) | Cur: ${cur.toFixed(2)} L (${(cur/GAL).toFixed(2)} gal)`);
  console.log(`  Vessel: ${b.vessel_name || 'NONE'} | Parent: ${b.parent_batch_id ? 'YES' : 'ROOT'} | Recon: ${b.reconciliation_status}`);

  // Volume adjustments
  const adjs = await sql`
    SELECT * FROM batch_volume_adjustments WHERE batch_id = ${batchId} AND deleted_at IS NULL ORDER BY adjustment_date
  `;
  if (adjs.length > 0) {
    console.log(`  Adjustments (${adjs.length}):`);
    for (const a of adjs) console.log(`    ${a.adjustment_type}: ${Number(a.adjustment_amount).toFixed(2)} L - ${a.reason}`);
  }

  // Transfers
  const txOut = await sql`
    SELECT bt.*, db.name as dest FROM batch_transfers bt LEFT JOIN batches db ON bt.destination_batch_id = db.id
    WHERE bt.source_batch_id = ${batchId} AND bt.deleted_at IS NULL ORDER BY bt.transferred_at
  `;
  const txIn = await sql`
    SELECT bt.*, sb.name as src FROM batch_transfers bt LEFT JOIN batches sb ON bt.source_batch_id = sb.id
    WHERE bt.destination_batch_id = ${batchId} AND bt.deleted_at IS NULL ORDER BY bt.transferred_at
  `;
  if (txOut.length) { console.log(`  Transfers OUT:`); for (const t of txOut) console.log(`    ${Number(t.volume_transferred).toFixed(2)} ${t.volume_transferred_unit} (loss: ${Number(t.loss||0).toFixed(2)}) -> ${t.dest}`); }
  if (txIn.length) { console.log(`  Transfers IN:`); for (const t of txIn) console.log(`    ${Number(t.volume_transferred).toFixed(2)} ${t.volume_transferred_unit} from ${t.src}`); }

  // Racking
  const rackings = await sql`SELECT * FROM batch_racking_operations WHERE batch_id = ${batchId} AND deleted_at IS NULL ORDER BY racked_at`;
  if (rackings.length) {
    console.log(`  Racking (${rackings.length}):`);
    for (const r of rackings) {
      const hist = r.notes?.includes('Historical Record') ? ' [HIST]' : '';
      console.log(`    ${Number(r.volume_before).toFixed(2)} -> ${Number(r.volume_after).toFixed(2)} L (loss: ${Number(r.volume_loss).toFixed(2)})${hist}`);
    }
  }

  // Bottle runs
  const bottles = await sql`SELECT * FROM bottle_runs WHERE batch_id = ${batchId} AND status != 'voided' ORDER BY packaged_at`;
  if (bottles.length) {
    console.log(`  Bottle Runs (${bottles.length}):`);
    for (const p of bottles) console.log(`    taken: ${Number(p.volume_taken_liters).toFixed(2)} L, units: ${p.units_produced}, loss: ${Number(p.loss||0).toFixed(2)} ${p.loss_unit||''}`);
  }

  // Keg fills
  const kegs = await sql`SELECT * FROM keg_fills WHERE batch_id = ${batchId} AND status != 'voided' ORDER BY filled_at`;
  if (kegs.length) {
    console.log(`  Keg Fills (${kegs.length}):`);
    for (const k of kegs) console.log(`    taken: ${Number(k.volume_taken).toFixed(2)} ${k.volume_taken_unit}, loss: ${Number(k.loss||0).toFixed(2)} ${k.loss_unit||''}`);
  }

  // Distillation
  const distills = await sql`SELECT * FROM distillation_records WHERE source_batch_id = ${batchId} AND deleted_at IS NULL ORDER BY sent_at`;
  if (distills.length) {
    console.log(`  Distillation (${distills.length}):`);
    for (const d of distills) console.log(`    ${Number(d.source_volume_liters).toFixed(2)} L (${d.status})`);
  }

  // Filter operations
  const filters = await sql`SELECT * FROM batch_filter_operations WHERE batch_id = ${batchId} AND deleted_at IS NULL ORDER BY filtered_at`;
  if (filters.length) {
    console.log(`  Filters (${filters.length}):`);
    for (const f of filters) console.log(`    loss: ${Number(f.volume_loss).toFixed(2)} L`);
  }

  // Merges IN (this batch is target)
  const mergesIn = await sql`
    SELECT bmh.*, sb.name as src FROM batch_merge_history bmh LEFT JOIN batches sb ON bmh.source_batch_id = sb.id
    WHERE bmh.target_batch_id = ${batchId} AND bmh.deleted_at IS NULL ORDER BY bmh.merged_at
  `;
  if (mergesIn.length) {
    console.log(`  Merges IN (${mergesIn.length}):`);
    for (const m of mergesIn) console.log(`    +${Number(m.volume_added).toFixed(2)} ${m.volume_added_unit} from ${m.src || 'press/juice'}`);
  }

  // Merges OUT (this batch is source)
  const mergesOut = await sql`
    SELECT bmh.*, tb.name as tgt FROM batch_merge_history bmh LEFT JOIN batches tb ON bmh.target_batch_id = tb.id
    WHERE bmh.source_batch_id = ${batchId} AND bmh.deleted_at IS NULL ORDER BY bmh.merged_at
  `;
  if (mergesOut.length) {
    console.log(`  Merges OUT (${mergesOut.length}):`);
    for (const m of mergesOut) console.log(`    -${Number(m.volume_added).toFixed(2)} ${m.volume_added_unit} to ${m.tgt}`);
  }

  console.log('');
}

async function main() {
  const names = [
    '2025-11-26_IBC-1000-10_JONA_A',
    'Batch #2025-09-21_1000 IBC 2_BLEND_A-Tmiw116xx-Tmnudvd67',
    'Batch #2025-09-21_1000 IBC 2_BLEND_A-Tmiw116xx-Tmnudw4nc',
    '2025-12-16_UNKN_BLEND_A-Tmk8qh3nd',
    '2025-12-21_UNKN_BLEND_A',
    '2025-11-25_DRUM-120-4_HARR_A',
  ];

  const labels: Record<string, string> = {
    '2025-11-26_IBC-1000-10_JONA_A': 'ISSUE: Jonathan #1 (drift -3.4 gal)',
    'Batch #2025-09-21_1000 IBC 2_BLEND_A-Tmiw116xx-Tmnudvd67': 'ISSUE: Black Currant (drift -4.0 gal)',
    'Batch #2025-09-21_1000 IBC 2_BLEND_A-Tmiw116xx-Tmnudw4nc': 'ISSUE: Lavender Black Currant (drift -4.0 gal)',
    '2025-12-16_UNKN_BLEND_A-Tmk8qh3nd': 'WARNING: Plum Wine (12/16)',
    '2025-12-21_UNKN_BLEND_A': 'WARNING: Plum Wine (12/21)',
    '2025-11-25_DRUM-120-4_HARR_A': 'WARNING: Harrison',
  };

  const batches = await sql`SELECT id, name FROM batches WHERE deleted_at IS NULL AND name = ANY(${names})`;

  for (const b of batches) {
    await investigateBatch(b.id, labels[b.name] || b.name);
  }

  await sql.end();
}
main().catch(e => { console.error(e); process.exit(1); });
