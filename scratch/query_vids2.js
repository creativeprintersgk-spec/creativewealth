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
  console.log('--- Checking vid = 3053 (18799.85 Dr) ---');
  const { data: t3053 } = await supabase.from('transc1').select('*').eq('vid', 3053);
  console.log(JSON.stringify(t3053, null, 2));

  console.log('--- Checking vid = 13370 (MStock import) ---');
  const { data: t13370 } = await supabase.from('transc1').select('*').eq('vid', 13370);
  console.log(JSON.stringify(t13370, null, 2));
}

run().catch(console.error);
