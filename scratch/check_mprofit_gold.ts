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

async function checkGoldTransactions() {
  console.log('=== CHECKING ALL GOLD TRANSACTIONS IN PORTFOLIO 3 (x old shares) ===');

  const { data: txs } = await s
    .from('bs1')
    .select('*')
    .eq('pfid', 3)
    .eq('amid', 466)
    .order('dt', { ascending: true });

  console.log('All bs1 Gold transactions for Portfolio 3:');
  let totalQty = 0;
  let totalCost = 0;
  for (const t of txs || []) {
    const q = Number(t.qn) || 0;
    const amt = Number(t.amt) || 0;
    totalQty += q;
    totalCost += amt;
    console.log(`DT: ${t.dt}`.padEnd(15), `Type: ${t.trstr}`.padEnd(10), `Qty: ${q}`.padEnd(10), `Rate: ₹${t.purpr}`.padEnd(12), `Amt: ₹${amt}`.padEnd(15), `Running Qty: ${totalQty}`);
  }
}
checkGoldTransactions();
