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

async function restoreGoldRRate() {
  console.log('=== RESTORING GOLD R (AMID 753) MPROFIT RATE TO 145 ===');

  const amid = 753; // Gold R
  const mprofitRate = 145; // imported MProfit rate for Gold R

  // 1. Delete 7200 rate for amid 753 in mprices
  await s.from('mprices').delete().eq('amid', amid).eq('currp', 7200);

  // 2. Insert/Update mprices for Gold R with 145
  await s.from('mprices').upsert({
    amid,
    currp: mprofitRate,
    date: '2026-08-08'
  }, { onConflict: 'row_id' } as any);

  // 3. Update sum_table currv for Gold R in Portfolio 3 (67 qty * 145 = 9,715)
  const { data: sumRow } = await s.from('sum_table').select('*').eq('pfolio_id', 3).eq('amid', amid).single();
  const currv = Number(sumRow?.qnt || 67) * mprofitRate;

  await s.from('sum_table').update({ currv, is_currv_manual: false }).eq('pfolio_id', 3).eq('amid', amid);

  console.log(`Updated sum_table Gold R in Portfolio 3 -> Qty: ${sumRow?.qnt || 67}, Rate: ₹${mprofitRate}, CurrV: ₹${currv}`);
}

restoreGoldRRate();
