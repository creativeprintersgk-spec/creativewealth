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
  console.log('=== Checking Sells for FY 2021-22 (2021-04-01 to 2022-03-31) ===\n');

  // Fetch all sell transactions in FY 2021-22
  const { data: sells } = await s.from('bs1')
    .select('trid, pfid, amid, atyid, trty, dt, qn, amt')
    .in('trty', [99, 101])
    .gte('dt', '2021-04-01')
    .lte('dt', '2022-03-31');

  console.log(`Found ${sells?.length} sells in FY 2021-22 across DB:`);
  sells?.forEach((r: any) => {
    console.log(`  trid=${r.trid}, pfid=${r.pfid}, amid=${r.amid}, atyid=${r.atyid}, trty=${r.trty}, dt=${r.dt}, qn=${r.qn}, amt=${r.amt}`);
  });

  // Fetch all transactions (buy/sell) for amid = 425629 (NTPC NCD)
  const { data: ntpcTx } = await s.from('bs1')
    .select('*')
    .eq('pfid', 4)
    .order('dt', { ascending: true });
  console.log(`\nAll bs1 transactions for pfid=4: ${ntpcTx?.length} rows.`);

  // Find NTPC NCD / IDFC NCD asset IDs
  const { data: ncdAssets } = await s.from('sam')
    .select('amid, anm')
    .or('anm.ilike.%NTPC%,anm.ilike.%IDFC%');
  console.log('\nMatching SAM assets:', ncdAssets);
}

run().catch(console.error);
