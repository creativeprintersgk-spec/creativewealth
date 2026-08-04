import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';
dotenv.config();

const sb = createClient(process.env.VITE_SUPABASE_URL!, process.env.VITE_SUPABASE_ANON_KEY!);

async function main() {
  const { data, error } = await sb.from('asset_master').select('asset_type, name').in('asset_type', [61, 62]).limit(10);
  if (error) {
    console.error(error);
    return;
  }
  console.log('Sample rows with asset_type 61 or 62:', data);
}
main().catch(console.error);
