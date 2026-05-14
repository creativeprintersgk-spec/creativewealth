import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
dotenv.config({ path: path.resolve(__dirname, '../.env') });

const supabase = createClient(process.env.VITE_SUPABASE_URL!, process.env.VITE_SUPABASE_ANON_KEY!);

async function findDuplicates() {
  const { data: vouchers } = await supabase.from('vouchers').select('*').order('created_at', { ascending: false });
  if (!vouchers) return;

  const seen = new Map<string, any>();
  const duplicates: any[] = [];

  for (const v of vouchers) {
    if (!v.voucher_no) continue;
    const key = `${v.account_id}_${v.voucher_no}`;
    if (seen.has(key)) {
      duplicates.push(v);
    } else {
      seen.set(key, v);
    }
  }

  console.log(`\n🔍 Found ${duplicates.length} duplicate vouchers (by account_id + voucher_no):`);
  duplicates.forEach(v => {
    console.log(`   Duplicate: id=${v.id} no=${v.voucher_no} date=${v.date} created=${v.created_at}`);
  });

  if (duplicates.length > 0) {
    console.log('\n⚠️ To fix this, we should delete these duplicate IDs and their linked entries.');
  }
}

findDuplicates();
