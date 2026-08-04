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
  console.log('--- Checking for 18799.85 in trans1 ---');
  const { data: t1 } = await supabase.from('trans1').select('*').or('cramt.eq.18799.85,dramt.eq.18799.85');
  console.log(JSON.stringify(t1, null, 2));

  console.log('--- Checking for 18799.85 in transc1 ---');
  const { data: tc1 } = await supabase.from('transc1').select('*').or('cramt.eq.18799.85,dramt.eq.18799.85');
  console.log(JSON.stringify(tc1, null, 2));
}

run().catch(console.error);
