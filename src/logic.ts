// WealthCore — Complete Logic Layer v2
// Reads from real MProfit Supabase tables
// All TypeScript errors fixed

import { supabase } from "./supabase";
import { getLivePrice, clearPriceCache } from "./services/assetMasterService";

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
  50: 'Stocks',
  60: 'Mutual Funds (Equity)',
  61: 'Mutual Funds (Debt)',
  62: 'Mutual Funds (Other)',
  70: 'NPS / ULiP',
  80: 'Insurance',
  90: 'Fixed Deposits',
  100: 'Traded Bonds',
  110: 'NCD / Debentures',
  120: 'Deposits / Loans',
  130: 'PPF / EPF',
  140: 'Post Office',
  150: 'Gold',
  151: 'Silver',
  160: 'Properties',
  170: 'Jewellery',
  180: 'Art',
  190: 'Private Equity',
  200: 'Special Inv. Funds',
  210: 'AIF',
  220: 'Loans',
  230: 'PMS / AIF',
  240: 'Stock in Trade'
};

export const ASSET_TYPE_ICON: Record<number, string> = {
  50: 'EQ',
  60: 'MF',
  61: 'MF',
  62: 'MF',
  70: 'NPS',
  80: 'INS',
  90: 'FD',
  100: 'BND',
  110: 'NCD',
  120: 'DEP',
  130: 'PPF',
  140: 'PO',
  150: 'GLD',
  151: 'SLV',
  160: 'PR',
  170: 'JWL',
  180: 'ART',
  190: 'PE',
  200: 'SIF',
  210: 'AIF',
  220: 'LN',
  230: 'PMS',
  240: 'STK'
};

// ── STATE ─────────────────────────────────────────────────────────────────────
// ── STATE ─────────────────────────────────────────────────────────────────────
export const state = {
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
  scnote1: [] as any[],
  priceMap: {} as Record<number, { curr: number; prev: number }>,
  assetNameMap: {} as Record<number, string>,
  initialized: false
};

// ── INDEX MAPS FOR O(1) LOOKUPS ────────────────────────────────────────────────
const vouchersC1Map = new Map<number, any>();
const vouchers1Map = new Map<number, any>();
const transC1ByMaid = new Map<number, any[]>();
const trans1ByMaid = new Map<number, any[]>();
const transC1ByVid = new Map<number, any[]>();
const trans1ByVid = new Map<number, any[]>();
const acmac1Map = new Map<number, any[]>();

export function rebuildAllIndexes() {
  vouchersC1Map.clear();
  state.vouchersC1.forEach(v => vouchersC1Map.set(v.vid, v));

  vouchers1Map.clear();
  state.vouchers1.forEach(v => vouchers1Map.set(v.vid, v));

  transC1ByMaid.clear();
  transC1ByVid.clear();
  state.transC1.forEach(e => {
    const maid = Number(e.maid);
    const vid = Number(e.vid);
    
    let maidList = transC1ByMaid.get(maid);
    if (!maidList) {
      maidList = [];
      transC1ByMaid.set(maid, maidList);
    }
    maidList.push(e);

    let vidList = transC1ByVid.get(vid);
    if (!vidList) {
      vidList = [];
      transC1ByVid.set(vid, vidList);
    }
    vidList.push(e);
  });

  trans1ByMaid.clear();
  trans1ByVid.clear();
  state.trans1.forEach(e => {
    const maid = Number(e.maid);
    const vid = Number(e.vid);

    let maidList = trans1ByMaid.get(maid);
    if (!maidList) {
      maidList = [];
      trans1ByMaid.set(maid, maidList);
    }
    maidList.push(e);

    let vidList = trans1ByVid.get(vid);
    if (!vidList) {
      vidList = [];
      trans1ByVid.set(vid, vidList);
    }
    vidList.push(e);
  });

  acmac1Map.clear();
  state.acmac1.forEach(a => {
    const id = Number(a.id);
    let list = acmac1Map.get(id);
    if (!list) {
      list = [];
      acmac1Map.set(id, list);
    }
    list.push(a);
  });
}

// ── SAFE FETCH ────────────────────────────────────────────────────────────────
async function safeFetch(table: string, max = 50000): Promise<any[]> {
  try {
    let all: any[] = [];
    const pkMap: Record<string, string> = {
      bs1: 'trid',
      transc1: 'transid', trans1: 'transid',
      vouchersc1: 'vid', vouchers1: 'vid',
      portfolios: 'id', investor_group_members: 'investor_group_id', acc_pflink: 'pfid',
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
  const [portfolios, igm, accPflink, acmac1,
         bs1, sumTable, vouchersC1, vouchers1, transC1, trans1, mprices] = await Promise.all([
    safeFetch('portfolios'), safeFetch('investor_group_members'),
    safeFetch('acc_pflink'), safeFetch('acmac1'),
    safeFetch('bs1'), safeFetch('sum_table'),
    safeFetch('vouchersc1'), safeFetch('vouchers1'), safeFetch('transc1'), safeFetch('trans1'), safeFetch('mprices'),
  ]);

  // Dynamically fetch only the necessary SAM records to prevent loading 80,000+ rows into memory
  const maids = new Set<number>();
  sumTable.forEach((s: any) => { if (s.amid) maids.add(s.amid); });
  transC1.forEach((t: any) => { if (t.maid) maids.add(t.maid); });
  const maidArr = Array.from(maids);

  let sam: any[] = [];
  let assetMaster: any[] = [];
  // Split into chunks of 100 in case the array is large
  for (let i = 0; i < maidArr.length; i += 100) {
    const chunk = maidArr.slice(i, i + 100);
    const { data: samData } = await supabase.from('sam').select('*').in('amid', chunk);
    if (samData) sam = sam.concat(samData);
    const { data: amData } = await supabase.from('asset_master').select('*').in('amid', chunk);
    if (amData) assetMaster = assetMaster.concat(amData);
  }
  state.portfolios = portfolios;
  state.investorGroupMembers = igm;
  state.accPflink = accPflink;
  
  // CRITICAL FIX: The acmac1 table has exactly 5x duplicate rows in Supabase.
  // We MUST deduplicate them by the unique tuple of (id, acid) to prevent 5x multiplication
  // in all balance sheet rendering and calculations.
  const uniqueAcmac1: any[] = [];
  const seenAcmac = new Set();
  for (const a of acmac1) {
    if (a.name === 'Difference in Opening Balances') continue; // User requested to completely remove this single-sided ledger
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
  // Tag each record with its source prefix so composite IDs are stable:
  //   vouchersc1 → _src='c', vouchers1 → _src='t'
  //   transc1    → _src='c', trans1    → _src='t'
  state.vouchersC1 = vouchersC1.map((v: any) => ({ ...v, _src: 'c' }));
  state.vouchers1  = vouchers1.map((v: any)  => ({ ...v, _src: 't' }));
  state.transC1    = transC1.map((e: any)    => ({ ...e, _src: 'c' }));
  state.trans1     = trans1.map((e: any)     => ({ ...e, _src: 't' }));
  state.mprices = mprices;
  // Sort mprices by row_id ascending so that newer price rows overwrite older ones
  const sortedMprices = [...mprices].sort((a, b) => (Number(a.row_id) || 0) - (Number(b.row_id) || 0));
  sortedMprices.forEach((p: any) => {
    state.priceMap[p.amid] = { curr: Number(p.currp) || 0, prev: Number(p.prevp) || 0 };
  });
  sam.forEach((s: any) => { state.assetNameMap[s.amid] = s.anm; });
  assetMaster.forEach((a: any) => { state.assetNameMap[a.amid] = a.name; });
  acmac1.forEach((a: any) => { if (!state.assetNameMap[a.id]) state.assetNameMap[a.id] = a.name; });
  
  rebuildAllIndexes();
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
    familyId: '1',
    linkedPortfolios: state.accPflink
      .filter((l: any) => l.acid === p.id)
      .map((l: any) => String(l.pfid))
  }));
}

export function getStoredFamilies() {
  return [{
    id: '1',
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
  const parsed = acid && acid !== 'undefined' ? Number(acid) : null;
  const acidNum = parsed && !isNaN(parsed) ? parsed : null;

  if (acid !== undefined && acid !== null && acid !== 'undefined' && !acidNum) {
    return [];
  }

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
  // NOTE: vouchersc1 and vouchers1 contain DIFFERENT vouchers from different accounts.
  // Their vid values are sequential within each table independently and can coincide.
  // Do NOT deduplicate by vid across tables — concatenate both fully.
  return [...state.vouchersC1, ...state.vouchers1].map((v: any) => ({
    id: `${v._src || 'v'}_${v.vid}`,
    date: v.dt || '',
    type: String(v.vtyp || 'journal'),
    narration: v.narr || '',
    voucherNo: `V-${v.vid}`,
    portfolioId: v.pfid ? String(v.pfid) : undefined,
    accountId: v.acid ? String(v.acid) : undefined,
  }));
}

export function getStoredEntries(): Entry[] {
  // NOTE: transc1 and trans1 contain DIFFERENT entries from different accounts.
  // Their transid values are sequential within each table independently and can coincide.
  // Do NOT deduplicate by transid across tables — concatenate both fully.
  // We assign a unique composite id: 'c_<transid>' for transc1 and 't_<transid>' for trans1.
  const c1 = (state.transC1 || []).map((e: any) => ({
    id: `c_${e.transid}`,
    voucherId: `c_${e.vid}`,
    ledgerId: String(e.maid),
    debit: Number(e.dramt) || 0,
    credit: Number(e.cramt) || 0,
    quantity: 0,
    price: 0,
    date: e.dt || '',
    accountId: e.acid ? String(e.acid) : undefined,
  }));
  const t1 = (state.trans1 || []).map((e: any) => ({
    id: `t_${e.transid}`,
    voucherId: `t_${e.vid}`,
    ledgerId: String(e.maid),
    debit: Number(e.dramt) || 0,
    credit: Number(e.cramt) || 0,
    quantity: 0,
    price: 0,
    date: e.dt || '',
    accountId: e.acid ? String(e.acid) : undefined,
  }));
  return [...c1, ...t1];
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
    folio?: string;
  }>;
}

export function getHoldings(portfolioIds: number[], assetTypeFilter?: number | number[]): AssetHolding[] {
  const pSet = new Set(portfolioIds);
  
  // 1. Filter sum_table for active holdings (qnt > 0 or currv > 0)
  // We exclude amtinv > 0 because sold assets often still retain an amtinv value in the sumTable
  const rows = state.sumTable.filter((s: any) => 
    pSet.has(s.pfolio_id) && 
    (Number(s.qnt) > 0.0001 || Number(s.currv) > 0.01)
  );

  // Map parent group IDs in acmac1 to correct UI atty codes
  const groupAttyMap: Record<number, number> = {
    200050: 50,   // Stocks
    200051: 50,   // Stock-in-Trade -> Stocks
    200061: 60,   // Mutual Funds (Equity)
    200062: 61,   // Mutual Funds (Debt)
    200058: 200,  // Special Inv. Funds
    200141: 70,   // NPS/ULIP
    200140: 80,   // Insurance
    200066: 190,  // Private Equity
    200095: 90,   // FDs
    200040: 100,  // Traded Bonds
    200070: 110,  // NCD/Debentures
    200115: 120,  // Deposits/Loans
    200120: 130,  // PPF/EPF
    200135: 140,  // Post Office
    200075: 150,  // Gold
    200077: 151,  // Silver
    200155: 170,  // Jewellery
    200150: 160,  // Properties
    200145: 180,  // Art
    200160: 210,  // AIF
    200195: 220,  // Loans
  };

  // 2. Pre-resolve asset types for all active rows
  const resolvedRows = rows.map((s: any) => {
    const amid = s.amid;
    let resolvedAtty = s.atty || 0;
    const assetName = state.assetNameMap[amid] || `Asset ${amid}`;
    const cleanAssetName = assetName.toLowerCase().replace(/[^a-z0-9]/g, '');

    const link = state.accPflink.find((l: any) => l.pfid === s.pfolio_id);
    const acid = link ? link.acid : null;

    // Match ledger by name using balance-prioritized strict startsWith matching
    let matchedLedger = null;
    let matchedLedgers = state.acmac1.filter((l: any) => {
      if (l.is_group) return false;
      if (acid && l.acid !== acid) return false;
      const cleanLedgerName = l.name.toLowerCase().replace(/[^a-z0-9]/g, '');
      return cleanLedgerName.startsWith(cleanAssetName) || cleanAssetName.startsWith(cleanLedgerName);
    });

    if (matchedLedgers.length === 0) {
      matchedLedgers = state.acmac1.filter((l: any) => {
        if (l.is_group) return false;
        const cleanLedgerName = l.name.toLowerCase().replace(/[^a-z0-9]/g, '');
        return cleanLedgerName.startsWith(cleanAssetName) || cleanAssetName.startsWith(cleanLedgerName);
      });
    }

    if (matchedLedgers.length === 1) {
      matchedLedger = matchedLedgers[0];
    } else if (matchedLedgers.length > 1) {
      matchedLedger = matchedLedgers.find((l: any) => {
        const bal = (Number(l.db_bal) || 0) - (Number(l.cr_bal) || 0);
        return Math.abs(bal) > 0.01;
      }) || matchedLedgers[0];
    }

    if (matchedLedger && matchedLedger.parent_id) {
      const parentId = Number(matchedLedger.parent_id);
      if (groupAttyMap[parentId] !== undefined) {
        resolvedAtty = groupAttyMap[parentId];
      }
    }

    return { ...s, resolvedAtty };
  });

  // 3. Now filter by assetTypeFilter if provided
  let filteredRows = resolvedRows;
  if (assetTypeFilter !== undefined) {
    const types = Array.isArray(assetTypeFilter) ? assetTypeFilter : [assetTypeFilter];
    filteredRows = resolvedRows.filter((s: any) => types.includes(s.resolvedAtty));
  }

  const map: Record<number, AssetHolding> = {};
  filteredRows.forEach((s: any) => {
    const amid = s.amid;
    const price = state.priceMap[amid] || { curr: 0, prev: 0 };
    const am = state.assetMaster.find((a: any) => a.amid === amid);

    const qty = Number(s.qnt) || 0;
    const currv = Number(s.currv) || 0;
    const tgain = Number(s.tgain) || 0;
    const fallbackCurr = qty > 0 ? currv / qty : 0;
    const fallbackPrev = qty > 0 ? fallbackCurr - (tgain / qty) : fallbackCurr;

    const currPrice = price.curr || fallbackCurr;
    const prevPrice = price.prev || fallbackPrev;

    if (!map[amid]) {
      map[amid] = {
        assetId: amid, 
        assetName: state.assetNameMap[amid] || `Asset ${amid}`,
        amid, 
        assetType: s.resolvedAtty,
        assetTypeName: ASSET_TYPE_MAP[s.resolvedAtty] || 'Other',
        assetIcon: ASSET_TYPE_ICON[s.resolvedAtty] || 'OTH',
        nseSymbol: am?.nse_symbol,
        quantity: 0, 
        avgPrice: 0, 
        amtInvested: 0,
        currentPrice: currPrice, 
        prevPrice: prevPrice,
        todaysGain: 0, 
        todaysGainPct: 0,
        overallGain: 0, 
        overallGainPct: 0, 
        currentValue: 0,
        portfolioSplits: []
      };
    }
    const h = map[amid];
    const qtyRow = Number(s.qnt) || 0;
    const inv = Number(s.amtinv) || 0;
    h.quantity += qtyRow;
    h.amtInvested += inv;
    const port = state.portfolios.find((p: any) => p.id === s.pfolio_id);
    const ex = h.portfolioSplits.find(sp => sp.portfolioId === s.pfolio_id);
    if (ex) { 
      ex.quantity += qtyRow; 
      ex.amtInvested += inv; 
      ex.currentValue = ex.quantity * currPrice; 
    }
    else {
      h.portfolioSplits.push({
        portfolioId: s.pfolio_id,
        portfolioName: port?.investor_name || `Portfolio ${s.pfolio_id}`,
        quantity: qtyRow, 
        amtInvested: inv, 
        currentValue: qtyRow * currPrice,
        folio: s.refno
      });
    }
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
export function getAssetTransactions(portfolioIds: number[], amid: number, startDate?: string, endDate?: string) {
  const pSet = new Set(portfolioIds);
  let runningQty = 0;
  let runningCost = 0;

  const allTx = state.bs1
    .filter((t: any) => pSet.has(t.pfid) && t.amid === amid)
    .sort((a: any, b: any) => (a.dt || '').localeCompare(b.dt || ''));

  let openingQty = 0;
  let openingCost = 0;

  const transactionsWithinPeriod: any[] = [];

  allTx.forEach((t: any) => {
    const qty = Number(t.qn) || 0;
    const price = Number(t.purpr) || 0;
    const amount = Number(t.amt) || 0;
    const isBuy = [19, 20, 12, 25, 30, 35, 40, 45, 46, 47].includes(t.trty);

    if (isBuy) {
      runningQty += qty;
      runningCost += amount;
    } else {
      const prevQty = runningQty;
      runningQty -= qty;
      if (prevQty > 0) {
        runningCost -= (qty / prevQty) * runningCost;
      } else {
        runningCost -= amount;
      }
    }

    const port = state.portfolios.find((p: any) => p.id === t.pfid);
    const date = t.dt || '';

    const txItem = {
      id: t.trid,
      date,
      type: t.trstr || (isBuy ? 'Buy' : 'Sell'),
      trty: t.trty,
      voucherId: String(t.trid),
      portfolioName: port?.investor_name || `Portfolio ${t.pfid}`,
      portfolioId: t.pfid,
      quantity: qty,
      price,
      amount,
      brokerage: Number(t.brkg) || 0,
      charges: Number(t.chrgs) || 0,
      netPrice: Number(t.netpr) || 0,
      debit: isBuy ? amount : 0,
      credit: !isBuy ? amount : 0,
      balanceQty: runningQty,
      narration: t.narr || ''
    };

    const beforeStart = startDate ? date < startDate : false;
    const afterEnd = endDate ? date > endDate : false;

    if (beforeStart) {
      openingQty = runningQty;
      openingCost = runningCost;
    } else if (!afterEnd) {
      transactionsWithinPeriod.push(txItem);
    }
  });

  return {
    openingQty,
    openingCost,
    closingQty: runningQty,
    closingCost: runningCost,
    transactions: transactionsWithinPeriod
  };
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

  // Collect entries from BOTH tables using our prebuilt O(1) maps
  const rawC1 = transC1ByMaid.get(lid) || [];
  const c1Entries = rawC1.filter((e: any) =>
    !acidNum || e.acid === acidNum
  ).map((e: any) => ({ ...e, _src: 'c' }));

  const raw1 = trans1ByMaid.get(lid) || [];
  const t1Entries = raw1.filter((e: any) =>
    !acidNum || e.acid === acidNum
  ).map((e: any) => ({ ...e, _src: 't' }));

  // Combine and sort by date
  let entries = [...c1Entries, ...t1Entries]
    .sort((a: any, b: any) => (a.dt || '').localeCompare(b.dt || ''));

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
      
      // O(1) Voucher lookup
      const v = e._src === 'c'
        ? vouchersC1Map.get(e.vid)
        : vouchers1Map.get(e.vid);
      
      let againstName = '';
      if (e.vid) {
        // O(1) lookup of other legs of the same voucher
        const sourceTrans = e._src === 'c'
          ? (transC1ByVid.get(e.vid) || [])
          : (trans1ByVid.get(e.vid) || []);
        
        const otherLegs = sourceTrans.filter((t: any) =>
          t.maid !== lid && (!acidNum || t.acid === acidNum)
        );
        if (otherLegs.length === 1) {
          const otherMaid = otherLegs[0].maid;
          const matchingLedgers = acmac1Map.get(otherMaid) || [];
          const otherLedger = matchingLedgers.find((a: any) => !acidNum || a.acid === acidNum);
          againstName = otherLedger ? otherLedger.name : '';
        } else if (otherLegs.length > 1) {
          againstName = 'Multiple Accounts';
        }
      }

      const vtypMap: Record<number, string> = { 2: 'payment', 4: 'receipt', 5: 'journal', 14: 'purchase', 15: 'sale' };
      transactions.push({
        date: e.dt || v?.dt, voucherId: e.vid,
        voucherType: v?.vtyp ? vtypMap[v.vtyp] || 'journal' : 'journal',
        narration: v?.narr || '',
        debit: dr, credit: cr, balance: runningBalance,
        againstLedger: againstName || '-'
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
  let v = state.vouchersC1.find((v: any) => v.vid === Number(id));
  let transSrc = state.transC1;
  if (!v) {
    v = state.vouchers1.find((v: any) => v.vid === Number(id));
    transSrc = state.trans1;
  }
  
  if (!v) {
    const tx = state.bs1.find((t: any) => t.trid === Number(id));
    if (tx) {
      const linkedVid = Number(tx.acvch);
      if (linkedVid && !isNaN(linkedVid)) {
        v = state.vouchersC1.find((v: any) => v.vid === linkedVid);
        transSrc = state.transC1;
        if (!v) {
          v = state.vouchers1.find((v: any) => v.vid === linkedVid);
          transSrc = state.trans1;
        }
      }
      
      if (!v) {
        const resolvedAcid = getAccountForPortfolio(tx.pfid) || tx.acid;
        const isBuy = [19, 20, 12, 25, 30, 35, 40, 45, 46, 47].includes(tx.trty);
        const isMf = tx.atyid === 60 || tx.atyid === 61 || tx.atyid === 62;
        const qty = Number(tx.qn) || 0;
        const price = Number(tx.purpr) || 0;
        const amount = Number(tx.amt) || 0;
        const brokerage = Number(tx.brkg) || 0;
        const charges = Number(tx.chrgs) || 0;
        const ledgers = getStoredLedgers(resolvedAcid);
        const bankLedger = ledgers.find(l => l.name.toLowerCase().includes('bank')) || ledgers[0] || { id: 'Bank', name: 'Bank' };
        const brokerLedger = ledgers.find(l => l.groupId === '75') || ledgers[0] || { id: 'Broker', name: 'Broker' };
        const counterLedgerId = isMf ? bankLedger.id : brokerLedger.id;
        
        const lines: any[] = [
          {
            id: `asset_${tx.trid}`,
            ledgerId: String(tx.amid),
            ledgerName: state.assetNameMap[tx.amid] || `Asset ${tx.amid}`,
            debit: isBuy ? amount : 0,
            credit: !isBuy ? amount : 0,
            quantity: qty,
            price: price,
            narration: tx.narr || ''
          }
        ];

        if (brokerage > 0) {
          lines.push({
            id: `brkg_${tx.trid}`,
            ledgerId: 'brokerage',
            ledgerName: 'Brokerage',
            debit: brokerage,
            credit: 0,
            quantity: 0,
            price: 0,
            narration: ''
          });
        }

        if (charges > 0) {
          lines.push({
            id: `chrgs_${tx.trid}`,
            ledgerName: 'Stamp & Other Charges',
            ledgerId: 'charges',
            // Charges are ALWAYS a debit (an expense), whether buying or selling.
            // Wait, for a SELL, charges reduce the proceeds, but they are still an expense (Debit).
            debit: charges,
            credit: 0,
            quantity: 0,
            price: 0,
            narration: ''
          });
        }

        const netAmount = isBuy ? (amount + brokerage + charges) : (amount - brokerage - charges);
        
        lines.push({
          id: `counter_${tx.trid}`,
          ledgerId: String(counterLedgerId),
          ledgerName: isMf ? bankLedger.name : brokerLedger.name,
          debit: !isBuy ? netAmount : 0,
          credit: isBuy ? netAmount : 0,
          quantity: 0,
          price: 0,
          narration: tx.narr || ''
        });

        return {
          id: String(tx.trid),
          vid: tx.trid,
          date: tx.dt || '',
          type: isMf ? 'contra' : 'journal',
          narration: tx.narr || '',
          voucherNo: `BS-${tx.trid}`,
          accountId: resolvedAcid ? String(resolvedAcid) : '',
          portfolioId: String(tx.pfid),
          lines
        };
      }
    }
  }

  if (!v) return null;
  
  const vtypMap: Record<number, string> = { 2: 'payment', 4: 'receipt', 5: 'journal', 14: 'purchase', 15: 'sale' };
  
  return { 
    ...v, 
    id: String(v.vid), 
    type: vtypMap[v.vtyp] || 'journal',
    voucherNo: v.vchno || '',
    date: v.dt || '',
    accountId: v.acid ? String(v.acid) : '',
    narration: v.narr || '',
    portfolioId: v.pfid ? String(v.pfid) : undefined,
    lines: transSrc
      .filter((e: any) => e.vid === v.vid)
      .map((e: any) => {
        const isAsset = Number(e.maid) >= 100000;
        let bsTx = null;
        if (isAsset) {
          const ledgerObj = state.acmac1.find((l: any) => l.id === Number(e.maid));
          const ledgerName = ledgerObj ? ledgerObj.name.toLowerCase().replace(/[^a-z0-9]/g, '') : '';
          const matchingTxs = state.bs1.filter((t: any) => Number(t.acvch) === v.vid);
          
          if (matchingTxs.length === 1) {
            bsTx = matchingTxs[0];
          } else if (matchingTxs.length > 1 && ledgerName) {
            bsTx = matchingTxs.find((t: any) => {
              const anm = (state.assetNameMap[t.amid] || '').toLowerCase().replace(/[^a-z0-9]/g, '');
              return ledgerName.startsWith(anm) || anm.startsWith(ledgerName);
            }) || matchingTxs[0];
          }
        }
        return {
          id: String(e.transid),
          ledgerId: String(e.maid),
          debit: Number(e.dramt) || 0,
          credit: Number(e.cramt) || 0,
          narration: e.narr || '',
          quantity: bsTx ? Number(bsTx.qn) || 0 : 0,
          price: bsTx ? Number(bsTx.purpr) || 0 : 0
        };
      })
  };
}

// ── VOUCHER WRITE OPERATIONS ───────────────────────────────────────────────────

const VTYP_MAP: Record<string, number> = {
  payment: 2, receipt: 4, journal: 5, purchase: 14, sale: 15
};

function nextVid(): number {
  const allVids = [
    ...state.vouchersC1.map((v: any) => v.vid || 0),
    ...state.vouchers1.map((v: any) => v.vid || 0),
  ];
  const maxVal = allVids.length > 0 ? Math.max(...allVids) : 0;
  console.log('nextVid: state.vouchersC1 length =', state.vouchersC1.length, 'state.vouchers1 length =', state.vouchers1.length);
  console.log('nextVid: max value =', maxVal, 'returning next =', maxVal + 1);
  return maxVal + 1;
}

function nextTransid(): number {
  const allIds = [
    ...state.transC1.map((e: any) => e.transid || 0),
    ...state.trans1.map((e: any) => e.transid || 0),
  ];
  const maxVal = allIds.length > 0 ? Math.max(...allIds) : 0;
  console.log('nextTransid: max =', maxVal, 'returning next =', maxVal + 1);
  return maxVal + 1;
}

function nextTrid(): number {
  const allIds = state.bs1.map((t: any) => Number(t.trid) || 0);
  return allIds.length > 0 ? Math.max(...allIds) + 1 : 1;
}


async function syncPortfolioStats(portfolioId: number, amid: number) {
  const { data: txs, error: txErr } = await supabase
    .from('bs1')
    .select('*')
    .eq('pfid', portfolioId)
    .eq('amid', amid);

  if (txErr) {
    console.error("Failed to fetch transactions for sync:", txErr.message);
    return;
  }

  let qty = 0;
  let amtInvested = 0;
  let assetType = 50;

  const sortedTxs = txs ? [...txs].sort((a: any, b: any) => (a.dt || '').localeCompare(b.dt || '') || (Number(a.trid) - Number(b.trid))) : [];

  sortedTxs.forEach((t: any) => {
    const q = Number(t.qn) || 0;
    const amt = Number(t.amt) || 0;
    const isBuy = [19, 20, 12, 25, 30, 35, 40, 45, 46, 47].includes(t.trty);
    assetType = t.atyid || assetType;

    if (isBuy) {
      qty += q;
      amtInvested += amt;
    } else {
      const prevQty = qty;
      qty -= q;
      if (prevQty > 0) {
        amtInvested -= (q / prevQty) * amtInvested;
      } else {
        amtInvested -= amt;
      }
    }
  });

  if (qty < 0) qty = 0;
  if (amtInvested < 0) amtInvested = 0;

  const { data: existing, error: existErr } = await supabase
    .from('sum_table')
    .select('*')
    .eq('pfolio_id', portfolioId)
    .eq('amid', amid);

  if (existErr) {
    console.error("Failed to query sum_table:", existErr.message);
    return;
  }

  const price = state.priceMap[amid]?.curr || 0;
  const currv = qty * price;

  const summaryRow: any = {
    pfolio_id: portfolioId,
    client_id: 1,
    atty: assetType,
    amid,
    qnt: qty,
    amtinv: amtInvested,
    currv,
    tgain: 0
  };

  if (existing && existing.length > 0) {
    const { error: updErr } = await supabase
      .from('sum_table')
      .update(summaryRow)
      .eq('sid', existing[0].sid);
    
    if (updErr) {
      console.error("Failed to update sum_table:", updErr.message);
    } else {
      const localIdx = state.sumTable.findIndex(s => s.sid === existing[0].sid);
      if (localIdx >= 0) state.sumTable[localIdx] = { ...state.sumTable[localIdx], ...summaryRow };
    }
  } else {
    const allIds = state.sumTable.map(s => Number(s.sid)).filter(id => !isNaN(id));
    const nextSid = allIds.length > 0 ? Math.max(...allIds) + 1 : 1001;

    summaryRow.sid = nextSid;
    const { error: insErr } = await supabase
      .from('sum_table')
      .insert(summaryRow);

    if (insErr) {
      console.error("Failed to insert into sum_table:", insErr.message);
    } else {
      state.sumTable.push({ ...summaryRow, _src: 'c' });
    }
  }
  rebuildAllIndexes();
}

export async function createVoucher(data: any, reuseVid?: number) {
  const acid = data.accountId ? Number(data.accountId) : null;
  const vid = reuseVid ?? nextVid();
  const vtyp = VTYP_MAP[data.type] ?? 5; // default journal

  // 1. Insert voucher into vouchersc1
  const voucherRow = {
    vid,
    acid,
    dt: data.date,
    narr: data.narration || '',
    vtyp,
    pfid: data.portfolioId ? Number(data.portfolioId) : null,
  };

  const { error: vErr } = await supabase.from('vouchersc1').insert(voucherRow);
  if (vErr) {
    console.error('❌ Failed to save voucher:', vErr.message);
    throw new Error(`Failed to save voucher: ${vErr.message}`);
  }

  // 2. Insert each line into transc1
  const lines = (data.lines || []).filter((l: any) => l.ledgerId && (Number(l.debit) > 0 || Number(l.credit) > 0 || data.type === 'bonus' || data.type === 'split' || data.type === 'merger' || data.type === 'demerger'));
  let currentTransid = nextTransid();
  const transRows: any[] = [];

  for (const line of lines) {
    const row = {
      transid: currentTransid++,
      vid,
      acid,
      maid: Number(line.ledgerId),
      dramt: Number(line.debit) || 0,
      cramt: Number(line.credit) || 0,
      dt: data.date,
    };
    transRows.push(row);
  }

  if (transRows.length > 0) {
    const { error: tErr } = await supabase.from('transc1').insert(transRows);
    if (tErr) {
      console.error('❌ Failed to save entries:', tErr.message);
      await supabase.from('vouchersc1').delete().eq('vid', vid);
      throw new Error(`Failed to save entries: ${tErr.message}`);
    }
  }

  // 3. Update in-memory state immediately so UI reflects new data without page reload
  state.vouchersC1.push({ ...voucherRow, _src: 'c' });
  transRows.forEach(row => state.transC1.push({ ...row, _src: 'c' }));
  rebuildAllIndexes();

  console.log(`✅ Voucher saved: vid=${vid}, ${lines.length} entries, acid=${acid}`);

  // 4. Sync to bs1 (portfolio transactions) and sum_table (holdings summary)
  if (data.portfolioId) {
    const pfid = Number(data.portfolioId);
    
    const explicitAmid = data.assetId ? Number(data.assetId) : undefined;
    const assetLine = data.lines.find((l: any) => 
      Number(l.ledgerId) >= 100000 || 
      state.acmac1.some((a: any) => String(a.id) === String(l.ledgerId) && [200050, 200051, 200061, 200062].includes(Number(a.parent_id)))
    );
    let amid = explicitAmid;
    
    if (!amid && assetLine) {
      const ledgerIdNum = Number(assetLine.ledgerId);
      const ledger = state.acmac1.find((l: any) => l.id === ledgerIdNum);
      if (ledger) {
        const cleanLedgerName = ledger.name.toLowerCase().replace(/[^a-z0-9]/g, '');
        const matchedAsset = state.assetMaster.find((a: any) => {
          const cleanAssetName = a.name.toLowerCase().replace(/[^a-z0-9]/g, '');
          return cleanAssetName === cleanLedgerName || cleanAssetName.startsWith(cleanLedgerName) || cleanLedgerName.startsWith(cleanAssetName);
        }) || state.sam.find((s: any) => {
          const cleanAssetName = s.anm.toLowerCase().replace(/[^a-z0-9]/g, '');
          return cleanAssetName === cleanLedgerName || cleanAssetName.startsWith(cleanLedgerName) || cleanLedgerName.startsWith(cleanAssetName);
        });
        
        if (matchedAsset) {
          amid = matchedAsset.amid;
        }
      }
      if (!amid) {
        amid = ledgerIdNum;
      }
    }
    
    if (amid) {
      const isBuy = assetLine ? (Number(assetLine.debit) > 0) : (data.type !== 'dividend' && data.type !== 'buyback' && data.type !== 'writeoff');
      const qty = assetLine ? (Number(assetLine.quantity) || 0) : (Number(data.quantity) || 0);
      const price = assetLine ? (Number(assetLine.price) || 0) : (Number(data.price) || 0);
      const amt = assetLine ? (Number(assetLine.debit) || Number(assetLine.credit) || 0) : (Number(data.amount) || qty * price || 0);

      const asset = state.assetMaster.find((a: any) => a.amid === amid);
      const atyid = asset ? asset.asset_type : 50;

      let trty = isBuy ? 20 : 99;
      let trstr = isBuy ? 'Buy' : 'Sell';

      if (data.type === 'dividend') {
        trty = 62;
        trstr = 'Dividend Payout';
      } else if (data.type === 'bonus') {
        trty = 40;
        trstr = 'Bonus';
      } else if (data.type === 'split') {
        trty = 45;
        trstr = '*Split';
      } else if (data.type === 'demerger') {
        trty = 46;
        trstr = '*DeMerger';
      } else if (data.type === 'merger') {
        trty = 45;
        trstr = '*Merged';
      } else if (data.type === 'writeoff') {
        trty = 99;
        trstr = 'Write Off';
      }

      const bsRow = {
        trid: nextTrid(),
        pfid,
        amid,
        atyid,
        sid: -1,
        cnid: -1,
        trty,
        trstr,
        acvch: vid,
        dt: data.date,
        qn: qty,
        purpr: price,
        brkg: 0,
        netpr: price,
        amt,
        chrgs: 0,
        narr: data.narration || ''
      };

      const { error: bsErr } = await supabase.from('bs1').insert(bsRow);
      if (bsErr) {
        console.error('❌ Failed to insert into bs1:', bsErr.message);
      } else {
        state.bs1.push({ ...bsRow, _src: 'c' });
        await syncPortfolioStats(pfid, amid);
      }
    }
  }
}

export async function updateVoucher(data: any) {
  let rawVid = null;
  if (data.id) {
    const match = String(data.id).match(/\d+/);
    if (match) {
      const candidateVid = Number(match[0]);
      const exists = state.vouchersC1.some((v: any) => v.vid === candidateVid) ||
                     state.vouchers1.some((v: any) => v.vid === candidateVid) ||
                     state.bs1.some((t: any) => t.trid === candidateVid || Number(t.acvch) === candidateVid);
      if (exists) {
        rawVid = candidateVid;
      }
    }
  }

  if (rawVid && !isNaN(rawVid)) {
    const tx = state.bs1.find((t: any) => t.trid === rawVid || Number(t.acvch) === rawVid);
    const pfid = tx?.pfid;
    const amid = tx?.amid;

    await Promise.all([
      supabase.from('transc1').delete().eq('vid', rawVid),
      supabase.from('vouchersc1').delete().eq('vid', rawVid),
      supabase.from('trans1').delete().eq('vid', rawVid),
      supabase.from('vouchers1').delete().eq('vid', rawVid),
      supabase.from('bs1').delete().or(`trid.eq.${rawVid},acvch.eq.${rawVid}`)
    ]);

    state.vouchersC1 = state.vouchersC1.filter((v: any) => v.vid !== rawVid);
    state.transC1 = state.transC1.filter((e: any) => e.vid !== rawVid);
    state.vouchers1 = state.vouchers1.filter((v: any) => v.vid !== rawVid);
    state.trans1 = state.trans1.filter((e: any) => e.vid !== rawVid);
    state.bs1 = state.bs1.filter((t: any) => t.trid !== rawVid && Number(t.acvch) !== rawVid);
    rebuildAllIndexes();

    if (pfid && amid) {
      await syncPortfolioStats(pfid, amid);
    }
  }
  await createVoucher(data, rawVid || undefined);
}

export async function deleteVoucher(id: any) {
  let rawVid = null;
  if (id) {
    const match = String(id).match(/\d+/);
    if (match) {
      const candidateVid = Number(match[0]);
      const exists = state.vouchersC1.some((v: any) => v.vid === candidateVid) ||
                     state.vouchers1.some((v: any) => v.vid === candidateVid) ||
                     state.bs1.some((t: any) => t.trid === candidateVid || Number(t.acvch) === candidateVid);
      if (exists) {
        rawVid = candidateVid;
      }
    }
  }
  if (rawVid && !isNaN(rawVid)) {
    const tx = state.bs1.find((t: any) => t.trid === rawVid || Number(t.acvch) === rawVid);
    const pfid = tx?.pfid;
    const amid = tx?.amid;

    await Promise.all([
      supabase.from('transc1').delete().eq('vid', rawVid),
      supabase.from('vouchersc1').delete().eq('vid', rawVid),
      supabase.from('trans1').delete().eq('vid', rawVid),
      supabase.from('vouchers1').delete().eq('vid', rawVid),
      supabase.from('bs1').delete().or(`trid.eq.${rawVid},acvch.eq.${rawVid}`)
    ]);

    state.vouchersC1 = state.vouchersC1.filter((v: any) => v.vid !== rawVid);
    state.transC1 = state.transC1.filter((e: any) => e.vid !== rawVid);
    state.vouchers1 = state.vouchers1.filter((v: any) => v.vid !== rawVid);
    state.trans1 = state.trans1.filter((e: any) => e.vid !== rawVid);
    state.bs1 = state.bs1.filter((t: any) => t.trid !== rawVid && Number(t.acvch) !== rawVid);
    rebuildAllIndexes();
    console.log(`✅ Voucher vid=${rawVid} deleted`);

    if (pfid && amid) {
      await syncPortfolioStats(pfid, amid);
    }
  }
}

export async function saveLedger(ledger: any) { console.log('saveLedger stub', ledger?.id); }
export async function deleteLedger(id: any) { console.log('deleteLedger stub', id); }
export async function saveMasterRecord(type: any, record: any) { console.log('saveMasterRecord stub', type); }
export async function deleteMasterRecord(type: any, id: any) { console.log('deleteMasterRecord stub', type, id); }

export function getYearEndClosingLines(selectedFY: string, accountId: string) {
  const allGroups = getStoredGroups(accountId);
  const allLedgers = getStoredLedgers(accountId);
  const allEntries = getStoredEntries();
  const allVouchers = getStoredVouchers();

  // Resolve root type for any group by walking up the parent chain
  const getGroupType = (groupId: string): string => {
    let current = allGroups.find((g: any) => g.id === groupId);
    while (current) {
      if (current.type) return current.type;
      const parentId = current.parent;
      if (!parentId) break;
      current = allGroups.find((g: any) => g.id === parentId);
    }
    return "ASSET";
  };

  // Helper: FY from a date string
  function getFinancialYear(dateStr: string) {
    if (!dateStr) return "1900-1901";
    const d = new Date(dateStr);
    const year = d.getFullYear();
    const month = d.getMonth() + 1;
    return month >= 4 ? `${year}-${year + 1}` : `${year - 1}-${year}`;
  }

  // Capital account ledger
  const capitalLedger = allLedgers.find((l: any) =>
    getGroupType(l.groupId) === 'LIABILITY' && l.name.toLowerCase().includes('capital')
  );

  // Build voucher map for quick lookup
  const voucherMap: Record<string, any> = {};
  allVouchers.forEach((v: any) => { voucherMap[v.id] = v; });

  // Filter portfolios
  const allPortfolios = getStoredPortfolios();
  const portfolioIds = allPortfolios.filter((p: any) => p.accountId === accountId).map((p: any) => p.id);

  // Calculate each Income/Expense ledger balance up to and including selectedFY
  const entriesByLedger: Record<string, any[]> = {};
  allEntries.forEach((e: any) => {
    if (e.ledgerId) {
      const v = voucherMap[e.voucherId];
      const entryDate = e.date || v?.date;
      const entryAcid = e.accountId || v?.accountId;
      const entryPfid = v?.portfolioId;

      const belongsToAccount =
        (entryAcid === accountId) ||
        (entryPfid && portfolioIds.includes(entryPfid));
      if (!belongsToAccount) return;

      if (entryDate) {
        const fy = getFinancialYear(entryDate);
        if (fy <= selectedFY) {
          if (!entriesByLedger[e.ledgerId]) entriesByLedger[e.ledgerId] = [];
          entriesByLedger[e.ledgerId].push(e);
        }
      }
    }
  });

  const getLedgerBalance = (ledger: any) => {
    let dr = 0;
    let cr = 0;
    (entriesByLedger[ledger.id] || []).forEach((e: any) => {
      dr += e.debit || 0;
      cr += e.credit || 0;
    });
    const type = getGroupType(ledger.groupId);
    return type === 'INCOME' ? (cr - dr) : (dr - cr);
  };

  const lines: any[] = [];

  allLedgers.forEach((l: any) => {
    const type = getGroupType(l.groupId);
    if (type !== 'INCOME' && type !== 'EXPENSE') return;

    const bal = getLedgerBalance(l);
    if (Math.abs(bal) < 0.01) return;

    if (type === 'INCOME') {
      // Income has credit balance (bal > 0 means CR > DR). To close: DR the income ledger, CR capital.
      lines.push({
        ledgerId: l.id,
        ledgerName: l.name,
        debit: Math.abs(bal),
        credit: 0,
        groupType: type,
        netBalance: bal
      });
    } else {
      // Expense has debit balance (bal > 0 means DR > CR). To close: CR the expense ledger, DR capital.
      lines.push({
        ledgerId: l.id,
        ledgerName: l.name,
        debit: 0,
        credit: Math.abs(bal),
        groupType: type,
        netBalance: bal
      });
    }
  });

  // Calculate Net Profit or Loss
  const totalIncome = lines.filter(l => l.groupType === 'INCOME').reduce((s, l) => s + l.debit, 0);
  const totalExpense = lines.filter(l => l.groupType === 'EXPENSE').reduce((s, l) => s + l.credit, 0);
  const netProfit = totalIncome - totalExpense;

  // Add offsetting entry to Capital Account
  if (Math.abs(netProfit) >= 0.01 && capitalLedger) {
    if (netProfit > 0) {
      lines.push({
        ledgerId: capitalLedger.id,
        ledgerName: capitalLedger.name,
        debit: 0,
        credit: netProfit,
        groupType: 'LIABILITY',
        isCapitalOffset: true
      });
    } else {
      lines.push({
        ledgerId: capitalLedger.id,
        ledgerName: capitalLedger.name,
        debit: Math.abs(netProfit),
        credit: 0,
        groupType: 'LIABILITY',
        isCapitalOffset: true
      });
    }
  }

  return { lines, capitalLedger, netProfit, error: capitalLedger ? null : "Could not find a Capital Account ledger for this member. Please create one under Capital Account group first." };
}

export async function handleYearClose(fy: string, onSuccess?: () => void) {
  console.log('handleYearClose invoked for FY', fy);
  if (onSuccess) onSuccess();
}

export async function syncLivePrices(onProgress?: (msg: string) => void, force = false) {
  if (!state.mprices) {
    if (onProgress) onProgress('Loading prices...');
    state.mprices = await safeFetch('mprices');
  }
  try {
    // Use IST time (UTC+5:30) so syncs after midnight UTC still use the correct Indian trading date
    const nowIST = new Date(Date.now() + 5.5 * 60 * 60 * 1000);
    const todayStr = nowIST.toISOString().slice(0, 10);
    const hours = nowIST.getUTCHours(); // getUTCHours on our manually-offset date = IST hours
    const day = nowIST.getUTCDay();
    // NSE market: Mon-Fri, 9:15am to 3:30pm IST. We allow 9am-4pm for buffer.
    const isMarketHours = day >= 1 && day <= 5 && hours >= 9 && hours < 16;
    if (!force && !isMarketHours) {
      console.log(`Market closed (IST ${hours}:xx, day ${day}). Skipping auto-sync.`);
      if (onProgress) onProgress('Market closed');
      return;
    }

    if (onProgress) onProgress('Finding active assets...');
    clearPriceCache();

    // 1. Collect all unique active amids (quantity > 0 or current value > 0)
    const amids = Array.from(new Set(
      state.sumTable
        .filter((s: any) => Number(s.qnt) > 0.0001 || Number(s.currv) > 0.01)
        .map((s: any) => Number(s.amid))
        .filter((id: number) => !!id && !isNaN(id))
    ));

    if (amids.length === 0) {
      console.log('No active holdings found to sync.');
      return;
    }

    // 2. Fetch asset details from asset_master in chunks of 100
    const assets: any[] = [];
    const CHUNK = 100;
    for (let i = 0; i < amids.length; i += CHUNK) {
      const { data } = await supabase
        .from('asset_master')
        .select('*')
        .in('amid', amids.slice(i, i + CHUNK));
      if (data) assets.push(...data);
    }
    console.log(`Found ${assets.length} assets to sync.`);

    // 3. Load yesterday's closing prices from mprices as a fallback for prevp.
    //    This guarantees "today's gain" = qty × (currp - prevp) is correct even when
    //    Yahoo/mfapi returns change=0 or no previousClose.
    const yesterdayIST = new Date(nowIST);
    yesterdayIST.setUTCDate(yesterdayIST.getUTCDate() - 1);
    // Walk back to find the last weekday (skip weekends)
    while (yesterdayIST.getUTCDay() === 0 || yesterdayIST.getUTCDay() === 6) {
      yesterdayIST.setUTCDate(yesterdayIST.getUTCDate() - 1);
    }
    const yesterdayStr = yesterdayIST.toISOString().slice(0, 10);

    const prevClosePrices = new Map<number, number>();
    for (let i = 0; i < amids.length; i += CHUNK) {
      const { data: prevRows } = await supabase
        .from('mprices')
        .select('amid, currp')
        .eq('date', yesterdayStr)
        .in('amid', amids.slice(i, i + CHUNK) as number[]);
      if (prevRows) {
        prevRows.forEach((r: any) => {
          if (r.currp > 0) prevClosePrices.set(Number(r.amid), Number(r.currp));
        });
      }
    }
    console.log(`Loaded ${prevClosePrices.size} previous-close prices from ${yesterdayStr}.`);

    // 4. Fetch live prices sequentially (to avoid Yahoo Finance rate-limiting)
    const fetchedPrices: Array<{ amid: number; currp: number; prevp: number; date: string; source_id_atyp: number }> = [];
    const delay = (ms: number) => new Promise(res => setTimeout(res, ms));

    for (let i = 0; i < assets.length; i++) {
      const asset = assets[i];
      if (onProgress && (i === 0 || i % 10 === 0 || i === assets.length - 1)) {
        onProgress(`Fetching ${i + 1}/${assets.length}: ${asset.name?.slice(0, 20)}...`);
      }
      try {
        const price = await getLivePrice(asset);
        if (price && price.price > 0) {
          // Use Yahoo/mfapi previousClose if available, otherwise fall back to yesterday's stored price
          let prevp = Math.max(0, price.price - price.change);
          if (prevp === 0 || prevp === price.price) {
            // change was 0 or missing — use stored yesterday close
            prevp = prevClosePrices.get(asset.amid) ?? price.price;
          }
          fetchedPrices.push({
            amid: asset.amid,
            currp: price.price,
            prevp,
            date: todayStr,
            source_id_atyp: asset.asset_type
          });
        }
      } catch (e) {
        console.warn(`Price fetch failed for ${asset.name} (amid=${asset.amid}):`, e);
      }
      // Delay only for stocks to avoid Yahoo rate limits (MF NAV from mfapi is fast)
      if (asset.asset_type === 50 || asset.asset_type === 70) {
        await delay(150);
      }
    }

    if (fetchedPrices.length === 0) {
      console.log('No live prices fetched.');
      return;
    }

    if (onProgress) onProgress(`Saving ${fetchedPrices.length} prices...`);
    console.log(`Saving ${fetchedPrices.length} prices for ${todayStr}...`);

    // 4. DELETE all existing rows for today for these amids, then INSERT fresh ones.
    //    This is more reliable than upsert (which requires unique constraints).
    const amidsToSave = fetchedPrices.map(p => p.amid);
    for (let i = 0; i < amidsToSave.length; i += CHUNK) {
      const { error: delErr } = await supabase
        .from('mprices')
        .delete()
        .eq('date', todayStr)
        .in('amid', amidsToSave.slice(i, i + CHUNK));
      if (delErr) {
        console.warn(`Delete failed (non-fatal) at chunk ${i}:`, delErr.message);
      }
    }

    // 5. Insert fresh price rows
    for (let i = 0; i < fetchedPrices.length; i += CHUNK) {
      const { error: insertErr } = await supabase
        .from('mprices')
        .insert(fetchedPrices.slice(i, i + CHUNK));
      if (insertErr) {
        console.error(`Insert failed at chunk ${i}:`, insertErr.message);
        throw new Error(`Failed to save prices: ${insertErr.message}`);
      }
    }

    // 6. Update in-memory state so UI refreshes immediately without page reload
    fetchedPrices.forEach((p: any) => {
      state.priceMap[p.amid] = { curr: p.currp, prev: p.prevp };
    });
    rebuildAllIndexes();
    console.log(`✅ Sync done: ${fetchedPrices.length} prices saved for ${todayStr}.`);
  } catch (err) {
    console.error('❌ Live price sync failed:', err);
    throw err;
  }
}

export async function ensureLedgerExists(name: string, groupId: string, acid?: number): Promise<Ledger | null> {
  const acidNum = acid ? Number(acid) : null;
  if (!acidNum) {
    console.error("ensureLedgerExists: acid is required");
    return null;
  }

  const groupMapping: Record<string, number> = {
    stocks: 200050,
    mf_equity: 200061,
    sundry_creditors: 75,
    bank: 60,
    cash: 60,
    stt: 170,
    tax_charges_stocks: 171,
    share_txn_charges: 175,
    tds: 55,
  };

  const parentId = groupMapping[groupId.toLowerCase()] || 50;

  const existing = state.acmac1.find((a: any) => 
    !a.is_group && 
    a.acid === acidNum && 
    a.name.toLowerCase() === name.toLowerCase()
  );

  if (existing) {
    return {
      id: String(existing.id),
      name: existing.name,
      groupId: String(existing.parent_id),
      openingBalance: 0,
      openingType: 'DR',
      amid: existing.id >= 100000 ? existing.id : undefined,
      acid: existing.acid
    };
  }

  const allIds = state.acmac1.map((a: any) => Number(a.id)).filter(id => id < 100000);
  const nextId = allIds.length > 0 ? Math.max(...allIds) + 1 : 1001;

  const newRow = {
    id: nextId,
    name,
    parent_id: parentId,
    is_group: false,
    acid: acidNum,
    special_type_id: 150
  };

  const { error } = await supabase.from('acmac1').insert(newRow);
  if (error) {
    console.error('❌ Failed to insert ledger into acmac1:', error.message);
    throw new Error(`Failed to create ledger: ${error.message}`);
  }

  state.acmac1.push(newRow);
  rebuildAllIndexes();

  return {
    id: String(newRow.id),
    name: newRow.name,
    groupId: String(newRow.parent_id),
    openingBalance: 0,
    openingType: 'DR',
    amid: newRow.id >= 100000 ? newRow.id : undefined,
    acid: newRow.acid
  };
}

export async function updateAssetPrice(assetId: string, price: number) {
  const amidNum = Number(assetId);
  if (isNaN(amidNum)) return;

  const todayStr = new Date().toISOString().split('T')[0];
  const asset = state.assetMaster.find((a: any) => a.amid === amidNum);
  const source_id_atyp = asset ? asset.asset_type : 50;

  const priceRow = {
    amid: amidNum,
    currp: price,
    prevp: state.priceMap[amidNum]?.curr || price,
    date: todayStr,
    source_id_atyp
  };

  const { error } = await supabase.from('mprices').upsert(priceRow, { onConflict: 'amid,date' });
  if (error) {
    console.error('❌ Failed to update asset price in mprices:', error.message);
    throw new Error(`Failed to update price: ${error.message}`);
  }

  state.priceMap[amidNum] = { curr: price, prev: priceRow.prevp };
  rebuildAllIndexes();
  console.log(`✅ Asset price updated: amid=${amidNum}, price=${price}`);
}

export async function forceRefreshDatabase() {
  state.initialized = false;
  state.priceMap = {};
  state.assetNameMap = {};
  await initDatabase();
}

export async function togglePortfolioStatus(portfolioId: string, isActive: boolean) {
  const newStatus = isActive ? 1 : 0;
  const { error } = await supabase.from('portfolios').update({ exit_status: newStatus }).eq('id', portfolioId);
  if (error) {
    console.error('Failed to toggle portfolio status', error);
  } else {
    const p = state.portfolios.find(pf => String(pf.id) === String(portfolioId));
    if (p) p.exit_status = newStatus;
  }
}


export async function createVouchersBulk(dataList: any[]) {
  if (dataList.length === 0) return;

  const VTYP_MAP: Record<string, number> = {
    journal: 5,
    payment: 1,
    receipt: 2,
    contra: 3,
    purchase: 4,
    sales: 6,
    bonus: 5,
    split: 5,
    merger: 5,
    demerger: 5,
    dividend: 2,
  };

  const { data: maxVid } = await supabase.from('vouchersc1').select('vid').order('vid', { ascending: false }).limit(1);
  let nextVid = (maxVid?.[0]?.vid || 0) + 1;

  const { data: maxTrans } = await supabase.from('transc1').select('transid').order('transid', { ascending: false }).limit(1);
  let nextTransid = (maxTrans?.[0]?.transid || 0) + 1;

  const vouchers: any[] = [];
  const allTrans: any[] = [];
  const allNotes: any[] = [];

  for (const data of dataList) {
    const acid = data.accountId ? Number(data.accountId) : null;
    const vid = nextVid++;
    const vtyp = VTYP_MAP[data.type] ?? 5;

    vouchers.push({
      vid,
      acid,
      dt: data.date,
      narr: data.narration || '',
      vtyp,
      pfid: data.portfolioId ? Number(data.portfolioId) : null,
    });

    const lines = (data.lines || []).filter((l: any) => l.ledgerId && (Number(l.debit) > 0 || Number(l.credit) > 0 || data.type === 'bonus' || data.type === 'split' || data.type === 'merger' || data.type === 'demerger'));

    for (const line of lines) {
      const transid = nextTransid++;
      const amid = data.assetId ? Number(data.assetId) : null;
      allTrans.push({
        transid,
        vid,
        acid,
        dt: data.date,
        maid: Number(line.ledgerId),
        crdr: Number(line.credit) > 0 ? 1 : 0,
        amount: Number(line.debit) > 0 ? Number(line.debit) : Number(line.credit),
        pfid: data.portfolioId ? Number(data.portfolioId) : null,
        amid,
      });

      if (data.type === 'journal' || data.type === 'purchase' || data.type === 'sales' || data.type === 'bonus' || data.type === 'split' || data.type === 'merger' || data.type === 'demerger') {
        const qty = Number(data.quantity) || 0;
        const pr = Number(data.price) || 0;
        if (qty > 0 || pr > 0 || data.type === 'bonus' || data.type === 'split' || data.type === 'merger' || data.type === 'demerger') {
          allNotes.push({
            transid,
            acid,
            qty,
            pr,
            brok: 0,
            stax: 0,
            tran_chg: 0,
            stamp: 0,
            cgst: 0,
            sgst: 0,
            igst: 0,
            stt: 0
          });
        }
      }
    }
  }

  const { error: vErr } = await supabase.from('vouchersc1').insert(vouchers);
  if (vErr) {
    console.error('Failed to insert vouchers bulk:', vErr);
    throw new Error('Bulk insert failed for vouchersc1: ' + vErr.message);
  }

  // Insert in chunks of 500 to avoid limits
  for (let i = 0; i < allTrans.length; i += 500) {
    const chunk = allTrans.slice(i, i + 500);
    const { error: tErr } = await supabase.from('transc1').insert(chunk);
    if (tErr) throw new Error('Bulk insert failed for transc1: ' + tErr.message);
  }

  if (allNotes.length > 0) {
    for (let i = 0; i < allNotes.length; i += 500) {
      const chunk = allNotes.slice(i, i + 500);
      const { error: nErr } = await supabase.from('scnote1').insert(chunk);
      if (nErr) throw new Error('Bulk insert failed for scnote1: ' + nErr.message);
    }
  }
}
