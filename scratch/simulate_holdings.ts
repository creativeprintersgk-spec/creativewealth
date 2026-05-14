import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
dotenv.config({ path: path.resolve(__dirname, '../.env') });

const supabase = createClient(process.env.VITE_SUPABASE_URL!, process.env.VITE_SUPABASE_ANON_KEY!);

async function simulate() {
  const { data: rawGroups } = await supabase.from('groups').select('*');
  const { data: rawLedgers } = await supabase.from('ledgers').select('*');
  const { data: rawVouchers } = await supabase.from('vouchers').select('*');
  const { data: rawEntries } = await supabase.from('entries').select('*');
  const { data: rawPortfolios } = await supabase.from('portfolios').select('*');

  // Simulate initDatabase mapping
  const groups = (rawGroups || []).map(g => ({ ...g, parent: g.parent_id }));
  const ledgers = (rawLedgers || []).map(l => ({ ...l, groupId: l.group_id, openingBalance: l.opening_balance, openingType: l.opening_type }));
  const vouchers = (rawVouchers || []).map(v => ({ ...v, accountId: v.account_id || v.accountId, portfolioId: v.portfolio_id || v.portfolioId, voucherNo: v.voucher_no || v.voucherNo }));
  const entries = (rawEntries || []).map(e => ({ ...e, voucherId: e.voucher_id || e.voucherId, ledgerId: e.ledger_id || e.ledgerId }));
  const portfolios = (rawPortfolios || []).map(p => ({ ...p, accountId: p.account_id, portfolioName: p.portfolio_name }));

  // Simulate PMSWorkspace for PRAMESH SHAH (gilv9xql8)
  const familyId = 'gilv9xql8';
  const accounts_for_family = [{ id: '8fsdnspd2' }, { id: 'zxq2mh8m0' }];
  const portfolioIds = portfolios
    .filter(p => accounts_for_family.some(a => a.id === p.accountId))
    .map(p => p.id);
  
  console.log('Portfolio IDs for family:', portfolioIds);

  // Simulate getHoldings
  const relevantVouchers = vouchers.filter(v => {
    if (v.portfolioId && portfolioIds.includes(v.portfolioId)) return true;
    const accountPortfolios = portfolios.filter(p => p.accountId === v.accountId).map(p => p.id);
    return accountPortfolios.some(pid => portfolioIds.includes(pid));
  });
  console.log(`\nRelevant vouchers: ${relevantVouchers.length}`);

  const vIds = new Set(relevantVouchers.map(v => v.id));
  const relevantEntries = entries.filter(e => vIds.has(e.voucherId));
  console.log(`Relevant entries: ${relevantEntries.length}`);

  // Process entries
  let investmentEntries = 0;
  let skippedNoLedger = 0;
  let skippedNotInvestment = 0;

  relevantEntries.forEach(entry => {
    const ledger = ledgers.find(l => l.id === entry.ledgerId);
    if (!ledger) { skippedNoLedger++; return; }

    const isInvestment = groups.some(g => {
      if (g.id !== ledger.groupId) return false;
      let current: any = g;
      const visited = new Set();
      while (current) {
        if (visited.has(current.id)) break; // prevent infinite loop
        visited.add(current.id);
        if (current.id === 'investments' || current.id === 'fixed_assets') return true;
        current = groups.find(pg => pg.id === current.parent);
      }
      return false;
    });

    if (!isInvestment) { skippedNotInvestment++; return; }
    investmentEntries++;
  });

  console.log(`\n📊 Entry breakdown:`);
  console.log(`   Investment entries processed: ${investmentEntries}`);
  console.log(`   Skipped (no ledger found): ${skippedNoLedger}`);
  console.log(`   Skipped (not investment group): ${skippedNotInvestment}`);

  // Sample investment entries details
  console.log('\n🔍 Sample investment entries:');
  let count = 0;
  for (const entry of relevantEntries) {
    const ledger = ledgers.find(l => l.id === entry.ledgerId);
    if (!ledger) continue;
    const grp = groups.find(g => g.id === ledger.groupId);
    if (!grp) continue;
    if (grp.id === 'investments' || grp.parent === 'investments' || grp.parent === 'fixed_assets') {
      if (count < 5) {
        console.log(`   ledger="${ledger.name?.slice(0,30)}" group=${ledger.groupId} debit=${entry.debit} credit=${entry.credit} qty=${entry.quantity}`);
        count++;
      }
    }
  }
}

simulate();
