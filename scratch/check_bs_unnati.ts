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

  const getLedgerBalance = (ledger: any, groupType: string): number => {
    let debit = 0;
    let credit = 0;

    if (ledger.openingBalance) {
      if (ledger.openingType === 'DR') debit += ledger.openingBalance;
      else if (ledger.openingType === 'CR') credit += ledger.openingBalance;
    }

    state.vouchers.forEach((v: any) => {
      // Account Isolation
      const vAccount = v.accountId;
      const vPortId = v.portfolioId;
      const belongsToAccount = (vAccount === accountId) || (vPortId && portfolioIds?.includes(vPortId));
      if (!belongsToAccount) return;

      const vEntries = state.entries.filter((e: any) => e.voucherId === v.id);
      vEntries.forEach((e: any) => {
        if (e.ledgerId === ledger.id) {
          debit += e.debit || 0;
          credit += e.credit || 0;
        }
      });
    });

    if (groupType === "ASSET") return debit - credit;
    return credit - debit; // LIABILITY, INCOME, EXPENSE
  };

  // Compute balance sheet totals
  let totalAssets = 0;
  let totalLiabilities = 0;
  let totalIncome = 0;
  let totalExpense = 0;

  console.log('\n--- Ledger Balances ---');
  state.ledgers.forEach(l => {
    const type = getGroupType(l.groupId);
    const bal = getLedgerBalance(l, type);
    if (Math.abs(bal) > 0.01) {
      if (type === 'ASSET') {
        totalAssets += bal;
      } else if (type === 'LIABILITY') {
        totalLiabilities += bal;
      } else if (type === 'INCOME') {
        totalIncome += bal;
      } else if (type === 'EXPENSE') {
        totalExpense += bal;
      }
      console.log(`- ${l.name} (${l.id}) [Type: ${type}, Group: ${l.groupId}]: ${bal.toFixed(2)}`);
    }
  });

  const netPL = totalIncome - totalExpense; // credit - debit
  const netLiabilitiesAndEquity = totalLiabilities + netPL;

  console.log('\n--- CONSOLIDATED TOTALS ---');
  console.log(`Total Assets: ${totalAssets.toFixed(2)}`);
  console.log(`Total Liabilities (Excl. P&L): ${totalLiabilities.toFixed(2)}`);
  console.log(`Net P&L (Income - Expense): ${netPL.toFixed(2)}`);
  console.log(`Total Liabilities & Equity: ${netLiabilitiesAndEquity.toFixed(2)}`);
  console.log(`Difference (Assets - L&E): ${(totalAssets - netLiabilitiesAndEquity).toFixed(2)}`);
}

run();
