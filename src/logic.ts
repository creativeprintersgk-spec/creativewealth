// WealthCore — Complete Logic Layer v2
// Reads from real MProfit Supabase tables
// All TypeScript errors fixed

import { supabase } from "./supabase";

// ── TYPES ─────────────────────────────────────────────────────────────────────
export type Group = {
  id: string; name: string; parent?: string;
  type?: string; acid?: number; specialTypeId?: number;
};

export type Ledger = {
  id: string; name: string; groupId: string;
  openingBalance: number; openingType: "DR" | "CR";
  currentBalance?: number; currentType?: "DR" | "CR";
  amid?: number; acid?: number;
};

export type VoucherLine = {
  id: string; ledgerId: string | null; ledgerName?: string;
  debit: number; credit: number;
  quantity?: number; price?: number; narration?: string;
};

export type Voucher = {
  id: string; date: string; type: string;
  narration: string; voucherNo: string;
  portfolioId?: string; accountId?: string; fy?: string;
};

export type Entry = {
  id: string; voucherId: string; ledgerId: string;
  debit: number; credit: number; quantity: number; price: number;
  date?: string; accountId?: string;
};

// ── ASSET TYPE MAPS ───────────────────────────────────────────────────────────
export const ASSET_TYPE_MAP: Record<number, string> = {
  50: 'Stocks', 60: 'Mutual Funds (Equity)', 66: 'Mutual Funds (Hybrid)',
  81: 'Mutual Funds (Debt)', 40: 'Bonds', 70: 'Gold / SGBs',
  30: 'Fixed Deposits', 95: 'NPS / ULIP', 115: 'Real Estate',
  120: 'PPF / EPF', 140: 'AIF', 75: 'Silver', 77: 'Jewellery',
};

export const ASSET_TYPE_ICON: Record<number, string> = {
  50: 'EQ', 60: 'MF', 66: 'MF', 81: 'MF', 40: 'BND',
  70: 'GLD', 30: 'FD', 95: 'NPS', 115: 'PR', 120: 'PPF',
  140: 'AIF', 75: 'SLV', 77: 'JWL',
};

// ── STATE ─────────────────────────────────────────────────────────────────────
let state = {
  portfolios: [] as any[],
  investorGroupMembers: [] as any[],
  accPflink: [] as any[],
  acmac1: [] as any[],
  sam: [] as any[],
  assetMaster: [] as any[],
  bs1: [] as any[],
  sumTable: [] as any[],
  vouchersC1: [] as any[],
  vouchers1: [] as any[],
  transC1: [] as any[],
  trans1: [] as any[],
  mprices: [] as any[],
  priceMap: {} as Record<number, { curr: number; prev: number }>,
  assetNameMap: {} as Record<number, string>,
  initialized: false
};

// ── SAFE FETCH ────────────────────────────────────────────────────────────────
async function safeFetch(table: string, max = 50000): Promise<any[]> {
  try {
    let all: any[] = [];
    const pkMap: Record<string, string> = {
      bs1: 'trno',
      transc1: 'transid', trans1: 'transid',
      vouchersc1: 'vid', vouchers1: 'vid',
      portfolios: 'id', investor_group_members: 'id', acc_pflink: 'pfid',
      acmac1: 'id', sam: 'amid', asset_master: 'amid',
      sum_table: 'sid', mprices: 'amid'
    };
    let page = 0;
    const size = 1000;
    while (all.length < max) {
      const { data, error } = await supabase
        .from(table).select('*').order(pkMap[table] || 'id').range(page * size, (page + 1) * size - 1);
      if (error) { console.warn(`⚠️ ${table}:`, error.message); break; }
      if (!data || data.length === 0) break;
      all = all.concat(data);
      if (data.length < size) break;
      page++;
    }
    return all;
  } catch (e) {
    console.warn(`⚠️ ${table}:`, e);
    return [];
  }
}

// ── INIT ──────────────────────────────────────────────────────────────────────
export async function initDatabase() {
  if (state.initialized) return;
  console.log('Initializing WealthCore...');
  const [portfolios, igm, accPflink, acmac1, sam, assetMaster,
         bs1, sumTable, vouchersC1, vouchers1, transC1, trans1, mprices] = await Promise.all([
    safeFetch('portfolios'), safeFetch('investor_group_members'),
    safeFetch('acc_pflink'), safeFetch('acmac1'), safeFetch('sam'),
    safeFetch('asset_master'), safeFetch('bs1'), safeFetch('sum_table'),
    safeFetch('vouchersc1'), safeFetch('vouchers1'), safeFetch('transc1'), safeFetch('trans1'), safeFetch('mprices'),
  ]);
  state.portfolios = portfolios;
  state.investorGroupMembers = igm;
  state.accPflink = accPflink;
  
  // CRITICAL FIX: The acmac1 table has exactly 5x duplicate rows in Supabase.
  // We MUST deduplicate them by the unique tuple of (id, acid) to prevent 5x multiplication
  // in all balance sheet rendering and calculations.
  const uniqueAcmac1: any[] = [];
  const seenAcmac = new Set();
  for (const a of acmac1) {
    const key = `${a.id}_${a.acid}_${a.is_group}`;
    if (!seenAcmac.has(key)) {
      seenAcmac.add(key);
      uniqueAcmac1.push(a);
    }
  }
  state.acmac1 = uniqueAcmac1;
  
  state.sam = sam;
  state.assetMaster = assetMaster;
  state.bs1 = bs1;
  state.sumTable = sumTable;
  state.vouchersC1 = vouchersC1;
  state.vouchers1 = vouchers1;
  state.transC1 = transC1;
  state.trans1 = trans1;
  state.mprices = mprices;
  mprices.forEach((p: any) => {
    state.priceMap[p.amid] = { curr: Number(p.currp) || 0, prev: Number(p.prevp) || 0 };
  });
  sam.forEach((s: any) => { state.assetNameMap[s.amid] = s.anm; });
  assetMaster.forEach((a: any) => { state.assetNameMap[a.amid] = a.name; });
  acmac1.forEach((a: any) => { if (!state.assetNameMap[a.id]) state.assetNameMap[a.id] = a.name; });
  state.initialized = true;
  console.log(`✅ WealthCore Ready — ${portfolios.length} portfolios, ${acmac1.length} COA entries, ${transC1.length} journal entries, ${bs1.length} portfolio txns`);
}

// ── HELPERS ───────────────────────────────────────────────────────────────────
export function getAssetName(amid: number): string {
  return state.assetNameMap[amid] || `Asset ${amid}`;
}
export function getAssetPrice(amid: number) {
  return state.priceMap[amid] || { curr: 0, prev: 0 };
}
function getGroupType(st: number): string {
  if ([150, 40, 50, 125].includes(st)) return 'ASSET';
  if ([250, 275, 276].includes(st)) return 'LIABILITY';
  if (st === 280) return 'INCOME';
  if (st === 290) return 'EXPENSE';
  return 'ASSET';
}
export function getAvailableFYs() {
  const today = new Date();
  const sy = today.getMonth() >= 3 ? today.getFullYear() : today.getFullYear() - 1;
  const fys = [];
  for (let y = 2014; y <= sy; y++) {
    fys.push({ label: `${y}-${y+1}`, start: `${y}-04-01`, end: `${y+1}-03-31` });
  }
  return fys.reverse();
}

// ── PORTFOLIOS ────────────────────────────────────────────────────────────────
export function getStoredPortfolios() {
  return state.portfolios
    .filter(p => !p.is_group && p.pfolio_type !== 10 && p.pfolio_type !== 5)
    .map(p => {
      // Look up the linked account via accPflink join table
      const link = state.accPflink.find((l: any) => l.pfid === p.id);
      const accountId = link ? String(link.acid) : null;
      return {
        ...p,
        id: String(p.id),
        portfolioName: p.investor_name || p.full_name || `Portfolio ${p.id}`,
        accountId,
        portfolioType: p.pfolio_type === 1 ? 'Equity'
          : p.pfolio_type === 2 ? 'Mutual Funds'
          : p.pfolio_type === 3 ? 'Fixed Income'
          : p.pfolio_type === 4 ? 'Real Estate'
          : null
      };
    });
}

export function getStoredInvestorGroups() {
  return state.portfolios.filter(p => p.is_group).map(p => ({
    id: String(p.id),
    name: p.investor_name,
    groupName: p.investor_name,
    fullName: p.full_name || p.investor_name,
    portfolioIds: state.investorGroupMembers
      .filter((m: any) => m.investor_group_id === p.id)
      .map((m: any) => String(m.pfolio_id))
  }));
}

export function getStoredAccounts() {
  return state.portfolios.filter(p => p.pfolio_type === 10).map(p => ({
    id: String(p.id),
    name: p.investor_name,
    accountName: p.investor_name,
    fullName: p.full_name || p.investor_name,
    pan: p.pan || '',
    familyId: 'pramesh_shah_family',
    linkedPortfolios: state.accPflink
      .filter((l: any) => l.acid === p.id)
      .map((l: any) => String(l.pfid))
  }));
}

export function getStoredFamilies() {
  return [{
    id: 'pramesh_shah_family',
    name: 'Pramesh R Shah Family',
    familyName: 'Pramesh R Shah Family',
    category: 'Family Workspace'
  }];
}

export function getPortfoliosForAccount(acid: number): number[] {
  return state.accPflink.filter((l: any) => l.acid === acid).map((l: any) => l.pfid);
}

export function getAccountForPortfolio(pfid: number): number | null {
  const link = state.accPflink.find((l: any) => l.pfid === pfid);
  return link ? link.acid : null;
}

// ── COA ───────────────────────────────────────────────────────────────────────
// IMPORTANT: acmac1.id is NOT globally unique — ids like 64 (Capital Account),
// 50 (Investments) etc. are SHARED across all 7 persons (acids). You MUST always
// pass the acid when fetching groups/ledgers for a specific person.
export function getStoredGroups(acid?: string | number): Group[] {
  const acidNum = acid ? Number(acid) : null;
  return state.acmac1
    .filter((a: any) => a.is_group && (!acidNum || a.acid === acidNum))
    .map((a: any) => ({
      id: String(a.id),
      name: a.name,
      parent: a.parent_id ? String(a.parent_id) : undefined,
      type: getGroupType(a.special_type_id || 150),
      acid: a.acid,
      specialTypeId: a.special_type_id
    }));
}

export function getStoredLedgers(acid?: string | number): Ledger[] {
  const acidNum = acid ? Number(acid) : null;
  return state.acmac1
    .filter((a: any) => !a.is_group && (!acidNum || a.acid === acidNum))
    .map((a: any) => ({
      id: String(a.id),
      name: a.name,
      groupId: String(a.parent_id),
      openingBalance: 0,
      openingType: 'DR' as const,
      currentBalance: 0,
      currentType: 'DR' as const,
      amid: a.id >= 100000 ? a.id : undefined,
      acid: a.acid
    }));
}

export function getStoredVouchers(): Voucher[] {
  const allVouchers = [...state.vouchersC1, ...state.vouchers1];
  return allVouchers.map((v: any) => ({
    id: String(v.vid),
    date: v.dt || '',
    type: String(v.vtyp || 'journal'),
    narration: v.narr || '',
    voucherNo: `V-${v.vid}`,
    portfolioId: v.pfid ? String(v.pfid) : undefined,
    accountId: v.acid ? String(v.acid) : undefined,
  }));
}

export function getStoredEntries(): Entry[] {
  const allTrans = [...state.transC1, ...state.trans1];
  return allTrans.map((e: any) => ({
    id: String(e.transid),
    voucherId: String(e.vid),
    ledgerId: String(e.maid),
    debit: Number(e.dramt) || 0,
    credit: Number(e.cramt) || 0,
    quantity: 0,
    price: 0,
    date: e.dt || '',
    accountId: e.acid ? String(e.acid) : undefined,
  }));
}

export function getStoredTaxLots() { return []; }
export function getStoredPrices() { return state.priceMap; }

// ── HOLDINGS ──────────────────────────────────────────────────────────────────
export interface AssetHolding {
  assetId: number; assetName: string; amid: number;
  assetType: number; assetTypeName: string; assetIcon: string;
  nseSymbol?: string; quantity: number; avgPrice: number;
  amtInvested: number; currentPrice: number; prevPrice: number;
  todaysGain: number; todaysGainPct: number;
  overallGain: number; overallGainPct: number; currentValue: number;
  portfolioSplits: Array<{
    portfolioId: number; portfolioName: string;
    quantity: number; amtInvested: number; currentValue: number;
  }>;
}

export function getHoldings(portfolioIds: number[], assetTypeFilter?: number | number[]): AssetHolding[] {
  const pSet = new Set(portfolioIds);
  let rows = state.sumTable.filter((s: any) => pSet.has(s.pfolio_id) && Number(s.qnt) > 0.0001);
  if (assetTypeFilter !== undefined) {
    const types = Array.isArray(assetTypeFilter) ? assetTypeFilter : [assetTypeFilter];
    rows = rows.filter((s: any) => types.includes(s.atty));
  }
  const map: Record<number, AssetHolding> = {};
  rows.forEach((s: any) => {
    const amid = s.amid;
    const price = state.priceMap[amid] || { curr: 0, prev: 0 };
    const am = state.assetMaster.find((a: any) => a.amid === amid);
    if (!map[amid]) {
      map[amid] = {
        assetId: amid, assetName: state.assetNameMap[amid] || `Asset ${amid}`,
        amid, assetType: s.atty || 0,
        assetTypeName: ASSET_TYPE_MAP[s.atty] || 'Other',
        assetIcon: ASSET_TYPE_ICON[s.atty] || 'OTH',
        nseSymbol: am?.nse_symbol,
        quantity: 0, avgPrice: 0, amtInvested: 0,
        currentPrice: price.curr, prevPrice: price.prev,
        todaysGain: 0, todaysGainPct: 0,
        overallGain: 0, overallGainPct: 0, currentValue: 0,
        portfolioSplits: []
      };
    }
    const h = map[amid];
    const qty = Number(s.qnt) || 0;
    const inv = Number(s.amtinv) || 0;
    h.quantity += qty;
    h.amtInvested += inv;
    const port = state.portfolios.find((p: any) => p.id === s.pfolio_id);
    const ex = h.portfolioSplits.find(sp => sp.portfolioId === s.pfolio_id);
    if (ex) { ex.quantity += qty; ex.amtInvested += inv; ex.currentValue = ex.quantity * price.curr; }
    else h.portfolioSplits.push({
      portfolioId: s.pfolio_id,
      portfolioName: port?.investor_name || `Portfolio ${s.pfolio_id}`,
      quantity: qty, amtInvested: inv, currentValue: qty * price.curr
    });
  });
  return Object.values(map).map(h => {
    h.avgPrice = h.quantity > 0 ? h.amtInvested / h.quantity : 0;
    h.currentValue = h.quantity * h.currentPrice;
    h.overallGain = h.currentValue > 0 ? h.currentValue - h.amtInvested : 0;
    h.overallGainPct = h.amtInvested > 0 && h.currentValue > 0 ? (h.overallGain / h.amtInvested) * 100 : 0;
    h.todaysGain = h.prevPrice > 0 ? h.quantity * (h.currentPrice - h.prevPrice) : 0;
    h.todaysGainPct = h.prevPrice > 0 ? ((h.currentPrice - h.prevPrice) / h.prevPrice) * 100 : 0;
    return h;
  }).sort((a, b) => b.amtInvested - a.amtInvested);
}

export interface PortfolioSummary {
  totalInvested: number; currentValue: number;
  overallGain: number; overallGainPct: number;
  todaysGain: number; todaysGainPct: number;
  assetTypeBreakdown: Array<{ type: number; name: string; invested: number; currentValue: number }>;
}

export function getPortfolioSummary(portfolioIds: number[]): PortfolioSummary {
  const h = getHoldings(portfolioIds);
  const totalInvested = h.reduce((s, x) => s + x.amtInvested, 0);
  const currentValue = h.reduce((s, x) => s + x.currentValue, 0);
  const overallGain = currentValue - totalInvested;
  const todaysGain = h.reduce((s, x) => s + x.todaysGain, 0);
  const typeMap: Record<number, { invested: number; currentValue: number }> = {};
  h.forEach(x => {
    if (!typeMap[x.assetType]) typeMap[x.assetType] = { invested: 0, currentValue: 0 };
    typeMap[x.assetType].invested += x.amtInvested;
    typeMap[x.assetType].currentValue += x.currentValue;
  });
  return {
    totalInvested,
    currentValue: currentValue > 0 ? currentValue : totalInvested,
    overallGain: currentValue > 0 ? overallGain : 0,
    overallGainPct: totalInvested > 0 && currentValue > 0 ? (overallGain / totalInvested) * 100 : 0,
    todaysGain,
    todaysGainPct: totalInvested > 0 ? (todaysGain / totalInvested) * 100 : 0,
    assetTypeBreakdown: Object.entries(typeMap).map(([type, v]) => ({
      type: Number(type), name: ASSET_TYPE_MAP[Number(type)] || 'Other',
      invested: v.invested, currentValue: v.currentValue
    })).sort((a, b) => b.invested - a.invested)
  };
}

// ── TRANSACTIONS ──────────────────────────────────────────────────────────────
export function getAssetTransactions(portfolioIds: number[], amid: number) {
  const pSet = new Set(portfolioIds);
  let runningQty = 0;
  return state.bs1
    .filter((t: any) => pSet.has(t.pfid) && t.amid === amid)
    .sort((a: any, b: any) => (a.dt || '').localeCompare(b.dt || ''))
    .map((t: any) => {
      const port = state.portfolios.find((p: any) => p.id === t.pfid);
      const qty = Number(t.qn) || 0;
      const isBuy = [19,20,12,25,30,35,40].includes(t.trty);
      if (isBuy) runningQty += qty; else runningQty -= qty;
      return {
        id: t.trid,
        date: t.dt,
        type: t.trstr,
        trty: t.trty,
        voucherId: String(t.trid),
        portfolioName: port?.investor_name || `Portfolio ${t.pfid}`,
        portfolioId: t.pfid,
        quantity: qty,
        price: Number(t.purpr) || 0,
        amount: Number(t.amt) || 0,
        brokerage: Number(t.brkg) || 0,
        charges: Number(t.chrgs) || 0,
        netPrice: Number(t.netpr) || 0,
        debit: isBuy ? Number(t.amt) || 0 : 0,
        credit: !isBuy ? Number(t.amt) || 0 : 0,
        balanceQty: runningQty,
        narration: t.narr || ''
      };
    });
}

export function getPortfolioActivity(portfolioIds: number[], limit = 50) {
  const pSet = new Set(portfolioIds);
  return state.bs1
    .filter((t: any) => pSet.has(t.pfid))
    .sort((a: any, b: any) => (b.dt || '').localeCompare(a.dt || ''))
    .slice(0, limit)
    .map((t: any) => {
      const port = state.portfolios.find((p: any) => p.id === t.pfid);
      return {
        id: t.trid,
        date: t.dt,
        assetName: getAssetName(t.amid),
        assetType: t.atyid,
        portfolioName: port?.investor_name || `Portfolio ${t.pfid}`,
        portfolioId: t.pfid,
        type: t.trstr,
        trty: t.trty,
        voucherNo: `BS-${t.trid}`,
        quantity: Number(t.qn) || 0,
        price: Number(t.purpr) || 0,
        amount: Number(t.amt) || 0,
        narration: t.narr || ''
      };
    });
}

// ── LEDGER / ACCOUNTING ───────────────────────────────────────────────────────
export function getLedgerWithBalance(
  ledgerId: string | number, startDate?: string,
  endDate?: string, acid?: string | number
) {
  const lid = Number(ledgerId);
  const acidNum = acid ? Number(acid) : null;

  // FIX: Filter transc1 directly by acid (transc1 has its own acid column)
  // This avoids cross-person contamination and is faster than going through vouchersc1
  let entries = state.transC1.filter((e: any) =>
    e.maid === lid && (!acidNum || e.acid === acidNum)
  );

  // Also include entries from state.trans1 (the other transaction table) for same maid+acid
  const trans1Entries = (state as any).trans1
    ? (state as any).trans1.filter((e: any) =>
        e.maid === lid && (!acidNum || e.acid === acidNum)
      )
    : [];
  // Merge and deduplicate by transid
  const transIdSet = new Set(entries.map((e: any) => e.transid));
  for (const e of trans1Entries) {
    if (!transIdSet.has(e.transid)) entries.push(e);
  }

  entries = entries.sort((a: any, b: any) => (a.dt || '').localeCompare(b.dt || ''));

  let openingBalance = 0, runningBalance = 0;
  const transactions: any[] = [];
  entries.forEach((e: any) => {
    const dr = Number(e.dramt) || 0;
    const cr = Number(e.cramt) || 0;
    const before = startDate ? e.dt < startDate : false;
    const inRange = (!startDate || e.dt >= startDate) && (!endDate || e.dt <= endDate);
    if (before) { runningBalance += dr - cr; openingBalance = runningBalance; }
    else if (inRange) {
      runningBalance += dr - cr;
      const v = state.vouchersC1.find((v: any) => v.vid === e.vid);
      transactions.push({
        date: e.dt || v?.dt, voucherId: e.vid,
        voucherType: v?.vtyp, narration: v?.narr || '',
        debit: dr, credit: cr, balance: runningBalance
      });
    }
  });
  return { transactions, openingBalance, closingBalance: runningBalance };
}

export function getLedgerBalance(ledgerId: string | number, acid?: string | number): number {
  return getLedgerWithBalance(ledgerId, undefined, undefined, acid).closingBalance;
}

export function calculateGroupTotal(groupId: string | number, acid?: string | number): number {
  const gid = Number(groupId);
  const acidNum = acid ? Number(acid) : undefined;
  let total = 0;
  // FIX: Filter acmac1 by BOTH parent_id AND acid to avoid cross-person contamination.
  // acmac1.id values (e.g. id=50 "Investments") are shared across ALL persons (acids),
  // so without the acid filter we'd sum every person's investments into one person's total.
  state.acmac1
    .filter((a: any) => !a.is_group && a.parent_id === gid && (!acidNum || a.acid === acidNum))
    .forEach((l: any) => { total += getLedgerBalance(l.id, acidNum); });
  state.acmac1
    .filter((a: any) => a.is_group && a.parent_id === gid && (!acidNum || a.acid === acidNum))
    .forEach((g: any) => { total += calculateGroupTotal(g.id, acidNum); });
  return total;
}

export function generateBS(acid?: string | number) {
  const acidNum = acid ? Number(acid) : null;
  // FIX: Get root groups for this specific acid (parent_id=0).
  // Each person (acid) has their own root groups with the SAME IDs (id=1 Liabilities, id=2 Assets).
  // We must filter by acid first to avoid mixing persons.
  const roots = state.acmac1.filter((a: any) =>
    a.is_group && a.parent_id === 0 && (!acidNum || a.acid === acidNum)
  );
  // Deduplicate roots by id (in case of multiple rows with same id for same acid)
  const uniqueRoots = roots.reduce((acc: any[], g: any) => {
    if (!acc.some(r => r.id === g.id && r.acid === g.acid)) acc.push(g);
    return acc;
  }, []);
  let assets = 0, liabilities = 0, income = 0, expense = 0;
  uniqueRoots.forEach((g: any) => {
    const total = calculateGroupTotal(g.id, acidNum || undefined);
    const t = getGroupType(g.special_type_id || 150);
    if (t === 'ASSET') assets += total;
    else if (t === 'LIABILITY') liabilities += total;
    else if (t === 'INCOME') income += total;
    else if (t === 'EXPENSE') expense += total;
  });
  return {
    assets, liabilities, profit: income - expense,
    assetGroups: uniqueRoots
      .filter((g: any) => getGroupType(g.special_type_id || 150) === 'ASSET')
      .map((g: any) => ({ id: String(g.id), name: g.name, total: calculateGroupTotal(g.id, acidNum || undefined) })),
    liabilityGroups: uniqueRoots
      .filter((g: any) => getGroupType(g.special_type_id || 150) === 'LIABILITY')
      .map((g: any) => ({ id: String(g.id), name: g.name, total: calculateGroupTotal(g.id, acidNum || undefined) }))
  };
}

export function getTrialBalance(asOfDate?: string, acid?: string | number) {
  const acidNum = acid ? Number(acid) : null;
  // Filter ledgers by acid
  const ledgers = state.acmac1.filter((a: any) =>
    !a.is_group && (!acidNum || a.acid === acidNum)
  );
  return ledgers.map((l: any) => {
    const bal = getLedgerBalance(l.id, acidNum || undefined);
    if (Math.abs(bal) < 0.001) return null;
    // Find parent group name from acmac1 (must also filter by acid for group)
    const grp = state.acmac1.find((g: any) =>
      g.is_group && g.id === l.parent_id && (!acidNum || g.acid === acidNum)
    );
    const grpType = grp ? getGroupType(grp.special_type_id || 150) : 'ASSET';
    return {
      ledgerId: String(l.id),
      ledgerName: l.name,
      groupId: String(l.parent_id),
      groupName: grp?.name || '',
      type: grpType,
      debit: bal > 0 ? bal : 0,
      credit: bal < 0 ? Math.abs(bal) : 0,
      balance: bal
    };
  }).filter(Boolean);
}

// ── CAPITAL GAINS ─────────────────────────────────────────────────────────────
export function getCapitalGains(portfolioIds: number[], fromDate: string, toDate: string) {
  const pSet = new Set(portfolioIds);
  const buyTrty = new Set([19,20,12,25,30,35,40]);
  const sellTrty = new Set([99,101]);
  const allTx = state.bs1
    .filter((t: any) => pSet.has(t.pfid))
    .sort((a: any, b: any) => (a.dt || '').localeCompare(b.dt || ''));
  const sells = allTx.filter((t: any) => sellTrty.has(t.trty) && t.dt >= fromDate && t.dt <= toDate);
  const lotsMap: Record<string, any[]> = {};
  allTx.filter((t: any) => buyTrty.has(t.trty)).forEach((t: any) => {
    const key = `${t.pfid}_${t.amid}`;
    if (!lotsMap[key]) lotsMap[key] = [];
    const qty = Number(t.qn) || 0;
    lotsMap[key].push({ date: t.dt, qty, remaining: qty, costPerUnit: qty > 0 ? (Number(t.amt)||0)/qty : 0 });
  });
  const results: any[] = [];
  sells.forEach((sell: any) => {
    const key = `${sell.pfid}_${sell.amid}`;
    const lots = lotsMap[key] || [];
    let sellQty = Number(sell.qn) || 0;
    const sellAmt = Number(sell.amt) || 0;
    const sellPrice = sellQty > 0 ? sellAmt / sellQty : 0;
    const port = state.portfolios.find((p: any) => p.id === sell.pfid);
    lots.forEach(lot => {
      if (sellQty <= 0 || lot.remaining <= 0) return;
      const mq = Math.min(sellQty, lot.remaining);
      lot.remaining -= mq; sellQty -= mq;
      const cost = mq * lot.costPerUnit;
      const proceeds = mq * sellPrice;
      const gain = proceeds - cost;
      const days = lot.date && sell.dt
        ? Math.floor((new Date(sell.dt).getTime() - new Date(lot.date).getTime()) / 86400000) : 0;
      const isEq = [50,60,66].includes(sell.atyid);
      const ltDays = isEq ? 365 : 1095;
      const isLT = days >= ltDays;
      results.push({
        portfolioId: sell.pfid, portfolioName: port?.investor_name || `Portfolio ${sell.pfid}`,
        assetName: getAssetName(sell.amid), amid: sell.amid,
        assetType: sell.atyid, assetTypeName: ASSET_TYPE_MAP[sell.atyid] || 'Other',
        buyDate: lot.date, sellDate: sell.dt, holdingDays: days,
        quantity: mq, buyPrice: lot.costPerUnit, sellPrice,
        costBasis: cost, saleProceeds: proceeds, gainLoss: gain,
        gainType: isLT ? 'LTCG' : 'STCG', taxRate: isLT ? 12.5 : 20,
        estimatedTax: gain > 0 ? gain * (isLT ? 0.125 : 0.20) : 0
      });
    });
  });
  return results;
}

// ── VOUCHER HELPERS ───────────────────────────────────────────────────────────
export function getNextVoucherNo(type: string, fy: string): string {
  const prefix = ({receipt:'RCPT',payment:'PAY',journal:'JRN',contra:'CON'} as any)[type.toLowerCase()] || 'VCH';
  const count = state.vouchersC1.filter((v: any) => String(v.vtyp) === type).length + 1;
  return `${prefix}-${count.toString().padStart(4,'0')}`;
}

export function getVoucherById(id: any) {
  const v = state.vouchersC1.find((v: any) => v.vid === Number(id));
  if (!v) return null;
  return { ...v, id: String(v.vid), lines: state.transC1.filter((e: any) => e.vid === v.vid) };
}

// ── STUBS ─────────────────────────────────────────────────────────────────────
export async function createVoucher(data: any) { console.log('createVoucher stub'); }
export async function updateVoucher(data: any) { console.log('updateVoucher stub'); }
export async function deleteVoucher(id: any) { console.log('deleteVoucher stub'); }
export async function saveLedger(ledger: any) { console.log('saveLedger stub'); }
export async function deleteLedger(id: any) { console.log('deleteLedger stub'); }
export async function saveMasterRecord(type: any, record: any) { console.log('saveMasterRecord stub'); }
export async function deleteMasterRecord(type: any, id: any) { console.log('deleteMasterRecord stub'); }
export async function handleYearClose(fy: string, onSuccess?: () => void) { console.log('handleYearClose stub'); }
export async function syncLivePrices() { console.log('syncLivePrices stub'); }
export async function ensureLedgerExists(name: string, groupId: string): Promise<Ledger | null> { return null; }
export async function updateAssetPrice(assetId: string, price: number) { console.log('updateAssetPrice stub'); }