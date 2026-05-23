import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';

dotenv.config();

const supabase = createClient(
  process.env.VITE_SUPABASE_URL!,
  process.env.VITE_SUPABASE_ANON_KEY!
);

async function check() {
  const { data: vouchers, error } = await supabase.from('vouchers').select('id, account_id');
  if (error) {
    console.error('Error:', error);
    return;
  }
  const byAcc: Record<string, number> = {};
  vouchers?.forEach(v => {
    const acc = v.account_id || 'null';
    byAcc[acc] = (byAcc[acc] || 0) + 1;
  });
  console.log('Vouchers in database grouped by account_id:', byAcc);
}

check().catch(console.error);
