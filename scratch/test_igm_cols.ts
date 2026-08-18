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
  // Test delete with pfolio_id
  const del = await s.from('investor_group_members').delete().neq('pfolio_id', -999999);
  console.log('delete with pfolio_id:', del.error?.message || 'OK');

  // Test insert with expected MProfit columns
  const ins = await s.from('investor_group_members').insert({ investor_group_id: 1, pfolio_id: 1 });
  console.log('insert test (investor_group_id + pfolio_id):', ins.error?.message || 'OK');
  
  // Clean up test insert
  await s.from('investor_group_members').delete().eq('pfolio_id', 1);
}
run();
