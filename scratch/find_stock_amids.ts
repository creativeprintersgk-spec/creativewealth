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
  console.log('--- Fetching all acmac1 rows ---');
  let acmac1Rows: any[] = [];
  let from = 0;
  const step = 1000;
  while (true) {
    const { data, error } = await s.from('acmac1').select('*').range(from, from + step - 1);
    if (error || !data || data.length === 0) break;
    acmac1Rows = acmac1Rows.concat(data);
    if (data.length < step) break;
    from += step;
  }

  console.log(`Total acmac1 rows: ${acmac1Rows.length}`);

  const targets = ['Laurus', 'Cemindia', 'John', 'Ajmera', 'Sammaan', 'LG Electronics', 'Navneet', 'Concord', 'HDFC', 'Nippon', 'Ramco', 'Rites', 'Rail', 'Ircon', 'Indian Railway'];
  const matches = acmac1Rows.filter(r => targets.some(t => r.name && r.name.toLowerCase().includes(t.toLowerCase())));

  console.log(`Found ${matches.length} matching scrips/ledgers in acmac1:`);
  matches.forEach(m => console.log(`acid: ${m.acid} | name: ${m.name} | type: ${m.type} | code: ${m.code}`));

  const acids = matches.map(m => m.acid);

  // Search bs1 for these acids or amids
  let bs1Rows: any[] = [];
  from = 0;
  while (true) {
    const { data, error } = await s.from('bs1').select('pfid, acid, amid, dt, trty, qn, amt').or(`acid.in.(${acids.join(',')}),amid.in.(${acids.join(',')})`).range(from, from + step - 1);
    if (error || !data || data.length === 0) break;
    bs1Rows = bs1Rows.concat(data);
    if (data.length < step) break;
    from += step;
  }

  console.log(`\nFound ${bs1Rows.length} transactions for these acids/amids in bs1:`);
  const pfMap: Record<number, number> = {};
  bs1Rows.forEach(b => {
    pfMap[b.pfid] = (pfMap[b.pfid] || 0) + 1;
  });
  console.log('PFIDs for these stock transactions:', pfMap);

  // Sample sales in FY 2025-26
  const sales = bs1Rows.filter(b => b.dt >= '2025-04-01' && b.dt <= '2026-03-31' && [99, 101].includes(Number(b.trty)));
  console.log(`\nSales in FY 2025-26 count: ${sales.length}`);
  sales.forEach(s => console.log(`dt: ${s.dt} | pfid: ${s.pfid} | acid/amid: ${s.acid || s.amid} | trty: ${s.trty} | qn: ${s.qn} | amt: ${s.amt}`));
}

run().catch(console.error);
