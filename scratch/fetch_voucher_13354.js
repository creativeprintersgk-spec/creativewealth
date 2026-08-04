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
  const { data: voucher } = await supabase.from('vouchersc1').select('*').eq('vid', 13354).single();
  const { data: lines } = await supabase.from('transc1').select('*').eq('vid', 13354);
  const { data: scnotes } = await supabase.from('scnote1').select('*').eq('vid', 13354);

  console.log("Voucher:", voucher);
  console.log("Lines:");
  console.table(lines);
  console.log("Contract Notes:", scnotes);
}

run().catch(console.error);
