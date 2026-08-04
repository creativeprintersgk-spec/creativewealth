import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';
dotenv.config();

const sb = createClient(process.env.VITE_SUPABASE_URL!, process.env.VITE_SUPABASE_ANON_KEY!);

async function main() {
  const { data, error } = await sb.from('asset_master').select('asset_type').not('amfi_code', 'is', null);
  if (error) {
    console.error(error);
    return;
  }
  const types = new Set(data.map((r: any) => r.asset_type));
  console.log('Unique asset_types for assets with amfi_code:', Array.from(types));
}
main().catch(console.error);
