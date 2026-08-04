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
  console.log('--- Querying vouchersc1 for vid = 13352 ---');
  const { data: v } = await supabase.from('vouchersc1').select('*').eq('vid', 13352);
  console.log('Voucher:', v);

  console.log('\n--- Querying transc1 for vid = 13352 ---');
  const { data: t } = await supabase.from('transc1').select('*').eq('vid', 13352);
  console.log('Entries:', t);

  console.log('\n--- Querying bs1 for acvch = 13352 ---');
  const { data: b } = await supabase.from('bs1').select('*').eq('acvch', 13352);
  console.log('BS1 Rows:', b);
  
  console.log('\n--- Querying bs1 for trid = 13352 ---');
  const { data: b2 } = await supabase.from('bs1').select('*').eq('trid', 13352);
  console.log('BS1 Rows (trid):', b2);
}

run().catch(console.error);
