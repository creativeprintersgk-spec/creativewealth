import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
dotenv.config({ path: path.resolve(__dirname, '../.env') });

const supabase = createClient(process.env.VITE_SUPABASE_URL!, process.env.VITE_SUPABASE_ANON_KEY!);

async function checkRecent() {
  const { data: vouchers } = await supabase.from('vouchers').select('*').order('created_at', { descending: true }).limit(5);
  console.log('\n📅 MOST RECENT VOUCHERS:');
  vouchers?.forEach(v => {
    console.log(`   id=${v.id} no=${v.voucher_no} type=${v.type} date=${v.date} created=${v.created_at}`);
  });
}

checkRecent();
