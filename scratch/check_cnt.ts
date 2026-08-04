import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
dotenv.config({ path: path.resolve(__dirname, '../.env') });

const supabase = createClient(process.env.VITE_SUPABASE_URL!, process.env.VITE_SUPABASE_ANON_KEY!);

async function run() {
  const { data: vouchers } = await supabase.from('vouchersc1').select('*').ilike('narr', '%CNT-25/26-44663413%');
  console.log('Voucher:', vouchers);
  
  if (vouchers && vouchers.length > 0) {
    const { data: trans } = await supabase.from('transc1').select('*').eq('vid', vouchers[0].vid);
    console.log('Transactions:', trans);
  }
}
run().catch(console.error);
