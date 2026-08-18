import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';
dotenv.config({ path: '.env' });

const s = createClient(process.env.VITE_SUPABASE_URL!, process.env.VITE_SUPABASE_ANON_KEY!);

async function run() {
  const { data, error } = await s.from('sam').select('*');
  if (error) console.error('Error fetching SAM:', error);
  else console.log('Total SAM records:', data?.length);
}

run();
