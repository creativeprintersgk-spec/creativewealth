import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';

dotenv.config();
const supabase = createClient(process.env.VITE_SUPABASE_URL || '', process.env.VITE_SUPABASE_ANON_KEY || '');

async function fetchPaginated(table: string) {
  let allData: any[] = [];
  let page = 0;
  const pageSize = 1000;
  while (true) {
    const { data, error } = await supabase
      .from(table)
      .select('*')
      .range(page * pageSize, (page + 1) * pageSize - 1);
    if (error) {
      throw new Error(`Failed to fetch ${table}: ${error.message}`);
    }
    if (!data || data.length === 0) break;
    allData = allData.concat(data);
    if (data.length < pageSize) break;
    page++;
  }
  return allData;
}

async function run() {
  console.log('Fetching database data...');
  const [
    groups,
    ledgers,
    families,
    accounts,
    portfolios,
    vouchers,
    entries
  ] = await Promise.all([
    fetchPaginated('groups'),
    fetchPaginated('ledgers'),
    fetchPaginated('families'),
    fetchPaginated('accounts'),
    fetchPaginated('portfolios'),
    fetchPaginated('vouchers'),
    fetchPaginated('entries')
  ]);

  console.log(`Fetched: ${groups.length} groups, ${ledgers.length} ledgers, ${vouchers.length} vouchers, ${entries.length} entries`);

  const state = {
    groups: (groups || []).map(g => ({ ...g, parent: g.parent_id })),
    ledgers: (ledgers || []).map(l => ({ 
      ...l, 
      groupId: l.group_id, 
      openingBalance: Number(l.opening_balance) || 0, 
      openingType: l.opening_type,
      amid: l.amid
    })),
    families: (families || []).map(f => ({ ...f, familyName: f.name })),
    accounts: (accounts || []).map(a => ({ ...a, familyId: a.family_id, accountName: a.account_name })),
    portfolios: (portfolios || []).map(p => ({ ...p, accountId: p.account_id, portfolioName: p.portfolio_name })),
    vouchers: (vouchers || []).map(v => ({ 
      ...v, 
      accountId: v.account_id || v.accountId, 
      portfolioId: v.portfolio_id || v.portfolioId, 
      voucherNo: v.voucher_no || v.voucherNo 
    })),
    entries: (entries || []).map(e => ({ 
      ...e, 
      voucherId: e.voucher_id || e.voucherId, 
      ledgerId: e.ledger_id || e.ledgerId,
      debit: Number(e.debit) || 0,
      credit: Number(e.credit) || 0,
      quantity: Number(e.quantity) || 0,
      price: Number(e.price) || 0
    }))
  };

  const getGroupType = (groupId: string): string => {
    let current = state.groups.find((g: any) => g.id === groupId);
    while (current) {
      if (current.type) return current.type;
      current = state.groups.find((g: any) => g.id === current.parent_id || g.id === current.parent);
    }
    return "ASSET";
  };

  const accountId = 'acc_29'; // Unnati Shah
  const portfolioIds = state.portfolios.filter((p: any) => p.accountId === accountId).map((p: any) => p.id);

  console.log(`Portfolios for Unnati:`, portfolioIds);

  // Pre-group entries by voucher
  const entriesByVoucher: Record<string, any[]> = {};
  state.entries.forEach(e => {
    if (!entriesByVoucher[e.voucherId]) {
      entriesByVoucher[e.voucherId] = [];
    }
    entriesByVoucher[e.voucherId].push(e);
  });

  // Filter vouchers belonging to Unnati Shah
  const unnatiVouchers = state.vouchers.filter((v: any) => {
    const vAccount = v.accountId;
    const vPortId = v.portfolioId;
    return (vAccount === accountId) || (vPortId && portfolioIds.includes(vPortId));
  });

  console.log(`Total vouchers for Unnati: ${unnatiVouchers.length}`);

  // Sum up all debits and credits by ledger directly
  const ledgerBalancesMap = new Map<string, { debit: number, credit: number }>();
  
  // Initialize with opening balances if any (all are 0 from MProfit though)
  state.ledgers.forEach(l => {
    ledgerBalancesMap.set(l.id, {
      debit: l.openingType === 'DR' ? l.openingBalance : 0,
      credit: l.openingType === 'CR' ? l.openingBalance : 0
    });
  });

  unnatiVouchers.forEach(v => {
    const vEntries = entriesByVoucher[v.id] || [];
    vEntries.forEach(e => {
      if (!ledgerBalancesMap.has(e.ledgerId)) {
        ledgerBalancesMap.set(e.ledgerId, { debit: 0, credit: 0 });
      }
      const bal = ledgerBalancesMap.get(e.ledgerId)!;
      bal.debit += e.debit;
      bal.credit += e.credit;
    });
  });

  // Compute balance sheet totals
  let totalAssets = 0;
  let totalLiabilities = 0;
  let totalIncome = 0;
  let totalExpense = 0; // Will be positive in absolute terms for subtraction

  console.log('\n--- Unnati Shah Ledger Balances ---');
  state.ledgers.forEach(l => {
    const balInfo = ledgerBalancesMap.get(l.id) || { debit: 0, credit: 0 };
    const type = getGroupType(l.groupId);
    
    if (type === 'ASSET') {
      const bal = balInfo.debit - balInfo.credit;
      if (Math.abs(bal) > 0.01) {
        totalAssets += bal;
        console.log(`- ${l.name} (${l.id}) [Type: ASSET, Group: ${l.groupId}]: ${bal.toFixed(2)}`);
      }
    } else if (type === 'LIABILITY') {
      const bal = balInfo.credit - balInfo.debit;
      if (Math.abs(bal) > 0.01) {
        totalLiabilities += bal;
        console.log(`- ${l.name} (${l.id}) [Type: LIABILITY, Group: ${l.groupId}]: ${bal.toFixed(2)}`);
      }
    } else if (type === 'INCOME') {
      const bal = balInfo.credit - balInfo.debit;
      if (Math.abs(bal) > 0.01) {
        totalIncome += bal;
        console.log(`- ${l.name} (${l.id}) [Type: INCOME, Group: ${l.groupId}]: ${bal.toFixed(2)}`);
      }
    } else if (type === 'EXPENSE') {
      const bal = balInfo.debit - balInfo.credit; // Expense is positive when DR > CR
      if (Math.abs(bal) > 0.01) {
        totalExpense += bal;
        console.log(`- ${l.name} (${l.id}) [Type: EXPENSE, Group: ${l.groupId}]: ${bal.toFixed(2)}`);
      }
    }
  });

  const netPL = totalIncome - totalExpense; // credit - debit
  const netLiabilitiesAndEquity = totalLiabilities + netPL;

  console.log('\n--- CONSOLIDATED TOTALS ---');
  console.log(`Total Assets: ${totalAssets.toFixed(2)}`);
  console.log(`Total Liabilities (Excl. P&L): ${totalLiabilities.toFixed(2)}`);
  console.log(`Total Income: ${totalIncome.toFixed(2)}`);
  console.log(`Total Expense: ${totalExpense.toFixed(2)}`);
  console.log(`Net P&L (Income - Expense): ${netPL.toFixed(2)}`);
  console.log(`Total Liabilities & Equity: ${netLiabilitiesAndEquity.toFixed(2)}`);
  console.log(`Difference (Assets - L&E): ${(totalAssets - netLiabilitiesAndEquity).toFixed(2)}`);
}

run();
