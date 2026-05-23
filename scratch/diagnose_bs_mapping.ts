import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
dotenv.config({ path: path.resolve(__dirname, '../.env') });

const s = createClient(
  process.env.VITE_SUPABASE_URL!,
  process.env.VITE_SUPABASE_ANON_KEY!
);

async function run() {
  // 1. Root-level groups (parent_id = 0)
  const { data: roots, error: rootErr } = await s
    .from('acmac1')
    .select('id,name,parent_id,is_group,special_type_id,acid')
    .eq('is_group', true)
    .eq('parent_id', 0);

  if (rootErr) { console.error('Root groups error:', rootErr.message); }
  else { console.log('\n=== ROOT GROUPS (parent_id=0) ==='); roots?.forEach(r => console.log(`  id=${r.id}  name="${r.name}"  special_type_id=${r.special_type_id}  acid=${r.acid}`)); }

  // 2. All distinct special_type_id values in acmac1
  const { data: allItems } = await s.from('acmac1').select('special_type_id,is_group');
  const typeMap: Record<string, {groups: number, ledgers: number}> = {};
  allItems?.forEach((r: any) => {
    const k = String(r.special_type_id ?? 'null');
    if (!typeMap[k]) typeMap[k] = { groups: 0, ledgers: 0 };
    if (r.is_group) typeMap[k].groups++; else typeMap[k].ledgers++;
  });
  console.log('\n=== DISTINCT special_type_id VALUES ===');
  Object.entries(typeMap).sort((a,b) => Number(a[0]||0) - Number(b[0]||0)).forEach(([k,v]) => {
    console.log(`  special_type_id=${k}  groups=${v.groups}  ledgers=${v.ledgers}`);
  });

  // 3. transc1 - check if maid links to acmac1.id correctly
  const { data: sampleTrans } = await s.from('transc1').select('transid,vid,maid,cramt,dramt,acid,dt').limit(5);
  console.log('\n=== SAMPLE transc1 rows ===');
  sampleTrans?.forEach(t => console.log(`  transid=${t.transid} vid=${t.vid} maid=${t.maid} dr=${t.dramt} cr=${t.cramt} acid=${t.acid} dt=${t.dt}`));

  // 4. Check: does maid in transc1 exist in acmac1?
  const { data: maids } = await s.from('transc1').select('maid');
  const maidSet = new Set(maids?.map((m: any) => m.maid));
  const { data: acmacIds } = await s.from('acmac1').select('id').eq('is_group', false);
  const acmacSet = new Set(acmacIds?.map((a: any) => a.id));
  const missingMaids = [...maidSet].filter(m => !acmacSet.has(m));
  console.log(`\n=== MAID LINKAGE CHECK ===`);
  console.log(`  transc1 unique maids: ${maidSet.size}`);
  console.log(`  acmac1 ledger count: ${acmacSet.size}`);
  console.log(`  maids NOT in acmac1: ${missingMaids.length} (first 10: ${missingMaids.slice(0,10).join(', ')})`);

  // 5. Check vouchersc1 acid values vs acc_pflink
  const { data: sampleVouchers } = await s.from('vouchersc1').select('vid,acid,vtyp,dt,narr').limit(5);
  console.log('\n=== SAMPLE vouchersc1 rows ===');
  sampleVouchers?.forEach(v => console.log(`  vid=${v.vid} acid=${v.acid} vtyp=${v.vtyp} dt=${v.dt}`));

  // 6. Check acc_pflink acids
  const { data: pflinks } = await s.from('acc_pflink').select('pfid,acid');
  console.log('\n=== acc_pflink (pfid→acid) ===');
  pflinks?.forEach(l => console.log(`  pfid=${l.pfid} acid=${l.acid}`));

  // 7. Check if acmac1 acid column matches acc_pflink acid
  const { data: rootsWithAcid } = await s.from('acmac1').select('id,name,acid,is_group,special_type_id').eq('is_group', true).eq('parent_id', 0);
  const pfAcids = new Set(pflinks?.map((l: any) => l.acid));
  console.log('\n=== ROOT GROUP acid values vs acc_pflink acids ===');
  rootsWithAcid?.forEach(r => {
    const inPflink = pfAcids.has(r.acid) ? '✅ in acc_pflink' : '❌ NOT in acc_pflink';
    console.log(`  id=${r.id} name="${r.name}" acid=${r.acid} → ${inPflink}`);
  });

  // 8. Total DR vs CR in transc1 by acid
  const { data: allTrans } = await s.from('transc1').select('acid,dramt,cramt');
  const acidTotals: Record<number, {dr: number, cr: number}> = {};
  allTrans?.forEach((t: any) => {
    if (!acidTotals[t.acid]) acidTotals[t.acid] = {dr: 0, cr: 0};
    acidTotals[t.acid].dr += Number(t.dramt) || 0;
    acidTotals[t.acid].cr += Number(t.cramt) || 0;
  });
  console.log('\n=== TRANSC1 DR/CR TOTALS BY acid ===');
  Object.entries(acidTotals).forEach(([acid, v]) => {
    const diff = v.dr - v.cr;
    console.log(`  acid=${acid}  totalDR=${v.dr.toFixed(2)}  totalCR=${v.cr.toFixed(2)}  diff=${diff.toFixed(2)}`);
  });
}

run().catch(console.error);
