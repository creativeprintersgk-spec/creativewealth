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
  console.log('--- Checking for EXACT -12430.03 balance in bs1 ---');
  const { data: b1 } = await supabase.from('bs1').select('*').or('cramt.eq.12430.03,dramt.eq.12430.03');
  console.log('bs1:', b1);

  console.log('--- Checking for 12430.03 in trans1 and transc1 ---');
  const { data: t1 } = await supabase.from('trans1').select('*').or('cramt.eq.12430.03,dramt.eq.12430.03');
  console.log('trans1:', t1);
  const { data: tc1 } = await supabase.from('transc1').select('*').or('cramt.eq.12430.03,dramt.eq.12430.03');
  console.log('transc1:', tc1);
}

run().catch(console.error);
