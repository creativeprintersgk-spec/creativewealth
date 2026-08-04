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
  const saahilPfids = [1, 13, 11, 12, 38];
  
  console.log('Querying sum_table for both amid 101556 and 500589 for Saahil portfolios...');
  const { data: rows } = await supabase
    .from('sum_table')
    .select('*')
    .in('pfolio_id', saahilPfids)
    .in('amid', [101556, 500589]);
    
  rows.forEach(r => {
    console.log(`sum_table entry: pfolio_id=${r.pfolio_id}, amid=${r.amid}, qnt=${r.qnt}, amtinv=${r.amtinv}, currv=${r.currv}`);
  });
}

run().catch(console.error);
