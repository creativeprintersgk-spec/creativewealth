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
  console.log('--- Deleting incorrect vid 3059 ---');
  await supabase.from('trans1').delete().eq('vid', 3059);
  await supabase.from('vouchers1').delete().eq('vid', 3059);
  console.log('Deleted vid 3059.');

  console.log('--- Moving vid 13370 to correct acid 30 ---');
  await supabase.from('vouchersc1').update({ acid: 30 }).eq('vid', 13370);
  await supabase.from('transc1').update({ acid: 30 }).eq('vid', 13370);
  console.log('Updated vid 13370 to acid 30.');
}

run().catch(console.error);
