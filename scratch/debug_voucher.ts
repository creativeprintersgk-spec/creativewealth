import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
dotenv.config({ path: path.resolve(__dirname, '../.env') });

const supabase = createClient(process.env.VITE_SUPABASE_URL!, process.env.VITE_SUPABASE_ANON_KEY!);

async function debugVoucher() {
  console.log('Searching for any voucher containing "0005"...');
  const { data: allV } = await supabase.from('vouchers').select('*').ilike('voucher_no', '%0005%');
  console.log(JSON.stringify(allV, null, 2));
}

debugVoucher();
