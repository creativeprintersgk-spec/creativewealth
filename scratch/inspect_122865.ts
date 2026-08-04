import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
dotenv.config({ path: path.resolve(__dirname, '../.env') });

const supabase = createClient(
  process.env.VITE_SUPABASE_URL!,
  process.env.VITE_SUPABASE_ANON_KEY!
);

async function run() {
  const { data: sam } = await supabase.from('sam').select('*').eq('amid', 122865);
  console.log("sam 122865:", sam);

  const { data: am } = await supabase.from('asset_master').select('*').eq('amid', 122865);
  console.log("asset_master 122865:", am);
}

run().catch(console.error);
