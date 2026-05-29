import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
dotenv.config({ path: path.resolve(__dirname, '../.env') });

const supabase = createClient(
  process.env.VITE_SUPABASE_URL,
  process.env.VITE_SUPABASE_ANON_KEY
);

async function run() {
  const saahilPfid = 1;
  const bhandariAmid = 101556;

  const { data: txs } = await supabase
    .from('bs1')
    .select('*')
    .eq('pfid', saahilPfid)
    .eq('amid', bhandariAmid);

  if (!txs) {
    console.error('No transactions found');
    return;
  }

  // Sort by date then trid
  const sortedTxs = [...txs].sort((a, b) => a.dt.localeCompare(b.dt) || a.trid - b.trid);

  let qty = 0;
  let amtInvested = 0;

  console.log('--- Transactions sorted by date ---');
  sortedTxs.forEach((t) => {
    const q = Number(t.qn) || 0;
    const amt = Number(t.amt) || 0;
    const isBuy = [19, 20, 12, 25, 30, 35, 40, 45, 46, 47].includes(t.trty);
    
    const oldQty = qty;
    const oldAmt = amtInvested;

    if (isBuy) {
      qty += q;
      amtInvested += amt;
      console.log(`[Buy]  Date: ${t.dt}, Qty: ${q}, Amt: ${amt}, newQty: ${qty}, newCost: ${amtInvested.toFixed(2)}`);
    } else {
      const prevQty = qty;
      qty -= q;
      if (prevQty > 0) {
        amtInvested -= (q / prevQty) * amtInvested;
      } else {
        amtInvested -= amt;
      }
      console.log(`[Sell] Date: ${t.dt}, Qty: ${q}, Amt: ${amt}, newQty: ${qty}, newCost: ${amtInvested.toFixed(2)}`);
    }
  });

  console.log(`\nFinal Qty: ${qty}`);
  console.log(`Final Invested Cost (amtinv): ${amtInvested.toFixed(2)}`);
}

run().catch(console.error);
