import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';

dotenv.config();

const supabase = createClient(
  process.env.VITE_SUPABASE_URL!,
  process.env.VITE_SUPABASE_ANON_KEY!
);

async function check() {
  const { data: ledgers } = await supabase.from('ledgers').select('*').eq('group_id', 'capital_account');
  const { data: entries } = await supabase.from('entries').select('*, vouchers(*)');
  
  console.log('--- CAPITAL ACCOUNT LEDGERS ---');
  ledgers?.forEach(l => {
    console.log(`Ledger ID: ${l.id}, Name: ${l.name}`);
  });

  console.log('\n--- ENTRIES FOR CAPITAL ACCOUNT ---');
  let count = 0;
  entries?.forEach(e => {
    const l = ledgers?.find(ledger => ledger.id === e.ledger_id);
    if (l) {
      console.log(`Voucher ${e.voucher_id} [${e.vouchers?.date}]: Ledger ${l.name} (${e.ledger_id}) Debit: ${e.debit}, Credit: ${e.credit}`);
      count++;
    }
  });
  console.log(`Total entries: ${count}`);
}

check().catch(console.error);
