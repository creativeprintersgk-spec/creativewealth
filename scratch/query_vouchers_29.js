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
  console.log('Querying vouchers for acid = 29...');
  const { data: vouchers, error: vErr } = await supabase
    .from('vouchersc1')
    .select('*')
    .eq('acid', 29)
    .limit(5);

  if (vErr) {
    console.error('Error fetching vouchers:', vErr);
    return;
  }

  console.log('Vouchers for acid 29:', vouchers);

  if (vouchers && vouchers.length > 0) {
    const vids = vouchers.map(v => v.vid);
    const { data: trans, error: tErr } = await supabase
      .from('transc1')
      .select('*')
      .in('vid', vids);

    if (tErr) {
      console.error('Error fetching transc1:', tErr);
      return;
    }

    console.log('Trans for acid 29:', trans);
  }
}

run().catch(console.error);
