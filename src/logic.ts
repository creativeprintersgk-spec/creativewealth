import { defaultGroups } from "./logic_defaults.ts";
import { supabase } from "./supabase.ts";
import { calculateCapitalGains, applyTaxRules } from "./accounting-engine/voucherEngine.ts";
import { getLivePricesBatch, getAssetByAmid } from "./services/assetMasterService";

// Types
export type { Group, Ledger, Voucher, Entry, VoucherLine } from "./logic_defaults";

// Global State (In-Memory for performance and synchronous UI access)
let state = {
  groups: [] as any[],
  ledgers: [] as any[],
  vouchers: [] as any[],
  entries: [] as any[],
  taxLots: [] as any[],
  families: [] as any[],
  accounts: [] as any[],
  portfolios: [] as any[],
  investorGroups: [] as any[],
  prices: {} as Record<string, number>,
  initialized: false
};

const DEFAULT_LEDGERS = [
  { id: "Bank", name: "Bank", groupId: "bank", openingBalance: 0, openingType: "DR", currentBalance: 0, currentType: "DR" },
  { id: "Cash", name: "Cash", groupId: "cash", openingBalance: 0, openingType: "DR", currentBalance: 0, currentType: "DR" },
  { id: "Sales", name: "Sales", groupId: "income", openingBalance: 0, openingType: "CR", currentBalance: 0, currentType: "CR" },
  { id: "Office Expense", name: "Office Expense", groupId: "expenses", openingBalance: 0, openingType: "DR", currentBalance: 0, currentType: "DR" },
];

/**
 * Syncs changes to Supabase cloud database
 */
async function syncToCloud(type: string, record: any) {
  if (!record) return;
  
  // Mapping local names to Supabase tables
  const tableMap: Record<string, string> = {
    'families': 'families',
    'accounts': 'accounts',
    'portfolios': 'portfolios',
    'groups': 'groups',
    'ledgers': 'ledgers',
    'vouchers': 'vouchers',
    'entries': 'entries',
    'taxLots': 'tax_lots',
    'prices': 'prices',
    'investorGroups': 'investor_groups'
  };

  const table = tableMap[type];
  if (!table) return;

  // Transform fields for Supabase if needed (e.g., familyId -> family_id)
  const transform = (rec: any) => {
    const newRec = { ...rec };
    if (newRec.familyId) { newRec.family_id = newRec.familyId; delete newRec.familyId; }
    if (newRec.accountId) { newRec.account_id = newRec.accountId; delete newRec.accountId; }
    if (newRec.portfolioId) { newRec.portfolio_id = newRec.portfolioId; delete newRec.portfolioId; }
    if (newRec.groupId) { newRec.group_id = newRec.groupId; delete newRec.groupId; }
    if (newRec.voucherId) { newRec.voucher_id = newRec.voucherId; delete newRec.voucherId; }
    if (newRec.ledgerId) { newRec.ledger_id = newRec.ledgerId; delete newRec.ledgerId; }
    if (newRec.accountName) { newRec.account_name = newRec.accountName; delete newRec.accountName; }
    if (newRec.portfolioName) { newRec.portfolio_name = newRec.portfolioName; delete newRec.portfolioName; }
    if (newRec.openingBalance !== undefined) { newRec.opening_balance = newRec.openingBalance; delete newRec.openingBalance; }
    if (newRec.openingType) { newRec.opening_type = newRec.openingType; delete newRec.openingType; }
    if (newRec.voucherNo) { newRec.voucher_no = newRec.voucherNo; delete newRec.voucherNo; }
    if (newRec.portfolioIds) { newRec.portfolio_ids = newRec.portfolioIds; delete newRec.portfolioIds; }
    if (newRec.groupName) { newRec.group_name = newRec.groupName; delete newRec.groupName; }
    if (newRec.familyName) { newRec.name = newRec.familyName; delete newRec.familyName; }
    if (newRec.parent) { newRec.parent_id = newRec.parent; delete newRec.parent; }
    if (newRec.amid) { newRec.amid = newRec.amid; } // Keep amid as is
    
    // Tax Lots specific mappings
    if (newRec.purchaseDate) { newRec.purchase_date = newRec.purchaseDate; delete newRec.purchaseDate; }
    if (newRec.remainingQuantity !== undefined) { newRec.remaining_quantity = newRec.remainingQuantity; delete newRec.remainingQuantity; }
    if (newRec.costPerUnit !== undefined) { newRec.cost_per_unit = newRec.costPerUnit; delete newRec.costPerUnit; }
    if (newRec.costTotal !== undefined) { newRec.cost_total = newRec.costTotal; delete newRec.costTotal; }
    if (newRec.isClosed !== undefined) { newRec.is_closed = newRec.isClosed; delete newRec.isClosed; }
    
    // Remove UI-only or unsupported fields for Supabase schema
    delete newRec.fullName;
    delete newRec.accountingStartYear;
    delete newRec.address;
    delete newRec.city;
    delete newRec.country;
    delete newRec.category;
    delete newRec.portfolioType;
    delete newRec.isTradingPortfolio;

    return newRec;
  };

  const { error } = await supabase.from(table).upsert(transform(record));
  if (error) {
    console.error(`❌ Sync error (${table}):`, error.message);
  } else {
    console.log(`✅ Successfully synced ${table} record to cloud.`);
  }
}

/**
 * Persists current state to the project folder (db.json) - Keep for local fallback
 */
async function syncToLocalFolder() {
  // Logic preserved for local development but Supabase is primary
}

export async function initDatabase() {
  if (state.initialized) return;

  try {
    console.log("Initializing Cloud Database (Supabase)...");
    
    // Parallel fetch from all Supabase tables
    const [
      { data: groups },
      { data: ledgers },
      { data: families },
      { data: accounts },
      { data: portfolios },
      { data: vouchers },
      { data: entries },
      { data: taxLots },
      { data: prices },
      { data: investorGroups }
    ] = await Promise.all([
      supabase.from('groups').select('*'),
      supabase.from('ledgers').select('*'),
      supabase.from('families').select('*'),
      supabase.from('accounts').select('*'),
      supabase.from('portfolios').select('*'),
      supabase.from('vouchers').select('*'),
      supabase.from('entries').select('*'),
      supabase.from('tax_lots').select('*'),
      supabase.from('prices').select('*'),
      supabase.from('investor_groups').select('*')
    ]);

    // Map back from snake_case to camelCase and enforce Numeric types
    state.groups = (groups || []).map(g => ({ ...g, parent: g.parent_id }));
    state.ledgers = (ledgers || []).map(l => ({ 
      ...l, 
      groupId: l.group_id, 
      openingBalance: Number(l.opening_balance) || 0, 
      openingType: l.opening_type,
      amid: l.amid
    }));
    state.families = (families || []).map(f => ({ ...f, familyName: f.name }));
    state.accounts = (accounts || []).map(a => ({ ...a, familyId: a.family_id, accountName: a.account_name }));
    state.portfolios = (portfolios || []).map(p => ({ ...p, accountId: p.account_id, portfolioName: p.portfolio_name }));
    state.vouchers = (vouchers || []).map(v => ({ 
      ...v, 
      accountId: v.account_id || v.accountId, 
      portfolioId: v.portfolio_id || v.portfolioId, 
      voucherNo: v.voucher_no || v.voucherNo 
    }));
    state.entries = (entries || []).map(e => ({ 
      ...e, 
      voucherId: e.voucher_id || e.voucherId, 
      ledgerId: e.ledger_id || e.ledgerId,
      debit: Number(e.debit) || 0,
      credit: Number(e.credit) || 0,
      quantity: Number(e.quantity) || 0,
      price: Number(e.price) || 0
    }));

    state.taxLots = (taxLots || []).map(tl => ({
      ...tl,
      voucherId: tl.voucher_id,
      portfolioId: tl.portfolio_id,
      ledgerId: tl.ledger_id,
      purchaseDate: tl.purchase_date,
      quantity: Number(tl.quantity),
      remainingQuantity: Number(tl.remaining_quantity),
      costPerUnit: Number(tl.cost_per_unit),
      costTotal: Number(tl.cost_total)
    }));
    
    // Initialize prices map
    const pMap: Record<string, number> = {};
    (prices || []).forEach(p => { pMap[p.ledger_id] = Number(p.price) || 0; });
    state.prices = pMap;

    state.investorGroups = (investorGroups || []).map(ig => ({ ...ig, groupName: ig.group_name || ig.groupName, portfolioIds: ig.portfolio_ids || ig.portfolioIds }));
    
    // Final Fallback to Defaults if cloud is empty
    if (state.ledgers.length === 0) state.ledgers = DEFAULT_LEDGERS;
    if (state.groups.length === 0) state.groups = defaultGroups;
    
    state.initialized = true;
    console.log("🚀 Cloud Persistence Engine Ready");
  } catch (err) {
    console.error("❌ Cloud Initialization Failed:", err);
    state.initialized = true;
  }
}

export async function updateAssetPrice(assetId: string, price: number) {
  state.prices[assetId] = price;
  await syncToCloud('prices', { ledger_id: assetId, price, date: new Date().toISOString().split('T')[0] });
}

export async function syncLivePrices() {
  console.log("🔄 Starting Live Price Sync...");
  const ledgersWithAmid = state.ledgers.filter(l => l.amid);
  if (ledgersWithAmid.length === 0) {
    console.log("No ledgers with Asset Master link found.");
    return;
  }

  // 1. Fetch AssetMaster objects for these amids
  const assets: any[] = [];
  for (const l of ledgersWithAmid) {
    const asset = await getAssetByAmid(l.amid);
    if (asset) assets.push(asset);
  }

  // 2. Fetch live prices in batch
  const livePrices = await getLivePricesBatch(assets);
  
  // 3. Update state and cloud
  for (const l of ledgersWithAmid) {
    const lp = livePrices.get(l.amid);
    if (lp) {
      console.log(`Updating ${l.name}: ${lp.price}`);
      await updateAssetPrice(l.id, lp.price);
    }
  }
  console.log("✅ Live Price Sync Complete");
}

export async function ensureLedgerExists(name: string, groupId: string, amid?: number) {
  const existing = state.ledgers.find(l => (l.name === name || l.id === name) || (amid && l.amid === amid));
  if (existing) {
    if (amid && !existing.amid) {
       existing.amid = amid;
       await syncToCloud('ledgers', existing);
    }
    return existing;
  }

  const newLedger = {
    id: 'l_' + crypto.randomUUID(),
    name,
    groupId,
    openingBalance: 0,
    openingType: 'DR',
    amid
  };
  state.ledgers.push(newLedger);
  await syncToCloud('ledgers', newLedger);
  return newLedger;
}

// ── GETTERS (Sync for UI performance) ──
export function getStoredGroups() { return state.groups; }
export function getStoredLedgers() { return state.ledgers; }
export function getStoredVouchers() { return state.vouchers; }
export function getStoredEntries() { return state.entries; }
export function getStoredFamilies() { return state.families; }
export function getStoredAccounts() { return state.accounts; }
export function getStoredPortfolios() { return state.portfolios; }
export function getStoredInvestorGroups() { return state.investorGroups; }
export function getStoredPrices() { return state.prices; }
export function getStoredTaxLots() { return state.taxLots; }

export async function saveMasterRecord(type: 'families'|'accounts'|'portfolios'|'investorGroups', record: any) {
  const collection = state[type];
  const idx = collection.findIndex((item: any) => item.id === record.id);
  if (idx >= 0) collection[idx] = record;
  else collection.push(record);
  await syncToCloud(type, record);
}

export async function deleteMasterRecord(type: 'families'|'accounts'|'portfolios'|'investorGroups', id: string) {
  state[type] = state[type].filter((item: any) => item.id !== id);
  const tableMap: Record<string, string> = { 'families': 'families', 'accounts': 'accounts', 'portfolios': 'portfolios' };
  if (tableMap[type]) await supabase.from(tableMap[type]).delete().eq('id', id);
}

// ── MUTATORS (Sync to App Folder) ──

/**
 * Sequential Numbering: RV-0001, PV-0001, etc.
 */
export function getNextVoucherNo(type: string, fy: string) {
  const prefix = {
    receipt: 'RCPT',
    payment: 'PAY',
    journal: 'JRN',
    contra: 'CON'
  }[type.toLowerCase()] || 'VCH';

  const vouchersInFY = state.vouchers.filter(v => {
    // If the voucher already has an FY field, use it; otherwise calculate from date
    const vFY = v.fy || (() => {
      const d = new Date(v.date);
      const year = d.getFullYear();
      const month = d.getMonth() + 1;
      return month >= 4 ? `${year}-${year + 1}` : `${year - 1}-${year}`;
    })();
    return v.type === type && vFY === fy;
  });

  const nextNum = vouchersInFY.length + 1;
  return `${prefix}-${nextNum.toString().padStart(4, '0')}`;
}

export async function createVoucher(data: any) {
  // Resolve FY from date if not provided
  const getFY = (dateStr: string) => {
    const d = new Date(dateStr);
    const year = d.getFullYear();
    const month = d.getMonth() + 1;
    return month >= 4 ? `${year}-${year + 1}` : `${year - 1}-${year}`;
  };

  const fy = data.fy || getFY(data.date);
  const voucherNo = data.voucherNo || getNextVoucherNo(data.type, fy);

  // Derive accountId from portfolioId if not provided
  let accountId = data.accountId;
  if (!accountId && data.portfolioId) {
    const port = state.portfolios.find(p => p.id === data.portfolioId);
    if (port) accountId = port.accountId;
  }

  const voucher = { 
    id: data.id, 
    date: data.date, 
    type: data.type, 
    narration: data.narration,
    voucherNo: voucherNo,
    fy: fy,
    portfolioId: data.portfolioId,
    accountId: accountId // Ensure accountId is preserved
  };

  const entries = data.lines.map((l: any) => ({
    id: l.id || crypto.randomUUID(),
    voucherId: data.id,
    ledgerId: l.ledgerId,
    debit: Number(l.debit) || 0,
    credit: Number(l.credit) || 0,
    quantity: Number(l.quantity) || 0,
    price: Number(l.price) || 0,
    narration: l.narration 
  }));

  // --- CAPITAL GAINS LOGIC ---
  const extraEntries: any[] = [];
  
  for (const entry of [...entries]) {
    const ledger = state.ledgers.find(l => l.id === entry.ledgerId);
    if (!ledger) continue;

    // Check if it's an investment group and determine asset category
    let isInvestment = false;
    let assetCategory = 'equity'; // Default

    let currGroup = state.groups.find(g => g.id === ledger.groupId);
    while (currGroup) {
      if (currGroup.id === 'investments') {
        isInvestment = true;
      }
      if (currGroup.id === 'mf_debt' || currGroup.id === 'fds' || currGroup.id === 'traded_bonds' || currGroup.id === 'ncd_debentures') {
        assetCategory = 'debt';
      }
      currGroup = state.groups.find(pg => pg.id === currGroup?.parent);
    }

    if (!isInvestment) continue;

    if (entry.debit > 0) {
      // BUY Transaction -> Create Tax Lot
      const taxLot = {
        id: 'tl_' + crypto.randomUUID(),
        voucherId: data.id,
        portfolioId: data.portfolioId,
        ledgerId: entry.ledgerId,
        purchaseDate: data.date,
        quantity: entry.quantity,
        remainingQuantity: entry.quantity,
        costPerUnit: entry.price || (entry.debit / entry.quantity),
        costTotal: entry.debit,
        isClosed: false
      };
      state.taxLots.push(taxLot);
      await syncToCloud('taxLots', taxLot);
    } else if (entry.credit > 0) {
      // SELL Transaction -> Calculate Gain & Adjust Entries
      const results = calculateCapitalGains(
        entry.ledgerId,
        data.portfolioId,
        data.date,
        entry.price || (entry.credit / entry.quantity),
        entry.quantity,
        state.taxLots
      );

      // 1. Update the updated tax lots in cloud (those modified by calculateCapitalGains)
      // Note: calculateCapitalGains modifies the objects in state.taxLots in-place
      const affectedLots = state.taxLots.filter(tl => tl.ledgerId === entry.ledgerId && tl.portfolioId === data.portfolioId);
      for (const lot of affectedLots) {
        await syncToCloud('taxLots', lot);
      }

      // 2. Determine Capital Gain Type (STCG vs LTCG)
      const totalGain = results.ltcg + results.stcg;
      if (totalGain !== 0) {
        const isLTCG = results.ltcg > results.stcg;
        const groupType = isLTCG ? `ltcg_${assetCategory}` : `stcg_${assetCategory}`;
        const gainLedgerName = isLTCG 
          ? (assetCategory === 'equity' ? 'LTCG Listed Equity' : 'LTCG Debt/Other')
          : (assetCategory === 'equity' ? 'STCG Listed Equity' : 'STCG Debt/Other');
          
        const gainLedger = await ensureLedgerExists(gainLedgerName, groupType);

        // ADJUSTMENT: We want the investment ledger to be credited with COST only.
        // Currently 'entry' is credited with SALE PRICE.
        entry.credit = results.costBasis;
        
        extraEntries.push({
          id: crypto.randomUUID(),
          voucherId: data.id,
          ledgerId: gainLedger.id,
          debit: totalGain < 0 ? Math.abs(totalGain) : 0,
          credit: totalGain > 0 ? totalGain : 0,
          narration: `CG on sale of ${ledger.name} (${isLTCG ? 'LT' : 'ST'})`
        });
      }
    }
  }
  
  entries.push(...extraEntries);
  // --- END CAPITAL GAINS LOGIC ---

  state.vouchers.push(voucher);
  state.entries.push(...entries);
  
  await syncToCloud('vouchers', voucher);
  for (const entry of entries) {
    await syncToCloud('entries', entry);
  }
  console.log(`✅ Voucher ${voucherNo} saved to Cloud`);
}


export async function updateVoucher(data: any) {
  // Preserve original voucher number and FY if editing
  const existing = state.vouchers.find(v => v.id === data.id);
  const updatedData = {
    ...data,
    voucherNo: data.voucherNo || existing?.voucherNo,
    fy: data.fy || existing?.fy
  };

  // 1. Delete old entries from memory AND Supabase
  state.vouchers = state.vouchers.filter(v => v.id !== data.id);
  state.entries = state.entries.filter(e => e.voucherId !== data.id);
  await supabase.from('entries').delete().eq('voucher_id', data.id);

  // 2. Re-create the voucher (which will sync new entries to cloud)
  await createVoucher(updatedData);
}

export async function deleteVoucher(id: string) {
  state.vouchers = state.vouchers.filter(v => v.id !== id);
  state.entries = state.entries.filter(e => e.voucherId !== id);
  await supabase.from('vouchers').delete().eq('id', id);
}

export async function saveLedger(ledger: any) {
  const idx = state.ledgers.findIndex(l => l.id === ledger.id);
  if (idx >= 0) state.ledgers[idx] = ledger;
  else state.ledgers.push(ledger);
  await syncToCloud('ledgers', ledger);
}

export async function deleteLedger(id: string) {
  state.ledgers = state.ledgers.filter(l => l.id !== id);
  await supabase.from('ledgers').delete().eq('id', id);
}

// ── ACCOUNTING ENGINE (Synchronous on Memory State) ──

/**
 * FY Helper: Returns start and end dates for a given FY string (e.g. "2024-2025")
 */
function getFYRange(fy: string) {
  const [startYear] = fy.split("-");
  const year = parseInt(startYear);
  return {
    start: `${year}-04-01`,
    end: `${year + 1}-03-31`
  };
}

export function getLedgerWithBalance(ledgerId: string, startDate?: string, endDate?: string, accountId?: string) {
  const ledger = state.ledgers.find(l => l.id === ledgerId);
  if (!ledger) return { transactions: [], openingBalance: 0, closingBalance: 0 };

  const range = (startDate && endDate) ? { start: startDate, end: endDate } : null;

  // Resolve portfolios if accountId is provided for deeper filtering
  const portfolioIds = accountId ? state.portfolios.filter(p => p.accountId === accountId).map(p => p.id) : null;

  // Get all entries for this ledger
  const ledgerEntries = state.entries.filter(e => e.ledgerId === ledgerId);
  
  // Join with vouchers to get dates and sort
  const entriesWithDate = ledgerEntries.map(e => {
    const v = state.vouchers.find(v => v.id === e.voucherId);
    return { ...e, date: v?.date || '1900-01-01', v };
  }).sort((a, b) => {
    if (a.date !== b.date) return a.date.localeCompare(b.date);
    return a.voucherId.localeCompare(b.voucherId);
  });

  let runningBalance = ledger.openingType === 'DR' ? ledger.openingBalance : -ledger.openingBalance;
  
  // Account Isolation: If accountId is provided, the opening balance should only include 
  // transactions for that account. BUT wait - usually opening balance is a static value 
  // on the ledger. In WealthCore, ledgers like "Bank" are shared, so "opening balance" 
  // for a specific account on a shared ledger is complex.
  // Requirement: "strictly enforce person-wise integrity".
  // This implies either:
  // a) Ledgers are NOT shared (each person has their own Bank A/c ledger).
  // b) Ledgers are shared, but filtered.
  // If shared, the "Ledger Opening Balance" property belongs to NO ONE or the first person.
  // Better: In a professional PMS, every person has their own ledger for their bank account.
  
  let fyOpeningBalance = runningBalance;
  
  const fyTransactions: any[] = [];

  entriesWithDate.forEach(e => {
    const isBeforeFY = range ? e.date < range.start : false;
    const isWithinFY = range ? (e.date >= range.start && e.date <= range.end) : true;

    // Filter by Account (Priority 1: accountId on voucher, Priority 2: portfolio mapping)
    if (accountId) {
      const vAccount = e.v?.accountId;
      const vPortId = e.v?.portfolioId;
      
      const belongsToAccount = (vAccount === accountId) || (vPortId && portfolioIds?.includes(vPortId));
      if (!belongsToAccount) return;
    }

    if (isBeforeFY) {
      runningBalance += e.debit;
      runningBalance -= e.credit;
      fyOpeningBalance = runningBalance;
    } else if (isWithinFY) {
      runningBalance += e.debit;
      runningBalance -= e.credit;
      
      fyTransactions.push({
        date: e.date,
        voucherId: e.voucherId,
        voucherType: e.v?.type || 'journal',
        againstLedger: (() => {
          const voucherEntries = state.entries.filter(ve => ve.voucherId === e.voucherId);
          const oppositeEntries = voucherEntries.filter(ve => 
            e.debit > 0 ? ve.credit > 0 : ve.debit > 0
          );
          
          if (oppositeEntries.length === 1) {
            const oppositeLedger = state.ledgers.find(l => l.id === oppositeEntries[0].ledgerId);
            return oppositeLedger?.name || oppositeEntries[0].ledgerId;
          } else if (oppositeEntries.length > 1) {
            return "Multiple";
          } else {
            const others = voucherEntries.filter(ve => ve.id !== e.id);
            if (others.length === 1) {
              const otherLedger = state.ledgers.find(l => l.id === others[0].ledgerId);
              return otherLedger?.name || others[0].ledgerId;
            }
            return "Various";
          }
        })(),
        narration: e.v?.narration || '',
        debit: e.debit,
        credit: e.credit,
        balance: runningBalance
      });
    }
  });

  return {
    transactions: fyTransactions,
    openingBalance: fyOpeningBalance,
    closingBalance: range ? (fyTransactions.length > 0 ? fyTransactions[fyTransactions.length - 1].balance : fyOpeningBalance) : runningBalance
  };
}

export function getLedgerBalance(ledgerId: string, accountId?: string): number {
  const ledger = state.ledgers.find(l => l.id === ledgerId);
  if (!ledger) return 0;

  let bal = ledger.openingType === 'DR' ? ledger.openingBalance : -ledger.openingBalance;
  
  // Resolve portfolios if accountId is provided for filtering
  const portfolioIds = accountId ? state.portfolios.filter(p => p.accountId === accountId).map(p => p.id) : null;

  state.entries.filter(e => e.ledgerId === ledgerId).forEach(e => {
    const v = state.vouchers.find(v => v.id === e.voucherId);
    if (!v) return;
    
    if (accountId) {
      const vAccount = v.accountId;
      const vPortId = v.portfolioId;
      const belongsToAccount = (vAccount === accountId) || (vPortId && portfolioIds?.includes(vPortId));
      if (!belongsToAccount) return;
    }

    bal += e.debit;
    bal -= e.credit;
  });
  return bal;
}

export function calculateGroupTotal(groupId: string, accountId?: string): number {
  const group = state.groups.find(g => g.id === groupId);
  if (!group) return 0;

  let total = 0;
  const ledgersInGroup = state.ledgers.filter(l => l.groupId === groupId);
  ledgersInGroup.forEach(l => {
    total += getLedgerBalance(l.id, accountId);
  });

  const childGroups = state.groups.filter(g => g.parent === groupId);
  childGroups.forEach(cg => {
    total += calculateGroupTotal(cg.id, accountId);
  });

  return total;
}

export function generateBS(accountId?: string) {
   let assets = 0;
   let liabilities = 0;
   let income = 0;
   let expense = 0;
 
   // Resolve root type for any group
   const getGroupType = (groupId: string): string => {
     let current = state.groups.find((g: any) => g.id === groupId);
     while (current) {
       if (current.type) return current.type;
       current = state.groups.find((g: any) => g.id === current.parent);
     }
     return "ASSET";
   };
 
   state.ledgers.forEach(ledger => {
     const type = getGroupType(ledger.groupId);
     const bal = getLedgerBalance(ledger.id, accountId);
 
     if (type === 'ASSET') assets += bal;
     else if (type === 'LIABILITY') liabilities += bal;
     else if (type === 'INCOME') income += bal;
     else if (type === 'EXPENSE') expense += bal;
   });
 
   const profit = (-income) - expense;
 
   return {
     assets: assets,
     liabilities: (-liabilities) + profit,
     profit,
     // Detailed breakdown for UI
     assetGroups: state.groups.filter(g => g.type === 'ASSET' && !g.parent).map(g => ({
       id: g.id,
       name: g.name,
       total: calculateGroupTotal(g.id, accountId)
     })),
     liabilityGroups: state.groups.filter(g => g.type === 'LIABILITY' && !g.parent).map(g => ({
       id: g.id,
       name: g.name,
       total: calculateGroupTotal(g.id, accountId)
     }))
   };
 }

export function getVoucherById(id: string) {
  const v = state.vouchers.find(v => v.id === id);
  if (!v) return null;
  const entries = state.entries.filter(e => e.voucherId === id);
  return { ...v, lines: entries };
}

export async function handleYearClose(selectedFY: string, onSuccess?: () => void) {
  if (!window.confirm(`Close Financial Year ${selectedFY}?\n\nThis will post a closing journal entry transferring all Income and Expense balances to Capital Account.`)) return

  // Resolve root type for any group by walking up the parent chain
  const getGroupType = (groupId: string): string => {
    let current = state.groups.find((g: any) => g.id === groupId)
    while (current) {
      if (current.type) return current.type
      current = state.groups.find((g: any) => g.id === current.parent)
    }
    return "ASSET"
  }

  // Helper: FY from a date string
  function getFinancialYear(dateStr: string) {
    if (!dateStr) return "1900-1901"
    const d = new Date(dateStr)
    const year = d.getFullYear()
    const month = d.getMonth() + 1
    return month >= 4 ? `${year}-${year + 1}` : `${year - 1}-${year}`
  }

  // Capital account ledger
  const capitalLedger = state.ledgers.find((l: any) =>
    getGroupType(l.groupId) === 'LIABILITY' && l.name.toLowerCase().includes('capital')
  )
  if (!capitalLedger) {
    alert("Could not find a Capital Account ledger. Please create one under Capital Account group first.")
    return
  }

  // Calculate each Income/Expense ledger balance up to and including selectedFY
  const entriesByLedger: Record<string, any[]> = {}
  state.entries.forEach((e: any) => {
    const v = state.vouchers.find((v: any) => v.id === e.voucherId)
    if (!v) return
    const fy = getFinancialYear(v.date)
    if (fy <= selectedFY) {
      if (!entriesByLedger[e.ledgerId]) entriesByLedger[e.ledgerId] = []
      entriesByLedger[e.ledgerId].push(e)
    }
  })

  const getLedgerBalance = (ledger: any) => {
    let dr = ledger.openingType === 'DR' ? (ledger.openingBalance || 0) : 0
    let cr = ledger.openingType === 'CR' ? (ledger.openingBalance || 0) : 0
    ;(entriesByLedger[ledger.id] || []).forEach((e: any) => {
      dr += e.debit || 0
      cr += e.credit || 0
    })
    const type = getGroupType(ledger.groupId)
    return type === 'INCOME' ? (cr - dr) : (dr - cr)
  }

  const lines: any[] = []

  state.ledgers.forEach((l: any) => {
    const type = getGroupType(l.groupId)
    if (type !== 'INCOME' && type !== 'EXPENSE') return

    const bal = getLedgerBalance(l)
    if (bal === 0) return

    if (type === 'INCOME') {
      lines.push({ ledgerId: l.id, debit: Math.abs(bal), credit: 0 })
      lines.push({ ledgerId: capitalLedger.id, debit: 0, credit: Math.abs(bal) })
    } else {
      lines.push({ ledgerId: capitalLedger.id, debit: Math.abs(bal), credit: 0 })
      lines.push({ ledgerId: l.id, debit: 0, credit: Math.abs(bal) })
    }
  })

  if (lines.length === 0) {
    alert(`No Income or Expense balances found for FY ${selectedFY}.`)
    return
  }

  const endYearStr = selectedFY.split("-")[1]
  const endYear = endYearStr.length === 2 ? `20${endYearStr}` : endYearStr
  const closeDate = `${endYear}-03-31`

  await createVoucher({
    id: crypto.randomUUID(),
    date: closeDate,
    type: "journal",
    narration: `Year End Closing Entry — FY ${selectedFY}`,
    lines,
  })

  alert(`✅ FY ${selectedFY} closed. Net P&L transferred to ${capitalLedger.name}.`)
  if (onSuccess) onSuccess()
}
// ── WEALTH ENGINE (Holdings & Portfolios) ──

export interface AssetHolding {
  assetId: string;
  assetName: string;
  groupId: string;
  quantity: number;
  avgPrice: number;
  amtInvested: number;
  currentPrice: number;
  todaysGain: number;
  overallGain: number;
  currentValue: number;
  portfolioSplits: Array<{
    portfolioId: string;
    portfolioName: string;
    quantity: number;
    amtInvested: number;
  }>;
  priceNotSet?: boolean;
}

/**
 * Calculates holdings for a set of portfolios.
 * This is the core logic that the user was worried about.
 */
export function getHoldings(portfolioIds: string[], assetGroupId?: string | string[], asOfDate?: string): AssetHolding[] {
  const holdingsMap: Record<string, AssetHolding> = {};

  // 1. Get all vouchers for these portfolios (or accounts owning these portfolios)
  const relevantVouchers = state.vouchers.filter(v => {
    // Date filtering
    if (asOfDate && v.date > asOfDate) return false;

    // If voucher explicitly has a portfolioId, it must be in our requested list
    if (v.portfolioId) return portfolioIds.includes(v.portfolioId);
    
    // If no portfolioId on voucher, check if it belongs to an account that owns these portfolios
    const accountPortfolios = state.portfolios.filter(p => p.accountId === v.accountId);
    const accountPortIds = accountPortfolios.map(p => p.id);
    
    // If this account has multiple portfolios, we cannot safely assume this "orphan" voucher 
    // belongs to the requested portfolio(s) UNLESS we are requesting ALL portfolios of this account.
    const isRequestingAllForAccount = accountPortIds.every(pid => portfolioIds.includes(pid));
    const hasOnlyOnePortfolio = accountPortIds.length === 1;

    return isRequestingAllForAccount || (hasOnlyOnePortfolio && portfolioIds.includes(accountPortIds[0]));
  });
  const vIds = new Set(relevantVouchers.map(v => v.id));
  
  console.log(`[getHoldings] portfolioIds:`, portfolioIds);
  console.log(`[getHoldings] found ${relevantVouchers.length} vouchers`);

  // 2. Get all entries for these vouchers
  const relevantEntries = state.entries.filter(e => vIds.has(e.voucherId));
  console.log(`[getHoldings] found ${relevantEntries.length} entries`);

  // 3. Process entries to calculate quantity and cost
  relevantEntries.forEach(entry => {
    const ledger = state.ledgers.find(l => l.id === entry.ledgerId);
    if (!ledger) return;

    // Only process "Asset" ledgers (Investments, Stocks, etc.)
    const isInvestment = state.groups.some(g => {
      if (g.id !== ledger.groupId) return false;
      // Walk up to see if it's under 'investments' or 'fixed_assets'
      let current: any = g;
      while (current) {
        if (current.id === 'investments' || current.id === 'fixed_assets') return true;
        current = state.groups.find(pg => pg.id === current.parent);
      }
      return false;
    });

    if (!isInvestment) return;
    
    if (assetGroupId) {
      if (Array.isArray(assetGroupId)) {
        if (!assetGroupId.includes(ledger.groupId)) return;
      } else {
        if (ledger.groupId !== assetGroupId) return;
      }
    }

    const voucher = relevantVouchers.find(v => v.id === entry.voucherId);
    if (!voucher) return;

    if (!holdingsMap[ledger.id]) {
      holdingsMap[ledger.id] = {
        assetId: ledger.id,
        assetName: ledger.name,
        groupId: ledger.groupId,
        quantity: 0,
        avgPrice: 0,
        amtInvested: 0,
        currentPrice: 0, // Will be fetched/mocked
        todaysGain: 0,
        overallGain: 0,
        currentValue: 0,
        portfolioSplits: []
      };
    }

    const holding = holdingsMap[ledger.id];
    
    // Logic: Debit increases quantity (Buy), Credit decreases quantity (Sell)
    if (entry.debit > 0) {
      holding.quantity += (entry.quantity || 0);
      holding.amtInvested += entry.debit;
    } else if (entry.credit > 0) {
      // For sells, we reduce quantity proportionally or based on entry quantity
      const sellQty = entry.quantity || 0;
      if (holding.quantity > 0) {
        // Average cost reduction
        const costPerUnit = holding.amtInvested / holding.quantity;
        holding.amtInvested -= (sellQty * costPerUnit);
      }
      holding.quantity -= sellQty;
    }

    // Update Portfolio Split
    let split = holding.portfolioSplits.find(s => s.portfolioId === voucher.portfolioId);
    if (!split) {
      const port = state.portfolios.find(p => p.id === voucher.portfolioId);
      split = { 
        portfolioId: voucher.portfolioId, 
        portfolioName: port?.portfolioName || 'Unknown', 
        quantity: 0, 
        amtInvested: 0 
      };
      holding.portfolioSplits.push(split);
    }
    
    if (entry.debit > 0) {
      split.quantity += (entry.quantity || 0);
      split.amtInvested += entry.debit;
    } else if (entry.credit > 0) {
      const sellQty = entry.quantity || 0;
      if (split.quantity > 0) {
        const costPerUnit = split.amtInvested / split.quantity;
        split.amtInvested -= (sellQty * costPerUnit);
      }
      split.quantity -= sellQty;
    }
  });

  // 4. Finalize calculations (Avg Price, Market Value, Gains)
  return Object.values(holdingsMap)
    .filter(h => Math.abs(h.quantity) > 0.0001) // Filter out zero holdings
    .map(h => {
       h.avgPrice = h.quantity > 0 ? h.amtInvested / h.quantity : 0;
       
       // Current price logic: use stored price or fallback to mock
       const storedPrice = state.prices[h.assetId];
       if (storedPrice !== undefined) {
         h.currentPrice = storedPrice;
       } else {
         h.currentPrice = 0; // Default to 0 if no price set
         h.priceNotSet = true;
       }
       
       h.currentValue = h.quantity * h.currentPrice;
       h.overallGain = h.currentValue - h.amtInvested;
       h.todaysGain = 0; // We don't have daily change logic yet
       
       return h;
     });
}

/**
 * Gets transaction history for a specific asset across portfolios.
 * Used for the Drilldown Ledger Modal.
 */
export interface AssetTransaction {
  id: string;
  date: string;
  type: string;
  portfolioName: string;
  quantity: number;
  price: number;
  debit: number;
  credit: number;
  amount: number;
  balanceQty: number;
  narration: string;
  voucherId: string;
}

export function getAssetTransactions(portfolioIds: string[], assetId: string): AssetTransaction[] {
  const relevantVouchers = state.vouchers.filter(v => portfolioIds.includes(v.portfolioId));
  const vIds = new Set(relevantVouchers.map(v => v.id));
  
  const relevantEntries = state.entries
    .filter(e => e.ledgerId === assetId && vIds.has(e.voucherId))
    .sort((a, b) => {
      const vA = state.vouchers.find(v => v.id === a.voucherId);
      const vB = state.vouchers.find(v => v.id === b.voucherId);
      return (vA?.date || '').localeCompare(vB?.date || '');
    });

  let runningQty = 0;
  return relevantEntries.map(entry => {
    const voucher = state.vouchers.find(v => v.id === entry.voucherId)!;
    const port = state.portfolios.find(p => p.id === voucher.portfolioId);
    
    const qty = entry.quantity || 0;
    if (entry.debit > 0) runningQty += qty;
    else if (entry.credit > 0) runningQty -= qty;

    return {
      id: entry.id,
      date: voucher.date,
      type: voucher.type.toUpperCase(),
      portfolioName: port?.portfolioName || 'Unknown',
      quantity: qty,
      price: entry.price || 0,
      debit: entry.debit,
      credit: entry.credit,
      amount: entry.debit || entry.credit,
      balanceQty: runningQty,
      narration: entry.narration || voucher.narration || '',
      voucherId: voucher.id
    };
  });
}

export function getPortfolioActivity(portfolioIds: string[]) {
  const relevantVouchers = state.vouchers.filter(v => portfolioIds.includes(v.portfolioId));
  const vIds = new Set(relevantVouchers.map(v => v.id));
  
  const relevantEntries = state.entries
    .filter(e => vIds.has(e.voucherId))
    .filter(e => {
        const ledger = state.ledgers.find(l => l.id === e.ledgerId);
        if (!ledger) return false;
        return (e.quantity > 0 || ledger.groupId === 'stocks' || ledger.groupId.startsWith('mf'));
    })
    .sort((a, b) => {
      const vA = state.vouchers.find(v => v.id === a.voucherId);
      const vB = state.vouchers.find(v => v.id === b.voucherId);
      const dateA = vA?.date || '';
      const dateB = vB?.date || '';
      return dateA.localeCompare(dateB);
    });

  return relevantEntries.map(e => {
    const v = state.vouchers.find(v => v.id === e.voucherId)!;
    const l = state.ledgers.find(l => l.id === e.ledgerId)!;
    const p = state.portfolios.find(p => p.id === v.portfolioId);
    return {
      id: e.id,
      date: v.date,
      assetName: l.name,
      portfolioName: p?.portfolioName || 'Unknown',
      type: e.debit > 0 ? 'BUY' : 'SELL',
      quantity: e.quantity || 0,
      price: e.price || 0,
      amount: e.debit || e.credit,
      voucherNo: v.voucherNo,
      narration: v.narration || '',
      voucherId: v.id
    };
  });
}

export function getTrialBalance(asOfDate?: string, accountId?: string) {
  const trialBalance: any[] = [];
  
  state.ledgers.forEach(ledger => {
    const lData = getLedgerWithBalance(ledger.id, undefined, asOfDate, accountId);
    if (!Array.isArray(lData) && Math.abs(lData.closingBalance) > 0.001) {
      const group = state.groups.find(g => g.id === ledger.groupId);
      trialBalance.push({
        ledgerId: ledger.id,
        ledgerName: ledger.name,
        groupId: ledger.groupId,
        groupName: group?.name || 'Unknown',
        type: group?.type || 'ASSET',
        debit: lData.closingBalance > 0 ? lData.closingBalance : 0,
        credit: lData.closingBalance < 0 ? Math.abs(lData.closingBalance) : 0,
        balance: lData.closingBalance
      });
    }
  });

  return trialBalance;
}
