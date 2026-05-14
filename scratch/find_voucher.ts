import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
dotenv.config({ path: path.resolve(__dirname, '../.env') });

const supabase = createClient(process.env.VITE_SUPABASE_URL!, process.env.VITE_SUPABASE_ANON_KEY!);

async function findVoucher() {
  const { data: v5 } = await supabase.from('vouchers').select('*').eq('voucher_no', 'RCPT-0005');
  const { data: v6 } = await supabase.from('vouchers').select('*').eq('voucher_no', 'RCPT-0006');
  
  console.log('\n🔍 SEARCHING FOR RCPT-0005:');
  console.log(JSON.stringify(v5, null, 2));
  
  console.log('\n🔍 SEARCHING FOR RCPT-0006:');
  console.log(JSON.stringify(v6, null, 2));
}

findVoucher();
