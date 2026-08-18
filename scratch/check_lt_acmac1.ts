import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';
dotenv.config({ path: '.env' });

const s = createClient(process.env.VITE_SUPABASE_URL!, process.env.VITE_SUPABASE_ANON_KEY!);

async function run() {
  const { data } = await s.from('acmac1').select('id, name').ilike('name', '%L&T%');
  console.log('ACMAC1 records:', data);
}

run();
