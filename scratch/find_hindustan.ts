import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';
dotenv.config();

const sb = createClient(process.env.VITE_SUPABASE_URL!, process.env.VITE_SUPABASE_ANON_KEY!);

async function main() {
  const { data, error } = await sb
    .from('asset_master')
    .select('*')
    .ilike('name', '%hindustan%');

  if (error) {
    console.error('Error:', error);
  } else {
    console.log('Hindustan Assets in asset_master:', data.map(d => ({ amid: d.amid, name: d.name, nse_symbol: d.nse_symbol })));
  }
}
main().catch(console.error);
