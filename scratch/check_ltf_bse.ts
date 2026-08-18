import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';
dotenv.config({ path: '.env' });

const s = createClient(process.env.VITE_SUPABASE_URL!, process.env.VITE_SUPABASE_ANON_KEY!);

async function run() {
  const { data } = await s.from('asset_master').select('*').eq('bse_code', 533519);
  console.log('Asset 533519:', data);
  const { data: data2 } = await s.from('asset_master').select('*').eq('nse_symbol', 'LTF');
  console.log('Asset LTF:', data2);
}

run();
