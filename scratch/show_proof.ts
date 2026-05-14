import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
dotenv.config({ path: path.resolve(__dirname, '../.env') });

const supabase = createClient(process.env.VITE_SUPABASE_URL!, process.env.VITE_SUPABASE_ANON_KEY!);

async function showProof() {
  const voucherNo = 'RCPT-0005';
  
  // 1. Get the voucher
  const { data: voucher } = await supabase.from('vouchers').select('*').eq('voucher_no', voucherNo).single();
  
  if (!voucher) {
    console.log(`❌ No voucher found with number ${voucherNo}`);
    return;
  }

  console.log(`\n✅ FOUND VOUCHER:`);
  console.log(`   Voucher No: ${voucher.voucher_no}`);
  console.log(`   Voucher ID: ${voucher.id}`);
  console.log(`   Date      : ${voucher.date}`);

  // 2. Get the entries
  const { data: entries } = await supabase.from('entries').select('*').eq('voucher_id', voucher.id);

  console.log(`\n✅ FOUND ${entries?.length || 0} ENTRIES FOR THIS VOUCHER:`);
  entries?.forEach((e, i) => {
    console.log(`   Entry #${i+1}:`);
    console.log(`     Ledger ID: ${e.ledger_id}`);
    console.log(`     Debit    : ₹${e.debit}`);
    console.log(`     Credit   : ₹${e.credit}`);
  });
}

showProof();
