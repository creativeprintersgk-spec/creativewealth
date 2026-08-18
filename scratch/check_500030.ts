import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';
dotenv.config({ path: '.env' });

const s = createClient(process.env.VITE_SUPABASE_URL!, process.env.VITE_SUPABASE_ANON_KEY!);

async function run() {
  const { data } = await s.from('sam').select('*').eq('amid', 500030);
  console.log('SAM 500030:', data);
  const { data: prices } = await s.from('mprices').select('*').eq('amid', 500030).order('dt', { ascending: false }).limit(5);
  console.log('Prices for 500030:', prices);
}

run();
