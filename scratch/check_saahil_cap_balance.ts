import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';

dotenv.config();

const supabase = createClient(
  process.env.VITE_SUPABASE_URL!,
  process.env.VITE_SUPABASE_ANON_KEY!
);

async function check() {
  const accountId = 'acc_31'; // Saahil Shah
  
  // Fetch portfolios for Saahil
  const { data: portfolios } = await supabase.from('portfolios').select('id').eq('account_id', accountId);
  const portfolioIds = portfolios?.map(p => p.id) || [];
  
  console.log('Saahil Portfolios:', portfolioIds);

  // Fetch vouchers for Saahil
  const { data: vouchers } = await supabase.from('vouchers').select('id, account_id, portfolio_id');
  const saahilVouchers = vouchers?.filter(v => 
    v.account_id === accountId || (v.portfolio_id && portfolioIds.includes(v.portfolio_id))
  ) || [];
  const saahilVoucherIds = saahilVouchers.map(v => v.id);

  console.log(`Saahil Vouchers Count: ${saahilVouchers.length}`);

  // Fetch ledgers in group 'capital_account'
  const { data: ledgers } = await supabase.from('ledgers').select('*').eq('group_id', 'capital_account');
  console.log('Capital account ledgers:', ledgers?.map(l => ({ id: l.id, name: l.name })));

  // Fetch entries for these vouchers and ledgers
  const { data: entries } = await supabase.from('entries').select('*')
    .in('voucher_id', saahilVoucherIds)
    .in('ledger_id', ledgers?.map(l => l.id) || []);
  
  console.log('\n--- SAHIL CAPITAL ACCOUNT ENTRIES ---');
  entries?.forEach(e => {
    console.log(`Voucher: ${e.voucher_id}, Ledger: ${e.ledger_id}, Debit: ${e.debit}, Credit: ${e.credit}`);
  });

  // Calculate balances
  let totalDebit = 0;
  let totalCredit = 0;
  entries?.forEach(e => {
    totalDebit += Number(e.debit) || 0;
    totalCredit += Number(e.credit) || 0;
  });
  console.log(`\nTotals - Debit: ${totalDebit}, Credit: ${totalCredit}, Net (CR - DR): ${totalCredit - totalDebit}`);
}

check().catch(console.error);
