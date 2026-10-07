import dotenv from 'dotenv';
dotenv.config();
dotenv.config({ path: '.env.local' });
import { createClient } from '@supabase/supabase-js';

const supabaseUrl = process.env.VITE_SUPABASE_URL;
const supabaseKey = process.env.VITE_SUPABASE_ANON_KEY || process.env.VITE_SUPABASE_SERVICE_ROLE_KEY;

if (!supabaseUrl || !supabaseKey) {
  console.error('Missing Supabase credentials in .env / .env.local');
  process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseKey, {
  auth: { persistSession: false }
});

async function runDiagnostic() {
  console.log('--- Running Diagnostic: Pre-2015 Bonus-Share Zero-Cost Holdings (SQL Query) ---');

  // Step 1: Query bs1 rows before 2015-04-01 with trty = 40 (Bonus)
  const { data: bonusRows, error: bonusErr } = await supabase
    .from('bs1')
    .select('pfid, amid')
    .eq('trty', 40)
    .lt('dt', '2015-04-01');

  if (bonusErr) {
    console.error('Error querying bonus transactions:', bonusErr.message);
    process.exit(1);
  }

  if (!bonusRows || bonusRows.length === 0) {
    console.log('\nDiagnostic Query Result: 0 rows returned.');
    console.log('Status: No pre-2015 bonus transactions (trty=40) found in bs1.');
    console.log('Conclusion: No pre-2015 holding traces back to a bonus issue in the live database.');
    return;
  }

  // Collect distinct (pfid, amid) pairs
  const pairs = new Map<string, { pfid: number; amid: number }>();
  bonusRows.forEach(r => {
    const key = `${r.pfid}_${r.amid}`;
    pairs.set(key, { pfid: Number(r.pfid), amid: Number(r.amid) });
  });

  console.log(`Found ${pairs.size} unique (pfid, amid) pair(s) with pre-2015 bonus transactions.`);

  // Step 2: For each pair, calculate net quantity before 2015-04-01
  const buyTrty = new Set([12, 15, 19, 20, 25, 30, 35, 38, 40, 46, 47]);
  const sellTrty = new Set([99, 101, 150]);

  const results: any[] = [];

  for (const { pfid, amid } of pairs.values()) {
    const { data: txs, error: txErr } = await supabase
      .from('bs1')
      .select('*')
      .eq('pfid', pfid)
      .eq('amid', amid)
      .lt('dt', '2015-04-01');

    if (txErr) {
      console.error(`Error querying txs for pfid=${pfid}, amid=${amid}:`, txErr.message);
      continue;
    }

    let approxNetQty = 0;
    let bonusQtyReceived = 0;

    (txs || []).forEach(t => {
      const trty = Number(t.trty);
      const qn = Number(t.qn) || 0;
      if (buyTrty.has(trty)) approxNetQty += qn;
      if (sellTrty.has(trty)) approxNetQty -= qn;
      if (trty === 40) bonusQtyReceived += qn;
    });

    if (approxNetQty > 0.01) {
      results.push({
        pfid,
        amid,
        approx_net_qty: approxNetQty,
        bonus_qty_received: bonusQtyReceived,
        status: 'LIKELY STILL HELD -- check if remaining qty traces to bonus (zero cost)'
      });
    }
  }

  console.log('\n--- Diagnostic Results Table ---');
  if (results.length === 0) {
    console.log('Diagnostic Query Result: 0 rows returned.');
    console.log('Status: All pre-2015 bonus positions were fully exited before 2015-04-01 (approx_net_qty <= 0).');
  } else {
    console.table(results);
  }
}

runDiagnostic();
