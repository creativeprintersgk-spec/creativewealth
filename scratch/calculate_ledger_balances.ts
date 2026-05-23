import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';

dotenv.config();

const supabase = createClient(
  process.env.VITE_SUPABASE_URL!,
  process.env.VITE_SUPABASE_ANON_KEY!
);

async function check() {
  const { data: ledgers } = await supabase.from('ledgers').select('*');
  if (!ledgers) return;

  // Fetch all entries with pagination
  const allEntries: any[] = [];
  let offset = 0;
  const limit = 1000;
  while (true) {
    const { data, error } = await supabase
      .from('entries')
      .select('ledger_id, debit, credit, voucher_id, vouchers(account_id)')
      .range(offset, offset + limit - 1);
    
    if (error) {
      console.error(error);
      break;
    }
    if (!data || data.length === 0) break;
    allEntries.push(...data);
    offset += limit;
  }

  // Compute balances
  const ledgerBalances = new Map<string, { debits: number, credits: number, account_ids: Set<string> }>();
  for (const e of allEntries) {
    const lid = e.ledger_id;
    if (!ledgerBalances.has(lid)) {
      ledgerBalances.set(lid, { debits: 0, credits: 0, account_ids: new Set() });
    }
    const bal = ledgerBalances.get(lid)!;
    bal.debits += Number(e.debit) || 0;
    bal.credits += Number(e.credit) || 0;
    if (e.vouchers?.account_id) {
      bal.account_ids.add(e.vouchers.account_id);
    }
  }

  // Filter ledgers for acc_31
  const accountId = 'acc_31';
  console.log(`\n================ LEDGER BALANCES FOR ${accountId} ================`);
  
  // Group by group_id
  const byGroup: Record<string, { name: string, balance: number }[]> = {};
  
  for (const l of ledgers) {
    const bal = ledgerBalances.get(l.id) || { debits: 0, credits: 0, account_ids: new Set() };
    const accList = Array.from(bal.account_ids);
    
    // Check if this ledger has entries for acc_31
    if (accList.includes(accountId)) {
      const net = bal.debits - bal.credits; // DR - CR is standard for Assets
      if (Math.abs(net) < 0.01) continue; // skip zero balances
      
      const groupId = l.group_id || 'other';
      if (!byGroup[groupId]) byGroup[groupId] = [];
      byGroup[groupId].push({
        name: l.name,
        balance: net
      });
    }
  }

  for (const [groupId, items] of Object.entries(byGroup)) {
    console.log(`\nGroup: ${groupId}`);
    let groupTotal = 0;
    for (const item of items) {
      console.log(`  - ${item.name}: ${item.balance.toFixed(2)}`);
      groupTotal += item.balance;
    }
    console.log(`  Total for ${groupId}: ${groupTotal.toFixed(2)}`);
  }
}

check().catch(console.error);
