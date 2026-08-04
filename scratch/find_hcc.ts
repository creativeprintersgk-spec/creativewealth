import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';
dotenv.config();

const sb = createClient(process.env.VITE_SUPABASE_URL!, process.env.VITE_SUPABASE_ANON_KEY!);

async function main() {
  const { data, error } = await sb
    .from('asset_master')
    .select('*')
    .ilike('name', '%hcc%');

  if (error) {
    console.error('Error:', error);
  } else {
    console.log('HCC Assets in asset_master:', data);
  }
}
main().catch(console.error);
