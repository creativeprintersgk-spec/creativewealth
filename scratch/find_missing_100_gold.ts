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

async function findMissing100Gold() {
  console.log('=== INVESTIGATING MISSING 100 GOLD IN PORTFOLIO 3 (x old shares) ===\n');

  // 1. Check ALL sam and acmac1 entries for Gold (Gold, Gold R, Physical Gold, Gold ETF, etc.)
  const { data: samGold } = await s.from('sam').select('*').ilike('anm', '%gold%');
  console.log('SAM Gold entries:', samGold);

  const { data: acmac1Gold } = await s.from('acmac1').select('*').ilike('name', '%gold%');
  console.log('ACMAC1 Gold entries:', acmac1Gold);

  // Collect all potential amids/ids related to Gold
  const allGoldIds = [
    ...(samGold?.map(g => g.amid) || []),
    ...(acmac1Gold?.map(a => a.id) || []),
    466, 753, 733, 752, 754
  ];
  const uniqueGoldIds = Array.from(new Set(allGoldIds));

  console.log('\nAll Unique Gold AMIDs/IDs:', uniqueGoldIds);

  // 2. Query ALL sum_table rows for Portfolio 3 for ANY asset
  const { data: sumPF3 } = await s.from('sum_table').select('*').eq('pfolio_id', 3);
  console.log('\nALL sum_table rows for Portfolio 3 (x old shares):');
  for (const r of sumPF3 || []) {
    const { data: sam } = await s.from('sam').select('anm, atyp').eq('amid', r.amid);
    const { data: acmac1 } = await s.from('acmac1').select('name').eq('id', r.amid);
    const name = sam?.[0]?.anm || acmac1?.[0]?.name || `Asset #${r.amid}`;
    console.log(`AMID: ${r.amid}`.padEnd(12), `Name: ${name}`.padEnd(45), `Qty: ${r.qnt}`.padEnd(12), `AmtInv: ₹${r.amtinv}`);
  }

  // 3. Query ALL bs1 transactions for Portfolio 3 matching Gold AMIDs
  const { data: bs1Gold } = await s.from('bs1').select('*').eq('pfid', 3).in('amid', uniqueGoldIds).order('dt', { ascending: true });
  console.log('\nALL bs1 transactions for Gold in Portfolio 3:');
  for (const t of bs1Gold || []) {
    console.log(`TRID: ${t.trid}`.padEnd(12), `AMID: ${t.amid}`.padEnd(10), `DT: ${t.dt}`.padEnd(12), `Type: ${t.trstr}`.padEnd(10), `Qty: ${t.qn}`.padEnd(10), `Rate: ₹${t.purpr}`.padEnd(12), `Amt: ₹${t.amt}`.padEnd(14), `Narr: ${t.narr || ''}`);
  }

  // 4. Search vouchersc1 / trans1 / transc1 / bs1 for ANY transaction in Portfolio 3 with narr or string containing "gold" or amount edited!
  const { data: bs1AllPF3 } = await s.from('bs1').select('*').eq('pfid', 3).order('trid', { ascending: false });
  console.log('\nTotal bs1 transaction count for Portfolio 3:', bs1AllPF3?.length);
}

findMissing100Gold();
