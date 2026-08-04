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
  console.log('Fetching all vouchers for 2026-05-29...');
  const { data: vouchers } = await supabase
    .from('vouchersc1')
    .select('*')
    .eq('dt', '2026-05-29');

  console.log('Vouchers:', vouchers);

  if (vouchers && vouchers.length > 0) {
    const vids = vouchers.map(v => v.vid);
    const { data: trans } = await supabase
      .from('transc1')
      .select('*')
      .in('vid', vids);
    console.log('Entries in transc1:', trans);

    const { data: bs1 } = await supabase
      .from('bs1')
      .select('*')
      .in('acvch', vids);
    console.log('Entries in bs1:', bs1);
  }
}

run().catch(console.error);
