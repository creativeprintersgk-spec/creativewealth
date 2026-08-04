import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
dotenv.config({ path: path.resolve(__dirname, '../.env') });

const supabase = createClient(
  process.env.VITE_SUPABASE_URL,
  process.env.VITE_SUPABASE_ANON_KEY
);

async function run() {
  // Query sam for Bhandari (101556)
  const { data: samRow } = await supabase.from('sam').select('*').eq('amid', 101556);
  console.log('sam for 101556:', samRow);

  // Let's also check if there is an asset_master table
  const { data: amRow } = await supabase.from('asset_master').select('*').eq('amid', 101556);
  console.log('asset_master for 101556:', amRow);

  // Query acc_pflink
  const { data: pflinks } = await supabase.from('acc_pflink').select('*').limit(10);
  console.log('acc_pflink samples:', pflinks);
}

run().catch(console.error);
