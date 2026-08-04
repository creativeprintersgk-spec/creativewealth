import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';
dotenv.config();

const sb = createClient(process.env.VITE_SUPABASE_URL!, process.env.VITE_SUPABASE_ANON_KEY!);

async function main() {
  const { data, error } = await sb.from('mprices').select('*').limit(10);
  if (error) {
    console.error('Error fetching mprices:', error);
  } else {
    console.log('mprices rows:', data);
  }
}
main().catch(console.error);
