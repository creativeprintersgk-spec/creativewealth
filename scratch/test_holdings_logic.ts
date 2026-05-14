import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

dotenv.config({ path: path.resolve(__dirname, '../.env') });

const supabaseUrl = process.env.VITE_SUPABASE_URL || '';
const supabaseAnonKey = process.env.VITE_SUPABASE_ANON_KEY || '';

const supabase = createClient(supabaseUrl, supabaseAnonKey);

async function testHoldingsLogic() {
  const [
    { data: groups },
    { data: ledgers },
    { data: portfolios },
    { data: vouchers },
    { data: entries },
    { data: prices }
  ] = await Promise.all([
    supabase.from('groups').select('*'),
    supabase.from('ledgers').select('*'),
    supabase.from('portfolios').select('*'),
    supabase.from('vouchers').select('*'),
    supabase.from('entries').select('*'),
    supabase.from('prices').select('*')
  ]);

  const state = {
    groups: (groups || []).map(g => ({ ...g, parent: g.parent_id })),
    ledgers: (ledgers || []).map(l => ({ ...l, groupId: l.group_id, openingBalance: l.opening_balance, openingType: l.opening_type })),
    portfolios: (portfolios || []).map(p => ({ ...p, accountId: p.account_id, portfolioName: p.portfolio_name })),
    vouchers: (vouchers || []).map(v => ({ ...v, accountId: v.account_id || v.accountId, portfolioId: v.portfolio_id || v.portfolioId, voucherNo: v.voucher_no || v.voucherNo })),
    entries: (entries || []).map(e => ({ ...e, voucherId: e.voucher_id || e.voucherId, ledgerId: e.ledger_id || e.ledgerId })),
    prices: {} as Record<string, number>
  };

  const accountId = '8fsdnspd2'; // ARJIN Shah
  const portfolioIds = state.portfolios.filter(p => p.accountId === accountId).map(p => p.id);

  const relevantVouchers = state.vouchers.filter(v => {
    if (v.portfolioId && portfolioIds.includes(v.portfolioId)) return true;
    const accountPortfolios = state.portfolios.filter(p => p.accountId === v.accountId).map(p => p.id);
    return accountPortfolios.some(pid => portfolioIds.includes(pid));
  });

  const vIds = new Set(relevantVouchers.map(v => v.id));
  const relevantEntries = state.entries.filter(e => vIds.has(e.voucherId));

  const holdingsMap: any = {};
  relevantEntries.forEach(entry => {
    const ledger = state.ledgers.find(l => l.id === entry.ledgerId);
    if (!ledger) return;

    const isInvestment = state.groups.some(g => {
      if (g.id !== ledger.groupId) return false;
      let current: any = g;
      while (current) {
        if (current.id === 'investments' || current.id === 'fixed_assets') return true;
        current = state.groups.find(pg => pg.id === current.parent);
      }
      return false;
    });

    if (!isInvestment) return;

    const voucher = relevantVouchers.find(v => v.id === entry.voucherId);
    if (!voucher) return;

    if (!holdingsMap[ledger.id]) {
      holdingsMap[ledger.id] = { quantity: 0, amtInvested: 0 };
    }
    const holding = holdingsMap[ledger.id];
    
    if (entry.debit > 0) {
      holding.quantity += (entry.quantity || 0);
      holding.amtInvested += entry.debit;
    } else if (entry.credit > 0) {
      const sellQty = entry.quantity || 0;
      if (holding.quantity > 0) {
        const costPerUnit = holding.amtInvested / holding.quantity;
        holding.amtInvested -= (sellQty * costPerUnit);
      }
      holding.quantity -= sellQty;
    }
  });

  const finalHoldings = Object.values(holdingsMap).filter((h: any) => Math.abs(h.quantity) > 0.0001);
  console.log("Final holdings count:", finalHoldings.length);
  if (finalHoldings.length > 0) {
    console.log("Sample holding:", finalHoldings[0]);
  }
}

testHoldingsLogic();
