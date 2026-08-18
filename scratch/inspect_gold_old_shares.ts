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

async function inspectGoldInOldShares() {
  console.log('=== INVESTIGATING GOLD IN x old shares (PFID 3) ===');

  // 1. Get Portfolio 3 details
  const { data: pf3 } = await s.from('portfolios').select('*').eq('id', 3);
  console.log('Portfolio 3:', pf3);

  // 2. Query ALL sum_table rows for Portfolio 3
  const { data: sumRows } = await s.from('sum_table').select('*').eq('pfolio_id', 3);
  console.log('\nAll sum_table rows for Portfolio 3 (x old shares):');
  for (const r of sumRows || []) {
    const { data: sam } = await s.from('sam').select('anm, atyp').eq('amid', r.amid);
    const { data: acmac1 } = await s.from('acmac1').select('name').eq('id', r.amid);
    const name = sam?.[0]?.anm || acmac1?.[0]?.name || `Asset #${r.amid}`;
    console.log(`AMID: ${r.amid}`.padEnd(12), `Name: ${name}`.padEnd(40), `Qty: ${r.qnt}`.padEnd(15), `AmtInv: ₹${r.amtinv}`, `CurrV: ₹${r.currv}`);
  }

  // 3. Query all bs1 transactions for Portfolio 3 where asset is Gold / amid 466
  const { data: samGold } = await s.from('sam').select('*').ilike('anm', '%gold%');
  console.log('\nSAM Gold items:', samGold);
  const goldAmids = samGold?.map(g => g.amid) || [];

  const { data: bs1Gold } = await s.from('bs1').select('*').eq('pfid', 3).in('amid', goldAmids);
  console.log('\nbs1 transactions for Gold in Portfolio 3:', bs1Gold);

  // 4. Check mprices for Gold amids
  const { data: mpricesGold } = await s.from('mprices').select('*').in('amid', goldAmids);
  console.log('\nmprices for Gold amids:', mpricesGold);
}

inspectGoldInOldShares();
