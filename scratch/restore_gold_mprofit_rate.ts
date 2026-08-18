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

async function restoreGoldRate() {
  console.log('=== RESTORING MPROFIT GOLD RATE (₹145.00) FOR AMID 466 ===');

  const amid = 466;
  const mprofitRate = 145; // imported MProfit unit rate

  // 1. Delete artificial 7200 rates inserted today in mprices
  await s.from('mprices').delete().eq('amid', amid).eq('currp', 7200);

  // 2. Insert/Update mprices with 145
  await s.from('mprices').upsert({
    amid,
    currp: mprofitRate,
    date: '2026-08-08'
  }, { onConflict: 'row_id' } as any);

  // 3. Update sum_table currv for PF 3 (x old shares)
  // 300 qty * 145 rate = 43,500
  const { data: sumRow } = await s.from('sum_table').select('*').eq('pfolio_id', 3).eq('amid', amid).single();
  
  const currv = Number(sumRow?.qnt || 300) * mprofitRate;

  await s.from('sum_table').update({ currv, is_currv_manual: false }).eq('pfolio_id', 3).eq('amid', amid);

  console.log(`Updated sum_table Gold in Portfolio 3 -> Qty: ${sumRow?.qnt}, Rate: ₹${mprofitRate}, CurrV: ₹${currv}`);
}

restoreGoldRate();
