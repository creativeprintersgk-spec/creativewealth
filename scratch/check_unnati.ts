import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';

dotenv.config();
const supabase = createClient(process.env.VITE_SUPABASE_URL || '', process.env.VITE_SUPABASE_ANON_KEY || '');

async function run() {
  // 1. Fetch families and accounts
  const { data: accounts } = await supabase.from('accounts').select('*');
  console.log('--- ACCOUNTS ---');
  console.log(accounts?.map(a => ({ id: a.id, name: a.account_name, family_id: a.family_id })));

  const unnatiAcc = accounts?.find(a => a.account_name?.toLowerCase().includes('unnati'));
  if (!unnatiAcc) {
    console.log('Unnati Shah account not found!');
    return;
  }
  console.log('\nFound Unnati Account:', unnatiAcc);

  // 2. Fetch all vouchers for this account
  let allVouchers: any[] = [];
  let page = 0;
  const pageSize = 1000;
  while (true) {
    const { data: vPage, error } = await supabase
      .from('vouchers')
      .select('*')
      .eq('account_id', unnatiAcc.id)
      .range(page * pageSize, (page + 1) * pageSize - 1);
    
    if (error) {
      console.error('Error fetching vouchers page:', error);
      break;
    }
    if (!vPage || vPage.length === 0) break;
    allVouchers = allVouchers.concat(vPage);
    if (vPage.length < pageSize) break;
    page++;
  }

  console.log(`\nTotal Vouchers for ${unnatiAcc.account_name}:`, allVouchers.length);

  // Check opening balance voucher
  const { data: allV0Vouchers } = await supabase.from('vouchers').select('*').like('id', 'v_0_%');
  console.log('\n--- ALL V_0_ VOUCHERS IN DB ---');
  console.log(allV0Vouchers);

  const opVoucher = allVouchers.find(v => v.id.startsWith('v_0_'));
  console.log('\nUnnati Opening Balance Voucher:', opVoucher);

  if (opVoucher) {
    const { data: opEntries } = await supabase.from('entries').select('*, ledgers(name)').eq('voucher_id', opVoucher.id);
    console.log('\nOpening Balance Entries:');
    let drSum = 0;
    let crSum = 0;
    opEntries?.forEach(e => {
      console.log(`- Ledger: ${e.ledgers?.name || e.ledger_id}, DR: ${e.debit}, CR: ${e.credit}`);
      drSum += Number(e.debit) || 0;
      crSum += Number(e.credit) || 0;
    });
    console.log(`Total DR: ${drSum}, Total CR: ${crSum}, Balanced? ${drSum === crSum}`);
  }

  // 3. Fetch all entries for these vouchers
  const vIds = allVouchers.map(v => v.id);
  if (vIds.length === 0) {
    console.log('No vouchers found for Unnati.');
    return;
  }

  let allEntries: any[] = [];
  for (let i = 0; i < vIds.length; i += 200) {
    const slice = vIds.slice(i, i + 200);
    const { data: entriesChunk, error } = await supabase
      .from('entries')
      .select('*, ledgers(*)')
      .in('voucher_id', slice);
    if (error) {
      console.error('Error fetching entries:', error);
      break;
    }
    if (entriesChunk) {
      allEntries = allEntries.concat(entriesChunk);
    }
  }

  console.log(`Total Entries for ${unnatiAcc.account_name}:`, allEntries.length);

  // Group by ledger and compute balance
  const ledgerBalances = new Map<string, { name: string, group_id: string, balance: number }>();
  allEntries.forEach(e => {
    const l = e.ledgers;
    if (!l) return;
    if (!ledgerBalances.has(l.id)) {
      ledgerBalances.set(l.id, { name: l.name, group_id: l.group_id, balance: 0 });
    }
    const item = ledgerBalances.get(l.id)!;
    item.balance += (Number(e.debit) || 0) - (Number(e.credit) || 0);
  });

  console.log('\nLedger Balances for Unnati (Non-zero):');
  for (const [id, item] of ledgerBalances.entries()) {
    if (Math.abs(item.balance) > 0.01) {
      console.log(`- ${item.name} (${id}) [Group: ${item.group_id}]: ${item.balance.toFixed(2)}`);
    }
  }
}

run();
