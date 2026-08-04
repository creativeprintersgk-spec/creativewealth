import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';
dotenv.config();

const supabase = createClient(
  process.env.VITE_SUPABASE_URL!,
  process.env.VITE_SUPABASE_ANON_KEY!
);

async function run() {
  const { data, error } = await supabase.from('acmac1').select('*').ilike('name', '%broker%');
  if (error) console.error(error);
  else console.log(data);
}
run();
