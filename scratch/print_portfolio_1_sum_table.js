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
  console.log('--- Fetching sum_table for portfolio 1 ---');
  const { data: sumRows } = await supabase.from('sum_table').select('*').eq('pfolio_id', 1);
  
  const { data: sam } = await supabase.from('sam').select('*');
  const { data: assetMaster } = await supabase.from('asset_master').select('*');
  
  const assetMap = {};
  sam?.forEach(s => { assetMap[s.amid] = s.anm; });
  assetMaster?.forEach(a => { assetMap[a.amid] = a.name; });

  console.log(`Found ${sumRows?.length || 0} holdings in sum_table for portfolio 1:`);
  sumRows?.forEach(r => {
    const name = assetMap[r.amid] || `AMID ${r.amid}`;
    console.log(`  - name="${name}" amid=${r.amid} qnt=${r.qnt} amtinv=${r.amtinv} currv=${r.currv} sid=${r.sid}`);
  });
}

run().catch(console.error);
