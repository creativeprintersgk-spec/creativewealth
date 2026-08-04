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
  console.log('--- Checking vid = 3059 in trans1 ---');
  const { data: t3059 } = await supabase.from('trans1').select('*, acmac1(*)').eq('vid', 3059);
  console.log(JSON.stringify(t3059, null, 2));

  console.log('--- Checking vid = 3059 in vouchers1 ---');
  const { data: v3059 } = await supabase.from('vouchers1').select('*').eq('vid', 3059);
  console.log(JSON.stringify(v3059, null, 2));
}

run().catch(console.error);
