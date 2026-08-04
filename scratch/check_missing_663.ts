import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
dotenv.config({ path: path.resolve(__dirname, '../.env') });

const supabase = createClient(process.env.VITE_SUPABASE_URL!, process.env.VITE_SUPABASE_ANON_KEY!);

async function run() {
  const ids = [503099, 677, 678, 679, 680];
  const { data: ledgers } = await supabase.from('acmac1').select('id, name, acid').in('id', ids);
  console.log('Ledgers in DB for these IDs:', ledgers);

  const { data: voucher } = await supabase.from('vouchersc1').select('*').eq('vid', 925);
  console.log('Voucher c_925:', voucher);
  
  const { data: trans } = await supabase.from('transc1').select('*').eq('vid', 925);
  console.log('Transactions for c_925:', trans);
}
run().catch(console.error);
