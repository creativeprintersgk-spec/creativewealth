import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';
dotenv.config();

const supabase = createClient(process.env.VITE_SUPABASE_URL, process.env.VITE_SUPABASE_ANON_KEY);

async function run() {
  const allTransc1 = [];
  let from = 0;
  while (true) {
    const { data } = await supabase.from('transc1').select('vid, dramt, cramt, maid').eq('acid', 30).range(from, from + 999);
    if (!data || data.length === 0) break;
    allTransc1.push(...data);
    from += 1000;
  }

  const allTrans1 = [];
  from = 0;
  while (true) {
    const { data } = await supabase.from('trans1').select('vid, dramt, cramt, maid').eq('acid', 30).range(from, from + 999);
    if (!data || data.length === 0) break;
    allTrans1.push(...data);
    from += 1000;
  }

  const allEntries = [...allTransc1, ...allTrans1];
  console.log(`Fetched ${allEntries.length} entries in total for acid 30`);

  const voucherBalance = {};
  for (const e of allEntries) {
    if (!voucherBalance[e.vid]) voucherBalance[e.vid] = 0;
    voucherBalance[e.vid] += (Number(e.dramt || 0) - Number(e.cramt || 0));
  }

  let total = 0;
  for (const vid in voucherBalance) {
    const bal = voucherBalance[vid];
    total += bal;
    if (Math.abs(Math.abs(bal) - 151017.2) < 0.1) {
      console.log('FOUND VOUCHER:', vid, bal);
    }
  }
  console.log('Total Unbalance:', total);
}
run();
