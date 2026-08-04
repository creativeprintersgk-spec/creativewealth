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
  console.log('Querying last 5 vouchers in vouchersc1...');
  const { data: vouchers, error: vErr } = await supabase
    .from('vouchersc1')
    .select('*')
    .order('vid', { ascending: false })
    .limit(5);

  if (vErr) {
    console.error('Error fetching vouchersc1:', vErr);
    return;
  }

  console.log('Recent vouchers in vouchersc1:');
  console.log(JSON.stringify(vouchers, null, 2));

  if (vouchers && vouchers.length > 0) {
    const vids = vouchers.map(v => v.vid);
    console.log('\nQuerying transc1 for these vids:', vids);
    const { data: trans, error: tErr } = await supabase
      .from('transc1')
      .select('*')
      .in('vid', vids);

    if (tErr) {
      console.error('Error fetching transc1:', tErr);
      return;
    }

    console.log('Corresponding transc1 entries:');
    console.log(JSON.stringify(trans, null, 2));
  }
}

run().catch(console.error);
