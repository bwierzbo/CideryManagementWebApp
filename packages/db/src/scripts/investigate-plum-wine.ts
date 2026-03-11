import { db } from "..";
import { sql } from "drizzle-orm";

const G = 0.264172;
function f(v: any, d=1) { return v==null?"null":parseFloat(String(v)).toFixed(d); }
function lg(l: any) { if(l==null) return "null"; const v=parseFloat(String(l)); return `${v.toFixed(1)}L (${(v*G).toFixed(1)}gal)`; }

async function main() {
  console.log("=== ALL PLUM BATCHES ===");
  const br = await db.execute(sql.raw(`
    SELECT b.id, b.batch_number, b.custom_name, b.product_type, b.status,
      CAST(b.initial_volume_liters AS NUMERIC) AS init_l,
      CAST(b.current_volume_liters AS NUMERIC) AS curr_l,
      b.start_date::text, b.parent_batch_id, b.reconciliation_status,
      b.deleted_at::text, b.fermentation_stage,
      CAST(b.estimated_abv AS NUMERIC) AS est_abv,
      CAST(b.actual_abv AS NUMERIC) AS act_abv,
      b.is_racking_derivative, b.origin_press_run_id,
      v.name AS vessel_name
    FROM batches b LEFT JOIN vessels v ON b.vessel_id = v.id
    WHERE b.custom_name ILIKE '%plum%' OR b.batch_number ILIKE '%plum%'
    ORDER BY b.deleted_at NULLS FIRST, b.start_date
  `));
  const pb = br.rows as any[];
  const ids = pb.map((b:any)=>b.id);
  for (const b of pb) {
    const fl: string[] = [];
    if(b.deleted_at) fl.push("DELETED");
    if(b.is_racking_derivative) fl.push("RACK_DERIV");
    if(b.reconciliation_status&&b.reconciliation_status!=="pending") fl.push("recon="+b.reconciliation_status);
    console.log(`\n${b.custom_name||b.batch_number} [${fl.join(",")}]`);
    console.log(`  ID: ${b.id}, Type: ${b.product_type}, Status: ${b.status}`);
    console.log(`  Init: ${lg(b.init_l)}, Current: ${lg(b.curr_l)}`);
    console.log(`  Start: ${b.start_date}, Vessel: ${b.vessel_name||"NONE"}`);
    console.log(`  Parent: ${b.parent_batch_id||"NONE"}, FermStage: ${b.fermentation_stage}`);
    console.log(`  EstABV: ${b.est_abv?f(b.est_abv)+"%":"null"}, ActABV: ${b.act_abv?f(b.act_abv)+"%":"null"}`);
    console.log(`  PressRunId: ${b.origin_press_run_id||"NONE"}`);
  }
  if(!ids.length){console.log("No plum batches.");process.exit(0);}
  const il = ids.map((id:string)=>`'${id}'`).join(",");

  console.log("\n=== TRANSFERS INVOLVING PLUM ===");
  const xf = (await db.execute(sql.raw(`
    SELECT bs.custom_name AS src, bs.product_type AS st, bd.custom_name AS dst, bd.product_type AS dt,
      CAST(bt.volume_transferred AS NUMERIC) AS vol, bt.volume_transferred_unit,
      CAST(bt.loss AS NUMERIC) AS loss, bt.loss_unit,
      bt.transferred_at::text, bt.deleted_at::text, bt.notes
    FROM batch_transfers bt
    JOIN batches bs ON bt.source_batch_id=bs.id JOIN batches bd ON bt.destination_batch_id=bd.id
    WHERE bt.source_batch_id IN (${il}) OR bt.destination_batch_id IN (${il})
    ORDER BY bt.transferred_at
  `))).rows as any[];
  if(!xf.length) console.log("  (none)");
  for(const t of xf){
    const d=t.deleted_at?" [DEL]":"";
    console.log(`  ${t.transferred_at}: ${t.src}(${t.st})->${t.dst}(${t.dt}): ${f(t.vol)}${t.volume_transferred_unit} loss=${f(t.loss||0)}${t.loss_unit||"L"}${d}`);
    if(t.notes) console.log(`    Notes: ${t.notes}`);
  }

  console.log("\n=== MERGE HISTORY ===");
  const mg = (await db.execute(sql.raw(`
    SELECT bt2.custom_name AS target, bs.custom_name AS sb, pr.press_run_name AS sp,
      bmh.source_type, CAST(bmh.volume_added AS NUMERIC) AS vol, bmh.volume_added_unit,
      CAST(bmh.source_abv AS NUMERIC) AS sabv, bmh.merged_at::text, bmh.deleted_at::text
    FROM batch_merge_history bmh
    LEFT JOIN batches bt2 ON bmh.target_batch_id=bt2.id
    LEFT JOIN batches bs ON bmh.source_batch_id=bs.id
    LEFT JOIN press_runs pr ON bmh.source_press_run_id=pr.id
    WHERE bmh.target_batch_id IN (${il}) OR bmh.source_batch_id IN (${il})
    ORDER BY bmh.merged_at
  `))).rows as any[];
  if(!mg.length) console.log("  (none)");
  for(const m of mg){
    const d=m.deleted_at?" [DEL]":"";
    console.log(`  ${m.merged_at}: ${m.sb||m.sp||"juice"}->${m.target}: ${f(m.vol)}${m.volume_added_unit} type=${m.source_type} abv=${f(m.sabv||0)}%${d}`);
  }

  console.log("\n=== COMPOSITIONS ===");
  const cp = (await db.execute(sql.raw(`
    SELECT b.custom_name, bc.source_type, bfv.name AS variety, bfv.fruit_type,
      CAST(bc.juice_volume AS NUMERIC) AS jv, bc.juice_volume_unit,
      CAST(bc.input_weight_kg AS NUMERIC) AS wt, bc.deleted_at::text
    FROM batch_compositions bc
    JOIN batches b ON bc.batch_id=b.id
    LEFT JOIN base_fruit_varieties bfv ON bc.variety_id=bfv.id
    WHERE bc.batch_id IN (${il}) ORDER BY bc.batch_id
  `))).rows as any[];
  if(!cp.length) console.log("  (none)");
  for(const c of cp){
    const d=c.deleted_at?" [DEL]":"";
    console.log(`  ${c.custom_name}: ${c.source_type} ${c.variety||"?"}(${c.fruit_type||"?"}) vol=${f(c.jv)}${c.juice_volume_unit||"L"} wt=${f(c.wt||0)}kg${d}`);
  }

  console.log("\n=== RACKING OPS ===");
  const rk = (await db.execute(sql.raw(`
    SELECT b.custom_name, sv.name AS sv, dv.name AS dv,
      CAST(bro.volume_before AS NUMERIC) AS vb, bro.volume_before_unit,
      CAST(bro.volume_after AS NUMERIC) AS va, bro.volume_after_unit,
      CAST(bro.volume_loss AS NUMERIC) AS vl, bro.volume_loss_unit,
      bro.racked_at::text, bro.deleted_at::text, bro.notes
    FROM batch_racking_operations bro
    JOIN batches b ON bro.batch_id=b.id
    LEFT JOIN vessels sv ON bro.source_vessel_id=sv.id LEFT JOIN vessels dv ON bro.destination_vessel_id=dv.id
    WHERE bro.batch_id IN (${il}) ORDER BY bro.racked_at
  `))).rows as any[];
  if(!rk.length) console.log("  (none)");
  for(const r of rk){
    const d=r.deleted_at?" [DEL]":"";
    console.log(`  ${r.racked_at}: ${r.custom_name} ${r.sv}->${r.dv} before=${f(r.vb)}${r.volume_before_unit} after=${f(r.va)}${r.volume_after_unit} loss=${f(r.vl)}${r.volume_loss_unit}${d}`);
    if(r.notes) console.log(`    Notes: ${r.notes}`);
  }

  console.log("\n=== PACKAGING ===");
  const bt = (await db.execute(sql.raw(`
    SELECT b.custom_name, CAST(br.volume_taken_liters AS NUMERIC) AS vol,
      CAST(br.loss AS NUMERIC) AS loss, br.loss_unit,
      br.units_produced, br.package_type, br.packaged_at::text, br.voided_at::text, br.status,
      br.distributed_at::text
    FROM bottle_runs br JOIN batches b ON br.batch_id=b.id
    WHERE br.batch_id IN (${il}) ORDER BY br.packaged_at
  `))).rows as any[];
  console.log("Bottles:");
  if(!bt.length) console.log("  (none)");
  for(const b of bt){
    const v=b.voided_at?" [VOID]":"";
    console.log(`  ${b.packaged_at}: ${b.custom_name} ${lg(b.vol)} loss=${f(b.loss||0)}${b.loss_unit||"L"} (${b.units_produced} ${b.package_type}) status=${b.status} dist=${b.distributed_at||"no"}${v}`);
  }
  const kg = (await db.execute(sql.raw(`
    SELECT b.custom_name, CAST(kf.volume_taken AS NUMERIC) AS vol, kf.volume_taken_unit,
      CAST(kf.loss AS NUMERIC) AS loss, kf.loss_unit,
      kf.filled_at::text, kf.voided_at::text, kf.deleted_at::text, kf.status,
      kf.distributed_at::text
    FROM keg_fills kf JOIN batches b ON kf.batch_id=b.id
    WHERE kf.batch_id IN (${il}) ORDER BY kf.filled_at
  `))).rows as any[];
  console.log("Kegs:");
  if(!kg.length) console.log("  (none)");
  for(const k of kg){
    const fl:string[]=[];if(k.deleted_at)fl.push("DEL");if(k.voided_at)fl.push("VOID");
    const fs=fl.length?` [${fl.join(",")}]`:"";
    console.log(`  ${k.filled_at}: ${k.custom_name} ${f(k.vol)}${k.volume_taken_unit} loss=${f(k.loss||0)}${k.loss_unit||"L"} status=${k.status} dist=${k.distributed_at||"no"}${fs}`);
  }

  console.log("\n=== CHILDREN OF PLUM BATCHES ===");
  const ch = (await db.execute(sql.raw(`
    SELECT b.id, b.custom_name, b.batch_number, b.product_type,
      CAST(b.initial_volume_liters AS NUMERIC) AS il, CAST(b.current_volume_liters AS NUMERIC) AS cl,
      b.parent_batch_id, pb.custom_name AS pn,
      b.is_racking_derivative, b.deleted_at::text, b.reconciliation_status
    FROM batches b LEFT JOIN batches pb ON b.parent_batch_id=pb.id
    WHERE b.parent_batch_id IN (${il}) ORDER BY b.start_date
  `))).rows as any[];
  if(!ch.length) console.log("  (none)");
  for(const c of ch){
    const fl:string[]=[];if(c.deleted_at)fl.push("DEL");if(c.is_racking_derivative)fl.push("RACK");
    if(c.reconciliation_status&&c.reconciliation_status!=="pending")fl.push("recon="+c.reconciliation_status);
    console.log(`  ${c.custom_name||c.batch_number} [${fl.join(",")}] parent=${c.pn} type=${c.product_type} init=${lg(c.il)} curr=${lg(c.cl)}`);
  }

  console.log("\n=== VOLUME RECONSTRUCTION ===");
  for(const batch of pb){
    const bId=batch.id; const initL=parseFloat(batch.init_l)||0; const currL=parseFloat(batch.curr_l)||0;
    const qi=(await db.execute(sql.raw(`SELECT COALESCE(SUM(CASE WHEN volume_transferred_unit='gal' THEN volume_transferred::numeric*3.78541 ELSE volume_transferred::numeric END),0) AS t FROM batch_transfers WHERE destination_batch_id='${bId}' AND deleted_at IS NULL`))).rows as any[];
    const qo=(await db.execute(sql.raw(`SELECT COALESCE(SUM(CASE WHEN volume_transferred_unit='gal' THEN volume_transferred::numeric*3.78541 ELSE volume_transferred::numeric END+CASE WHEN loss_unit='gal' THEN COALESCE(loss::numeric,0)*3.78541 ELSE COALESCE(loss::numeric,0) END),0) AS t FROM batch_transfers WHERE source_batch_id='${bId}' AND deleted_at IS NULL`))).rows as any[];
    const qm=(await db.execute(sql.raw(`SELECT COALESCE(SUM(CASE WHEN volume_added_unit='gal' THEN volume_added::numeric*3.78541 ELSE volume_added::numeric END),0) AS t FROM batch_merge_history WHERE target_batch_id='${bId}' AND deleted_at IS NULL`))).rows as any[];
    const qb=(await db.execute(sql.raw(`SELECT COALESCE(SUM(volume_taken_liters::numeric),0) AS t FROM bottle_runs WHERE batch_id='${bId}' AND voided_at IS NULL`))).rows as any[];
    const qk=(await db.execute(sql.raw(`SELECT COALESCE(SUM(CASE WHEN volume_taken_unit='gal' THEN volume_taken::numeric*3.78541 ELSE volume_taken::numeric END),0) AS t FROM keg_fills WHERE batch_id='${bId}' AND voided_at IS NULL AND deleted_at IS NULL`))).rows as any[];
    const qr=(await db.execute(sql.raw(`SELECT COALESCE(SUM(CASE WHEN volume_loss_unit='gal' THEN volume_loss::numeric*3.78541 ELSE volume_loss::numeric END),0) AS t FROM batch_racking_operations WHERE batch_id='${bId}' AND deleted_at IS NULL`))).rows as any[];
    const qa=(await db.execute(sql.raw(`SELECT COALESCE(SUM(adjustment_amount::numeric),0) AS t FROM batch_volume_adjustments WHERE batch_id='${bId}' AND deleted_at IS NULL`))).rows as any[];
    const ti=parseFloat(qi[0].t),to=parseFloat(qo[0].t),tm=parseFloat(qm[0].t),tb=parseFloat(qb[0].t),tk=parseFloat(qk[0].t),tr=parseFloat(qr[0].t),ta=parseFloat(qa[0].t);
    const rc=initL+ti+tm-to-tb-tk-tr+ta;
    const diff=rc-currL;
    console.log(`\n${batch.custom_name||batch.batch_number} ${batch.deleted_at?"[DEL]":""}`);
    console.log(`  ${f(initL)}L +xIn=${f(ti)}L +mrg=${f(tm)}L -xOut=${f(to)}L -btl=${f(tb)}L -keg=${f(tk)}L -rack=${f(tr)}L +adj=${f(ta)}L`);
    console.log(`  Recon=${f(rc)}L (${f(rc*G)}gal) vs DB=${f(currL)}L diff=${f(diff)}L ${Math.abs(diff)<0.1?"OK":"MISMATCH"}`);
  }

  console.log("\n=== TIMELINE ===");
  const tl = (await db.execute(sql.raw(`
    WITH ev AS (
      SELECT b.start_date AS dt,'CREATED' AS tp,b.custom_name||': init='||CAST(b.initial_volume_liters AS NUMERIC)||'L type='||b.product_type AS d,b.deleted_at FROM batches b WHERE b.id IN (${il})
      UNION ALL
      SELECT bt.transferred_at,CASE WHEN bt.destination_batch_id IN (${il}) THEN 'XFER_IN' ELSE 'XFER_OUT' END,
        bs.custom_name||'('||bs.product_type||')->'||bd.custom_name||'('||bd.product_type||'): '||CAST(bt.volume_transferred AS NUMERIC)||bt.volume_transferred_unit,bt.deleted_at
      FROM batch_transfers bt JOIN batches bs ON bt.source_batch_id=bs.id JOIN batches bd ON bt.destination_batch_id=bd.id
      WHERE bt.source_batch_id IN (${il}) OR bt.destination_batch_id IN (${il})
      UNION ALL
      SELECT bmh.merged_at,'MERGE',COALESCE(bs.custom_name,pr.press_run_name,'juice')||'->'||bt2.custom_name||': '||CAST(bmh.volume_added AS NUMERIC)||bmh.volume_added_unit,bmh.deleted_at
      FROM batch_merge_history bmh LEFT JOIN batches bt2 ON bmh.target_batch_id=bt2.id LEFT JOIN batches bs ON bmh.source_batch_id=bs.id LEFT JOIN press_runs pr ON bmh.source_press_run_id=pr.id
      WHERE bmh.target_batch_id IN (${il})
      UNION ALL
      SELECT bro.racked_at,'RACKING',b.custom_name||': '||CAST(bro.volume_before AS NUMERIC)||bro.volume_before_unit||'->'||CAST(bro.volume_after AS NUMERIC)||bro.volume_after_unit||' loss='||CAST(bro.volume_loss AS NUMERIC)||bro.volume_loss_unit,bro.deleted_at
      FROM batch_racking_operations bro JOIN batches b ON bro.batch_id=b.id WHERE bro.batch_id IN (${il})
      UNION ALL
      SELECT br.packaged_at,'BOTTLED',b.custom_name||': '||CAST(br.volume_taken_liters AS NUMERIC)||'L ('||br.units_produced||' '||br.package_type||')',br.voided_at
      FROM bottle_runs br JOIN batches b ON br.batch_id=b.id WHERE br.batch_id IN (${il})
      UNION ALL
      SELECT kf.filled_at,'KEGGED',b.custom_name||': '||CAST(kf.volume_taken AS NUMERIC)||kf.volume_taken_unit,COALESCE(kf.deleted_at,kf.voided_at)
      FROM keg_fills kf JOIN batches b ON kf.batch_id=b.id WHERE kf.batch_id IN (${il})
    )
    SELECT dt::text,tp,d,CASE WHEN deleted_at IS NOT NULL THEN '[DEL]' ELSE '' END AS s FROM ev ORDER BY dt,tp
  `))).rows as any[];
  for(const e of tl) console.log(`  ${e.dt} ${(e.tp as string).padEnd(10)} ${e.d}${e.s}`);

  console.log("\n=== DONE ===");
  process.exit(0);
}
main().catch(e=>{console.error(e);process.exit(1);});
