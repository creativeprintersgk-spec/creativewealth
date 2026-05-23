import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';

dotenv.config();

const supabase = createClient(
  process.env.VITE_SUPABASE_URL!,
  process.env.VITE_SUPABASE_ANON_KEY!
);

async function check() {
  // Fetch all ledgers in capital_account group
  const { data: ledgers } = await supabase
    .from('ledgers')
    .select('*')
    .eq('group_id', 'capital_account');
  
  if (!ledgers) return;

  const ledgerIds = ledgers.map(l => l.id);
  
  // Fetch entries for these ledgers
  const { data: entries } = await supabase
    .from('entries')
    .select('*, vouchers(*)')
    .in('ledger_id', ledgerIds);
  
  if (!entries) return;

  console.log(`Found ${entries.length} entries for Capital Account ledgers`);
  
  // Group by ledger name and account_id from voucher
  const summary: Record<string, { debits: number, credits: number, count: number, accounts: Set<string> }> = {};
  
  for (const e of entries) {
    const l = ledgers.find(ld => ld.id === e.ledger_id)!;
    const key = `${l.name} (${l.id})`;
    if (!summary[key]) {
      summary[key] = { debits: 0, credits: 0, count: 0, accounts: new Set() };
    }
    summary[key].debits += Number(e.debit) || 0;
    summary[key].credits += Number(e.credit) || 0;
    summary[key].count += 1;
    if (e.vouchers?.account_id) {
      summary[key].accounts.add(e.vouchers.account_id);
    }
  }

  console.log('\n--- CAPITAL ACCOUNT SUMMARY ---');
  for (const [key, val] of Object.entries(summary)) {
    console.log(`${key}:`);
    console.log(`  Count:   ${val.count}`);
    console.log(`  Debits:  ${val.debits}`);
    console.log(`  Credits: ${val.credits}`);
    console.log(`  Net:     ${val.credits - val.debits} (CR - DR)`);
    console.log(`  Accounts:${Array.from(val.accounts).join(', ')}`);
  }
}

check().catch(console.error);
