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
  const { data: ports } = await s.from('portfolios').select('*');
  console.log('--- ALL PORTFOLIOS ---');
  ports?.forEach(p => console.log(`pfid: ${p.id} | name: ${p.investor_name} | pan: ${p.pan}`));

  const { data: pflinks } = await s.from('accPflink').select('*');
  console.log('\n--- ACC PFLINKS ---');
  pflinks?.forEach(l => console.log(`acid: ${l.acid} -> pfid: ${l.pfid}`));

  let allTx: any[] = [];
  let from = 0;
  const step = 1000;
  while (true) {
    const { data, error } = await s.from('bs1').select('pfid, acid, dt, trty, amid').gte('dt', '2025-04-01').lte('dt', '2026-03-31').range(from, from + step - 1);
    if (error || !data || data.length === 0) break;
    allTx = allTx.concat(data);
    if (data.length < step) break;
    from += step;
  }

  console.log(`\nFound ${allTx.length} transactions in FY 2025-26.`);
  const pfCounts: Record<number, number> = {};
  allTx.forEach(t => {
    pfCounts[t.pfid] = (pfCounts[t.pfid] || 0) + 1;
  });
  console.log('PFIDs present in FY 2025-26 transactions:', pfCounts);
}

run().catch(console.error);
