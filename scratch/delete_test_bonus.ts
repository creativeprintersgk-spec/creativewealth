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

async function deleteTestBonus() {
  console.log('=== DELETING TEST BONUS TRANSACTION FOR HINDUSTAN COPPER (PFID 40) ===');

  const trid = 17154;
  const vid = 11143;
  const pfid = 40;
  const amid = 101684;

  // 1. Delete from bs1, transc1, vouchersc1
  const { error: e1 } = await s.from('bs1').delete().eq('trid', trid);
  console.log('bs1 delete result:', e1 ? e1.message : 'OK');

  const { error: e2 } = await s.from('transc1').delete().eq('vid', vid);
  console.log('transc1 delete result:', e2 ? e2.message : 'OK');

  const { error: e3 } = await s.from('vouchersc1').delete().eq('vid', vid);
  console.log('vouchersc1 delete result:', e3 ? e3.message : 'OK');

  // 2. Recalculate remaining bs1 transactions to get true qty & amt
  const { data: txs } = await s
    .from('bs1')
    .select('*')
    .eq('pfid', pfid)
    .eq('amid', amid)
    .order('dt', { ascending: true })
    .order('trid', { ascending: true });

  let qty = 0;
  let amtInvested = 0;

  txs?.forEach(t => {
    const q = Number(t.qn) || 0;
    const amt = Number(t.amt) || 0;
    const isBuy = [19, 20, 12, 25, 30, 35, 40, 45, 46, 47].includes(t.trty);
    const isSell = [101, 99].includes(t.trty);

    if (isBuy) {
      qty += q;
      amtInvested += amt;
    } else if (isSell) {
      const prevQty = qty;
      qty -= q;
      if (prevQty > 0) {
        amtInvested -= (q / prevQty) * amtInvested;
      }
    }
  });

  if (qty < 0) qty = 0;
  if (amtInvested < 0) amtInvested = 0;

  console.log(`Recalculated Portfolio 40 Hindustan Copper -> Qty: ${qty}, Cost: ₹${amtInvested}`);

  // 3. Update sum_table
  const { error: e4 } = await s
    .from('sum_table')
    .update({ qnt: qty, amtinv: amtInvested })
    .eq('pfolio_id', pfid)
    .eq('amid', amid);

  console.log('sum_table update result:', e4 ? e4.message : 'OK');

  // 4. Verify sum_table
  const { data: updatedSum } = await s
    .from('sum_table')
    .select('qnt, amtinv')
    .eq('pfolio_id', pfid)
    .eq('amid', amid)
    .single();

  console.log('Verified sum_table row in DB:', updatedSum);
}

deleteTestBonus();
