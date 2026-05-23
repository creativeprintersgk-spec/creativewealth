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
  const { data: portfolios } = await s.from('portfolios').select('id, pfname, acid');
  console.log('All portfolios:');
  portfolios?.forEach(p => console.log(p.pfname));
  
  const { data: ledgers } = await s.from('acmac1')
    .select('id, name, acid, db_bal, cr_bal')
    .ilike('name', '%broker%');
  console.log(`\nLedgers with broker in name:`, ledgers);
}
run();
