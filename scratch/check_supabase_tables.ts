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
  const tableNames = ['bs1', 'transc1', 'acmac1', 'sam', 'accPflink', 'portfolios', 'acvch', 'vouchers', 'contract_notes', 'cn_details', 'stock_trans', 'mprices'];

  for (const name of tableNames) {
    const { data, error } = await s.from(name).select('*').limit(1);
    if (error) {
      console.log(`Table ${name}: Error (${error.message})`);
    } else {
      console.log(`Table ${name}: Exists! Sample keys: ${data && data[0] ? Object.keys(data[0]).join(', ') : 'empty'}`);
    }
  }
}

run().catch(console.error);
