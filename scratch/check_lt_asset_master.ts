import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';
dotenv.config({ path: '.env' });

const s = createClient(process.env.VITE_SUPABASE_URL!, process.env.VITE_SUPABASE_ANON_KEY!);

async function run() {
  const { data } = await s.from('asset_master').select('*').ilike('ticker', '%LTF%');
  console.log('LTF Tickers:', data);
  const { data: data2 } = await s.from('asset_master').select('*').ilike('name', '%L%T%');
  console.log('L%T Names:', data2);
}

run();
