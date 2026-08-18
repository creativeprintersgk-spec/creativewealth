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

async function restoreRGandhiBS1() {
  console.log('=== RESTORING MISSING 100 GM GOLD BS1 TRANSACTION FOR VOUCHER 14266 ===');

  const pfid = 3;
  const amid = 466; // Gold
  const vid = 14266;
  const trid = 14266;

  // 1. Insert missing bs1 row linked to voucher 14266
  const bsRow = {
    trid,
    pfid,
    amid,
    atyid: 75,
    sid: 1561,
    cnid: -1,
    trty: 20,
    trstr: 'Buy',
    acvch: vid,
    dt: '2020-09-28',
    qn: 100,
    purpr: 50.55,
    brkg: 0,
    netpr: 50.55,
    amt: 5055,
    chrgs: 0,
    narr: 'R Gandhi'
  };

  const { error: bsErr } = await s.from('bs1').insert(bsRow);
  if (bsErr) {
    console.log('bs1 insert result:', bsErr.message);
  } else {
    console.log('✅ Successfully inserted missing bs1 row for R Gandhi 100 gm Gold!');
  }

  // 2. Recalculate all bs1 transactions for Gold in Portfolio 3
  const { data: txs } = await s
    .from('bs1')
    .select('*')
    .eq('pfid', pfid)
    .eq('amid', amid)
    .order('dt', { ascending: true });

  let totalQty = 0;
  let totalCost = 0;

  txs?.forEach(t => {
    totalQty += Number(t.qn) || 0;
    totalCost += Number(t.amt) || 0;
  });

  console.log(`Recalculated Portfolio 3 Gold -> Total Qty: ${totalQty}, Total Cost: ₹${totalCost}`);

  // 3. Update sum_table row for Portfolio 3 & Gold
  const mprofitRate = 145; // imported rate
  const currv = totalQty * mprofitRate;

  const { error: sumErr } = await s
    .from('sum_table')
    .update({ qnt: totalQty, amtinv: totalCost, currv })
    .eq('pfolio_id', pfid)
    .eq('amid', amid);

  console.log('sum_table update result:', sumErr ? sumErr.message : 'OK');

  // 4. Verify sum_table
  const { data: updatedSum } = await s
    .from('sum_table')
    .select('qnt, amtinv, currv')
    .eq('pfolio_id', pfid)
    .eq('amid', amid)
    .single();

  console.log('\nVerified sum_table row for Gold in Portfolio 3:', updatedSum);
}

restoreRGandhiBS1();
