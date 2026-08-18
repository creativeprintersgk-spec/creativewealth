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

async function checkGoldExact() {
  console.log('=== EXACT GOLD & GOLD R DIAGNOSIS ACROSS ALL PORTFOLIOS ===\n');

  // 1. Check sum_table for amid 466 (Gold) and 753 (Gold R)
  const { data: sumRows } = await s
    .from('sum_table')
    .select('*')
    .in('amid', [466, 753]);

  console.log('sum_table rows for Gold (amid 466) & Gold R (amid 753):');
  for (const r of sumRows || []) {
    const { data: pf } = await s.from('portfolios').select('investor_name, full_name').eq('id', r.pfolio_id);
    const pname = pf?.[0]?.investor_name || pf?.[0]?.full_name || `PF ${r.pfolio_id}`;
    console.log(`PF ID: ${r.pfolio_id} (${pname})`.padEnd(35), `AMID: ${r.amid}`.padEnd(12), `Qty: ${r.qnt}`.padEnd(15), `AmtInv: ₹${r.amtinv}`.padEnd(20), `CurrV: ₹${r.currv}`);
  }

  // 2. Check mprices for amid 466 and 753
  const { data: mpRows } = await s
    .from('mprices')
    .select('*')
    .in('amid', [466, 753])
    .order('date', { ascending: false })
    .limit(10);

  console.log('\nRecent mprices rows for Gold (466) & Gold R (753):', mpRows);

  // 3. Check bs1 transactions for amid 466 in PF 3 (x old shares)
  const { data: bs1Pf3 } = await s
    .from('bs1')
    .select('trid, dt, trstr, qn, purpr, amt, narr')
    .eq('pfid', 3)
    .eq('amid', 466)
    .order('dt', { ascending: true });

  console.log('\nbs1 transactions for Gold (amid 466) in Portfolio 3 (x old shares):');
  let sumQn = 0;
  bs1Pf3?.forEach(t => {
    sumQn += Number(t.qn || 0);
    console.log(`DT: ${t.dt}`.padEnd(12), `Type: ${t.trstr}`.padEnd(8), `Qty: ${t.qn}`.padEnd(10), `Rate: ₹${t.purpr}`.padEnd(12), `Amt: ₹${t.amt}`.padEnd(14), `Narr: ${t.narr || ''}`);
  });
  console.log(`Total bs1 Qty sum for Gold in PF 3 = ${sumQn}`);

  // 4. Check bs1 transactions for Gold R (amid 753) in PF 3
  const { data: bs1GoldR } = await s
    .from('bs1')
    .select('trid, dt, trstr, qn, purpr, amt, narr')
    .eq('pfid', 3)
    .eq('amid', 753)
    .order('dt', { ascending: true });

  console.log('\nbs1 transactions for Gold R (amid 753) in Portfolio 3 (x old shares):');
  let sumGoldRQn = 0;
  bs1GoldR?.forEach(t => {
    sumGoldRQn += Number(t.qn || 0);
    console.log(`DT: ${t.dt}`.padEnd(12), `Type: ${t.trstr}`.padEnd(8), `Qty: ${t.qn}`.padEnd(10), `Rate: ₹${t.purpr}`.padEnd(12), `Amt: ₹${t.amt}`.padEnd(14), `Narr: ${t.narr || ''}`);
  });
  console.log(`Total bs1 Qty sum for Gold R in PF 3 = ${sumGoldRQn}`);
}

checkGoldExact();
