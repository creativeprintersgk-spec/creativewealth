import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';
dotenv.config({ path: '.env' });

const s = createClient(process.env.VITE_SUPABASE_URL!, process.env.VITE_SUPABASE_ANON_KEY!);

async function run() {
  const { data, error } = await s.from('mprices').select('*').eq('amid', 500030).order('dt', { ascending: false }).limit(5);
  console.log('Prices error:', error);
  console.log('Prices for 500030:', data);
}

run();
