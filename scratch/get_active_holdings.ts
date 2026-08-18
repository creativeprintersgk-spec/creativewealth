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

async function getActiveHoldings() {
  // Query all sum_table records with qnt > 0
  const { data: sumRows } = await s
    .from('sum_table')
    .select('sid, amid, qnt, amtinv, currv, pfolio_id')
    .gt('qnt', 0);

  console.log(`Found ${sumRows?.length} sum_table records with qnt > 0`);

  if (!sumRows || sumRows.length === 0) return;

  const amids = Array.from(new Set(sumRows.map(r => r.amid)));
  const { data: samRows } = await s
    .from('sam')
    .select('amid, anm, atyp, isr, alias, exint1, extstr')
    .in('amid', amids);

  const samMap = new Map(samRows?.map(a => [a.amid, a]));

  const { data: prices } = await s
    .from('mprices')
    .select('*')
    .in('amid', amids);

  const priceMap = new Map();
  prices?.forEach(p => {
    const existing = priceMap.get(p.amid);
    if (!existing || p.date > existing.date) {
      priceMap.set(p.amid, p);
    }
  });

  console.log('\n--- ACTIVE HOLDINGS (qnt > 0) ---');
  for (const r of sumRows) {
    const asset = samMap.get(r.amid);
    const pr = priceMap.get(r.amid);
    console.log(
      `PF: ${r.pfolio_id}`.padEnd(8),
      `AMID: ${r.amid}`.padEnd(10),
      `Asset: ${asset?.anm || 'UNKNOWN'}`.padEnd(65),
      `Qty: ${r.qnt}`.padEnd(12),
      `Price: ${pr?.currp ?? 'NULL'}`.padEnd(12),
      `Date: ${pr?.date ?? 'N/A'}`
    );
  }
}
getActiveHoldings();
