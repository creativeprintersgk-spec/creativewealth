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
  // 1. Check all distinct pfolio_type values and if any are 10
  const { data: pfTypes } = await s.from('portfolios').select('id,investor_name,full_name,pfolio_type,is_group');
  const typeMap: Record<string, string[]> = {};
  pfTypes?.forEach((p: any) => {
    const k = String(p.pfolio_type);
    if (!typeMap[k]) typeMap[k] = [];
    typeMap[k].push(`${p.id}:${p.investor_name}`);
  });
  console.log('\n=== PORTFOLIOS BY pfolio_type ===');
  Object.entries(typeMap).forEach(([t, names]) => {
    console.log(`  pfolio_type=${t} (${names.length} items):`);
    names.forEach(n => console.log(`    ${n}`));
  });

  // 2. Check acmac1 groups one level deep (children of root groups)
  const { data: level2 } = await s
    .from('acmac1')
    .select('id,name,parent_id,is_group,special_type_id,acid')
    .eq('is_group', true)
    .in('parent_id', [1, 2, 3, 4]);

  console.log('\n=== LEVEL-2 GROUPS (children of root id 1/2/3/4) ===');
  level2?.slice(0, 30).forEach(r => {
    console.log(`  id=${r.id} parent=${r.parent_id} acid=${r.acid} name="${r.name}" stype=${r.special_type_id}`);
  });

  // 3. Show all distinct acid values in acmac1 and what root groups exist for each
  const { data: allAcmac1 } = await s.from('acmac1').select('id,name,parent_id,is_group,special_type_id,acid');
  // allAcmac1 might only return 1000 rows due to pagination
  const acidGroupMap: Record<number, {roots: string[], count: number}> = {};
  allAcmac1?.forEach((a: any) => {
    if (!acidGroupMap[a.acid]) acidGroupMap[a.acid] = { roots: [], count: 0 };
    acidGroupMap[a.acid].count++;
    if (a.is_group && (!a.parent_id || a.parent_id === 0)) {
      acidGroupMap[a.acid].roots.push(`id=${a.id}(${a.name}, stype=${a.special_type_id})`);
    }
  });
  console.log('\n=== ACMAC1 BY acid (from first 1000 rows) ===');
  Object.entries(acidGroupMap).forEach(([acid, v]) => {
    console.log(`  acid=${acid}  rows=${v.count}  roots=[${v.roots.join(', ')}]`);
  });

  // 4. For acid=30 (Pramesh), show all transc1 entries with their dr/cr
  const { data: trans30 } = await s
    .from('transc1')
    .select('transid,maid,dramt,cramt,acid,dt,vid')
    .eq('acid', 30)
    .limit(20);
  console.log('\n=== transc1 entries for acid=30 (first 20) ===');
  trans30?.forEach(t => console.log(`  transid=${t.transid} maid=${t.maid} dr=${t.dramt} cr=${t.cramt} dt=${t.dt}`));

  // 5. For acid=30, show total DR vs CR
  const { data: allTrans30 } = await s.from('transc1').select('dramt,cramt').eq('acid', 30);
  const totDR = allTrans30?.reduce((s, r: any) => s + Number(r.dramt || 0), 0) || 0;
  const totCR = allTrans30?.reduce((s, r: any) => s + Number(r.cramt || 0), 0) || 0;
  console.log(`\n=== acid=30 total DR=${totDR.toFixed(2)}  CR=${totCR.toFixed(2)}  diff=${(totDR-totCR).toFixed(2)}`);

  // 6. For acid=30, show acmac1 ledger maids vs transc1 maid values
  const { data: ledgers30 } = await s.from('acmac1').select('id,name,parent_id,special_type_id').eq('acid', 30).eq('is_group', false).limit(30);
  console.log('\n=== acmac1 ledgers for acid=30 (first 30) ===');
  ledgers30?.forEach(l => console.log(`  id=${l.id}  parent_id=${l.parent_id}  name="${l.name}"  stype=${l.special_type_id}`));
  
  // 7. Check if transc1 maid values for acid=30 exist as acmac1 IDs for acid=30
  const acmac1LedgerIds30 = new Set(ledgers30?.map((l: any) => l.id));
  const maidVals30 = new Set(trans30?.map((t: any) => t.maid));
  const missingMaids30 = [...maidVals30].filter(m => !acmac1LedgerIds30.has(m));
  console.log(`\n  transc1 maids for acid=30: [${[...maidVals30].join(', ')}]`);
  console.log(`  acmac1 ledger IDs for acid=30 (first 30): [${[...acmac1LedgerIds30].join(', ')}]`);
  console.log(`  missing maids (not in acmac1 for acid=30): [${missingMaids30.join(', ')}]`);
}

run().catch(console.error);
