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

async function run() {
  console.log('=== DIAGNOSING HINDUSTAN COPPER IN PORTFOLIO 40 (KRISHA INV) ===');

  const { data: txs } = await s
    .from('bs1')
    .select('*')
    .eq('pfid', 40)
    .eq('amid', 101684)
    .order('dt', { ascending: true })
    .order('trid', { ascending: true });

  console.log('All bs1 transactions count:', txs?.length);

  let runningQty = 0;
  let runningCost = 0;

  for (const t of txs || []) {
    const q = Number(t.qn) || 0;
    const amt = Number(t.amt) || 0;
    const isBuy = [19, 20, 12, 25, 30, 35, 40, 45, 46, 47].includes(t.trty);
    const isSell = [101, 99].includes(t.trty);

    if (isBuy) {
      runningQty += q;
      runningCost += amt;
    } else if (isSell) {
      const prevQty = runningQty;
      runningQty -= q;
      if (prevQty > 0) {
        runningCost -= (q / prevQty) * runningCost;
      }
    }
    console.log(`DT: ${t.dt} | TRTY: ${t.trty} (${t.trstr.padEnd(15)}) | QTY: ${q.toString().padEnd(6)} | AMT: ₹${amt.toString().padEnd(10)} | RUNNING QTY: ${runningQty}`);
  }

  const { data: sumRow } = await s
    .from('sum_table')
    .select('*')
    .eq('pfolio_id', 40)
    .eq('amid', 101684);

  console.log('\nCurrent sum_table row in DB:', sumRow);
}
run();
