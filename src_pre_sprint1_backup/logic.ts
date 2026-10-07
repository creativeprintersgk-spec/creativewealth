// WealthCore — Complete Logic Layer v2
// Reads from real MProfit Supabase tables
// All TypeScript errors fixed

import { supabase } from "./supabase.ts";
import { get, set } from 'idb-keyval';
import { getLivePrice, clearPriceCache } from "./services/assetMasterService.ts";
import isinDict from './services/isinDictionary.json' with { type: 'json' };
import { computeAssetTax, applySection112AExemption } from "./services/taxEngine.ts";

// ── HELPER UTILS ─────────────────────────────────────────────────────────────
export function formatInvestorName(name?: string): string {
  if (!name || name === 'all' || name === 'All Portfolios' || name.toLowerCase().includes('family')) {
    return 'Pramesh R Shah Family';
  }
  const n = name.trim().toLowerCase();

  if (n.includes('saahil huf') || n.includes('sps huf')) return 'Saahil Shah HUF';
  if (n.includes('saahil') || n.includes('sps')) return 'Saahil P Shah';
  if (n.includes('unnati') || n.includes('ups')) return 'Unnati P Shah';
  if (n.includes('prs huf') || n.includes('pramesh huf')) return 'Pramesh Shah HUF';
  if (n.includes('krisha') || n.includes('kss')) return 'Krisha Saahil Shah';
  if (n.includes('arjin')) return 'Arjin Saahil Shah';
  if (n.includes('pramesh') || n.includes('prs')) return 'Pramesh R Shah';

  return name;
}

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
  75: 'Gold',
  77: 'Silver',
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
  75: 'GLD',
  77: 'SLV',
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
  isinMap: {} as Record<number, string>,
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
async function safeFetch(table: string, max = 500000): Promise<any[]> {
  try {
    let all: any[] = [];
    const pkMap: Record<string, string> = {
      bs1: 'trid',
      transc1: 'transid', trans1: 'transid',
      vouchersc1: 'vid', vouchers1: 'vid',
      portfolios: 'id', investor_group_members: 'investor_group_id', acc_pflink: 'pfid',
      acmac1: 'id', sam: 'amid', asset_master: 'amid',
      sum_table: 'sid', mprices: 'amid', scnote1: 'cnid'
    };
    let page = 0;
    const size = 1000;
    while (all.length < max) {
      let query = supabase.from(table).select('*');
      if (table === 'acmac1') {
        query = query.order('acid').order('id').order('is_group');
      } else if (table === 'vouchersc1' || table === 'vouchers1') {
        query = query.order('acid').order('vid');
      } else if (table === 'transc1' || table === 'trans1') {
        query = query.order('acid').order('transid');
      } else {
        query = query.order(pkMap[table] || 'id');
      }
      const { data, error } = await query.range(page * size, (page + 1) * size - 1);
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
let isBackgroundSyncing = false;

async function performBackgroundSync() {
  if (isBackgroundSyncing) return;
  isBackgroundSyncing = true;
  try {
    const [portfolios, igm, accPflink, acmac1,
           bs1, sumTable, vouchersC1, vouchers1, transC1, trans1, mprices, scnote1] = await Promise.all([
      safeFetch('portfolios'), safeFetch('investor_group_members'),
      safeFetch('acc_pflink'), safeFetch('acmac1'),
      safeFetch('bs1'), safeFetch('sum_table'),
      safeFetch('vouchersc1'), safeFetch('vouchers1'),
      safeFetch('transc1'), safeFetch('trans1'),
      safeFetch('mprices'), safeFetch('scnote1')
    ]);

    const maids = new Set<number>();
    sumTable.forEach((s: any) => { if (s.amid) maids.add(Number(s.amid)); });
    bs1.forEach((b: any) => { if (b.amid) maids.add(Number(b.amid)); });
    transC1.forEach((t: any) => { if (t.maid) maids.add(Number(t.maid)); });
    trans1.forEach((t: any) => { if (t.maid) maids.add(Number(t.maid)); });
    const maidArr = Array.from(maids);

    // Parallelize sam and asset_master chunk fetching for speed
    const chunks: number[][] = [];
    for (let i = 0; i < maidArr.length; i += 150) {
      chunks.push(maidArr.slice(i, i + 150));
    }

    const samPromises = chunks.map(chunk => supabase.from('sam').select('*').in('amid', chunk));
    const amPromises = chunks.map(chunk => supabase.from('asset_master').select('*').in('amid', chunk));

    const [samResults, amResults] = await Promise.all([
      Promise.all(samPromises),
      Promise.all(amPromises)
    ]);

    let sam: any[] = [];
    let assetMaster: any[] = [];
    samResults.forEach(res => { if (res.data) sam = sam.concat(res.data); });
    amResults.forEach(res => { if (res.data) assetMaster = assetMaster.concat(res.data); });

    const uniqueAcmac1: any[] = [];
    const seenAcmac = new Set();
    for (const a of acmac1) {
      if (a.name === 'Difference in Opening Balances') continue;
      const key = `${a.id}_${a.acid}_${a.is_group}`;
      if (!seenAcmac.has(key)) {
        seenAcmac.add(key);
        uniqueAcmac1.push(a);
      }
    }

    const newState = {
      portfolios,
      investorGroupMembers: igm,
      accPflink,
      acmac1: uniqueAcmac1,
      sam,
      assetMaster,
      bs1,
      sumTable,
      // Exclude legacy orphan voucher 400 (from 2013 with unmapped broker 215)
      vouchersC1: vouchersC1.filter((v: any) => !(v.vid === 400 && String(v.dt).startsWith('2013'))).map((v: any) => ({ ...v, _src: 'c' })),
      vouchers1: vouchers1.map((v: any)  => ({ ...v, _src: 't' })),
      transC1: transC1.filter((e: any) => !(e.vid === 400 && String(e.dt).startsWith('2013'))).map((e: any)    => ({ ...e, _src: 'c' })),
      trans1: trans1.map((e: any)     => ({ ...e, _src: 't' })),
      mprices,
      scnote1: scnote1 || []
    };

    Object.assign(state, newState);
    
    state.priceMap = {};
    state.assetNameMap = {};
    state.isinMap = {};
    const sortedMprices = [...newState.mprices].sort((a, b) => (a.date || '').localeCompare(b.date || ''));
    sortedMprices.forEach((p: any) => {
      state.priceMap[p.amid] = { curr: Number(p.currp) || 0, prev: Number(p.prevp) || 0 };
    });
    newState.sam.forEach((s: any) => {
      state.assetNameMap[s.amid] = s.anm;
      // MProfit v10: Trans1 investment maids use 500000 + SAM.amid
      // Register both keys so getAssetName works for both raw and prefixed amids
      state.assetNameMap[500000 + Number(s.amid)] = s.anm;
      const isinVal = s.isin || s.isincode || s.isin_code;
      if (isinVal) state.isinMap[s.amid] = String(isinVal).trim();
    });
    newState.assetMaster.forEach((a: any) => {
      state.assetNameMap[a.amid] = a.name;
      const isinVal = a.isin || a.isincode || a.isin_code;
      if (isinVal) state.isinMap[a.amid] = String(isinVal).trim();
    });
    newState.acmac1.forEach((a: any) => {
      if (!state.assetNameMap[a.id]) state.assetNameMap[a.id] = a.name;
      const isinVal = a.isin || a.isincode;
      if (isinVal) state.isinMap[a.id] = String(isinVal).trim();
    });

    rebuildAllIndexes();

    if (typeof indexedDB !== 'undefined') {
      await set('wealthcore_state_v27', JSON.parse(JSON.stringify(newState)));
      console.log('Background sync complete and cached.');
    }
    if (typeof window !== 'undefined') {
      window.dispatchEvent(new Event('wealthcore-sync-complete'));
    }
  } catch (err) {
    console.error('Background sync failed:', err);
  } finally {
    isBackgroundSyncing = false;
  }
}

export async function initDatabase() {
  if (state.initialized) return;
  console.log('Initializing WealthCore...');
  
  try {
    const cachedState = (typeof indexedDB !== 'undefined') ? await get('wealthcore_state_v27') : null;
    if (cachedState) {
      console.log('Loaded from IDB cache!');
      Object.assign(state, cachedState);
      
      // Rebuild transient maps
      state.priceMap = {};
      state.assetNameMap = {};
      const sortedMprices = [...(state.mprices || [])].sort((a, b) => (a.date || '').localeCompare(b.date || ''));
      sortedMprices.forEach((p: any) => {
        state.priceMap[p.amid] = { curr: Number(p.currp) || 0, prev: Number(p.prevp) || 0 };
      });
      (state.sam || []).forEach((s: any) => {
        state.assetNameMap[s.amid] = s.anm;
        state.assetNameMap[500000 + Number(s.amid)] = s.anm; // MProfit v10: maid = 500000 + SAM.amid
      });
      (state.assetMaster || []).forEach((a: any) => { state.assetNameMap[a.amid] = a.name; });
      (state.acmac1 || []).forEach((a: any) => { if (!state.assetNameMap[a.id]) state.assetNameMap[a.id] = a.name; });

      rebuildAllIndexes();
      state.initialized = true;
      
      // Trigger background sync to get latest data silently
      performBackgroundSync();
      return;
    }
  } catch (err) {
    console.warn('Failed to load from cache:', err);
  }

  // If no cache, block until first sync finishes
  await performBackgroundSync();
  state.initialized = true;
}

// ── HELPERS ───────────────────────────────────────────────────────────────────
export function getAssetName(amid: number): string {
  if (state.assetNameMap[amid]) return state.assetNameMap[amid];

  // Direct SAM lookup (raw amid)
  const s = state.sam.find((x: any) => Number(x.amid) === amid);
  if (s && s.anm) return s.anm;

  // MProfit v10: Trans1 investment maids use maid = 500000 + SAM.amid
  // Strip the 500000 offset and retry the SAM/assetMaster lookup
  if (amid >= 500000) {
    const samAmid = amid - 500000;
    const s2 = state.sam.find((x: any) => Number(x.amid) === samAmid);
    if (s2 && s2.anm) return s2.anm;
    const a2 = state.assetMaster.find((x: any) => Number(x.amid) === samAmid);
    if (a2 && a2.name) return a2.name;
  }

  // Direct assetMaster lookup (raw amid)
  const a = state.assetMaster.find((x: any) => Number(x.amid) === amid);
  if (a && a.name) return a.name;

  // ACMAC1 cross-reference via exint1
  const ac = state.acmac1.find((x: any) => !x.is_group && Number(x.exint1) === amid && Number(x.id) >= 100000);
  if (ac && ac.name) return ac.name;

  // Mappings table
  const mp = (state as any).mappings?.find((x: any) => Number(x.amid) === amid);
  if (mp && mp.descr) return mp.descr.split('/')[0] || mp.descr;

  return '';
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
    .map((a: any) => {
      const db = Number(a.db_bal) || 0;
      const cr = Number(a.cr_bal) || 0;
      // db_bal/cr_bal are MProfit NET stored balances. When equal, account is zeroed/closed.
      const net = db - cr;
      return {
        id: String(a.id),
        name: a.name,
        groupId: String(a.parent_id),
        openingBalance: Math.abs(net),
        openingType: net >= 0 ? 'DR' as const : 'CR' as const,
        currentBalance: 0,
        currentType: 'DR' as const,
        amid: a.id >= 100000 ? a.id : undefined,
        acid: a.acid
      };
    });
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

export function resolveAssetType(pfid: number, amid: number, defaultAtty?: number): number {
  const amidNum = Number(amid);
  let resolvedAtty = defaultAtty || 50;

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

  // ── Priority 1: Exact Database Chart of Accounts Category (acmac1.parent_id) ──
  const exactIdMatch = state.acmac1.find((l: any) => !l.is_group && Number(l.exint1 || l.amid || l.id) === amidNum);
  if (exactIdMatch && exactIdMatch.parent_id) {
    const parentId = Number(exactIdMatch.parent_id);
    if (groupAttyMap[parentId] !== undefined) {
      // If it is explicitly classified as Stocks in COA, return Stocks unconditionally
      if (groupAttyMap[parentId] === 50) return 50;
      // If parentId is explicitly Gold/Silver/Property/Bond, return it directly
      if ([100, 110, 120, 130, 140, 150, 151, 160, 170, 180].includes(groupAttyMap[parentId])) {
        return groupAttyMap[parentId];
      }
      resolvedAtty = groupAttyMap[parentId];
    }
  }

  // ── Priority 2: Asset Master Explicit Asset Type ──
  const am = state.assetMaster.find((a: any) => a.amid === amidNum);
  if (am && am.asset_type) {
    const amType = Number(am.asset_type);
    if (amType === 50) return 50; // Stocks
    resolvedAtty = amType;
  }

  // If defaultAtty is explicitly Stocks (50) and no other override
  if (defaultAtty === 50 && (!exactIdMatch || exactIdMatch.parent_id === 200050)) {
    return 50;
  }

  const assetName = getAssetName(amidNum);
  const cleanTargetName = assetName.toLowerCase().trim();

  // ── Priority 3: Sub-Classification for Funds & Commodities ──
  // Metal / Commodity ETFs (Silver ETF, Gold ETF, BeES) -> Listed ETF (atyid 51)
  if (/silver|gold|commodity|metal/i.test(cleanTargetName) && /etf|bees/i.test(cleanTargetName)) {
    return 51;
  }

  // Gold / Silver FoF, Multi-Asset, International FoF -> Unlisted Non-Debt Fund (atyid 75)
  if (/\b(fof|fund of funds?|multi\s*asset(\s*fund)?|overseas\s*fund|international\s*fund|global\s*fund)\b/i.test(cleanTargetName) && !/etf|bees/i.test(cleanTargetName)) {
    return 75;
  }

  // Sovereign Gold Bonds (SGB) -> Traded Bonds (100)
  if (/sovereign gold bond|sgb/i.test(cleanTargetName)) {
    return 100;
  }

  // Physical Gold & Silver
  if (cleanTargetName === 'gold' || cleanTargetName === 'gold r' || /^gold\s*(\([^\)]*\))?$/i.test(cleanTargetName)) {
    return 150;
  }
  if (cleanTargetName === 'silver' || cleanTargetName === 'silver r' || /^silver\s*(\([^\)]*\))?$/i.test(cleanTargetName)) {
    return 151;
  }

  // SEBI / AMFI Debt Mutual Funds (atyid 61)
  const isDebtMf = (
    /\b(liquid|liquidity|overnight|money\s*market|gilt|treasury)\b/i.test(cleanTargetName) ||
    /\b(ultra\s*short|low\s*duration|short\s*duration|short\s*term\s*(debt|bond)?|medium\s*duration|medium\s*term|long\s*duration)\b/i.test(cleanTargetName) ||
    /\b(corporate\s*bond|credit\s*risk|banking\s*(&|and)\s*psu|dynamic\s*bond|floater|floating\s*rate)\b/i.test(cleanTargetName) ||
    /\b(debt\s*hybrid|conservative\s*hybrid|regular\s*savings\s*fund|monthly\s*income\s*plan|mip)\b/i.test(cleanTargetName) ||
    /\b(target\s*maturity|sdl\s*fund|bharat\s*bond|fixed\s*maturity|fmp|interval\s*fund)\b/i.test(cleanTargetName)
  );

  const isPureEquityMf = /\b(contra|flexi|multi\s*cap|large\s*cap|mid\s*cap|small\s*cap|elss|index\s*fund|arbitrage)\b/i.test(cleanTargetName.replace(/debt\s*hybrid|conservative\s*hybrid/i, ''));

  if (isDebtMf && !isPureEquityMf) {
    return 61; // Mutual Funds (Debt)
  }

  // Rule 4: Map legacy / MProfit atty codes
  if (resolvedAtty === 75) return 150;  // Gold (MProfit atty 75 -> WealthCore atty 150)
  if (resolvedAtty === 77) return 151;  // Silver (MProfit atty 77 -> WealthCore atty 151)
  if (resolvedAtty === 40) return 100; // Traded Bonds
  if (resolvedAtty === 30) return 90;  // FDs

  return resolvedAtty;
}

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

export function getHoldings(portfolioIds: number[], assetTypeFilter?: number | number[], includeZeroQty: boolean = false): AssetHolding[] {
  const pSet = new Set(portfolioIds);
  
  // 1. Filter sum_table for active holdings (qnt > 0 or currv > 0)
  // We exclude amtinv > 0 because sold assets often still retain an amtinv value in the sumTable
  const rows = state.sumTable.filter((s: any) => 
    pSet.has(s.pfolio_id) && 
    (includeZeroQty || Number(s.qnt) > 0.0001 || Number(s.currv) > 0.01)
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
    const resolvedAtty = resolveAssetType(s.pfolio_id, s.amid, s.atty);
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

    let currPrice = price.curr || fallbackCurr;
    let prevPrice = price.prev || fallbackPrev;

    // Fixed Income assets (Bonds, NCDs, FDs, PPF, Deposits) cost-price fallback when no live price is available
    const inv = Number(s.amtinv) || 0;
    const avgPrice = qty > 0 ? inv / qty : 0;
    const isFixedIncome = [40, 90, 100, 110, 120, 130].includes(s.resolvedAtty);
    if (currPrice === 0 && isFixedIncome) {
      currPrice = avgPrice;
      prevPrice = avgPrice;
    }

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



export function getAssetISIN(amid: number): string {
  const key = String(amid);
  if ((isinDict as Record<string, string>)[key]) {
    return (isinDict as Record<string, string>)[key];
  }
  if (state.isinMap[amid]) return state.isinMap[amid];
  const s = state.sam.find((x: any) => x.amid === amid);
  if (s && (s.isin || s.isincode || s.isin_code)) return String(s.isin || s.isincode || s.isin_code).trim();
  const a = state.assetMaster.find((x: any) => x.amid === amid);
  if (a && (a.isin || a.isincode || a.isin_code)) return String(a.isin || a.isincode || a.isin_code).trim();
  const ac = state.acmac1.find((x: any) => x.id === amid);
  if (ac && (ac.isin || ac.isincode)) return String(ac.isin || ac.isincode).trim();
  const b = state.bs1.find((x: any) => x.amid === amid && (x.isin || x.isincode || x.isin_code));
  if (b) return String(b.isin || b.isincode || b.isin_code).trim();
  const t = (state.transC1 || []).find((x: any) => x.amid === amid && (x.isin || x.isincode || x.isin_code));
  if (t) return String(t.isin || t.isincode || t.isin_code).trim();
  return '';
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

export function getFolioNumber(sid?: number | string, amid?: number | string, pfid?: number | string): string {
  if (sid) {
    const sEntry = state.sumTable.find((s: any) => Number(s.sid) === Number(sid));
    if (sEntry && sEntry.refno && sEntry.refno.trim()) return sEntry.refno.trim();
  }
  if (amid && pfid) {
    const sEntry = state.sumTable.find((s: any) => Number(s.amid) === Number(amid) && Number(s.pfolio_id) === Number(pfid));
    if (sEntry && sEntry.refno && sEntry.refno.trim()) return sEntry.refno.trim();
  }
  if (amid) {
    const l = state.acmac1.find((a: any) => a.id === Number(amid));
    if (l && l.name) {
      const match = l.name.match(/\(([^)]+)\)$/);
      if (match) return match[1].trim();
    }
  }
  return '';
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
    const isBuy = [19, 20, 12, 25, 30, 35, 36, 37, 38, 39, 40, 45, 46, 47, 48, 49].includes(t.trty);

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

    const folio = getFolioNumber(t.sid, t.amid, t.pfid);
    const txItem = {
      id: t.trid,
      date,
      type: t.trstr || (isBuy ? 'Buy' : 'Sell'),
      trty: t.trty,
      voucherId: 'trid_' + t.trid,
      portfolioName: port?.investor_name || `Portfolio ${t.pfid}`,
      portfolioId: t.pfid,
      folio,
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

export function getPortfolioActivity(portfolioIds: number[], limit = 5000) {
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
        folio: getFolioNumber(t.sid, t.amid, t.pfid),
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
  const lid = String(ledgerId);
  const acidNum = acid && acid !== 'undefined' ? Number(acid) : null;

  // Find ledger definition in state.acmac1
  const ledgerRow = (state.acmac1 || []).find((a: any) => 
    !a.is_group && String(a.id) === lid && (!acidNum || a.acid === acidNum)
  );

  const allEntries = getStoredEntries();
  const allVouchers = getStoredVouchers();
  const voucherMap: Record<string, any> = {};
  allVouchers.forEach((v: any) => { voucherMap[v.id] = v; });

  const allPortfolios = getStoredPortfolios();
  const portfolioIds = acidNum
    ? allPortfolios.filter((p: any) => Number(p.accountId) === acidNum).map((p: any) => String(p.id))
    : null;

  // Filter entries for this ledger (and this account/portfolio if acid is provided)
  const entries = allEntries
    .filter((e: any) => {
      if (String(e.ledgerId) !== lid) return false;
      if (acidNum) {
        const v = voucherMap[e.voucherId];
        const entryAcid = e.accountId || v?.accountId;
        const entryPfid = v?.portfolioId;
        const belongs = (Number(entryAcid) === acidNum) ||
          (entryPfid && portfolioIds && portfolioIds.includes(String(entryPfid)));
        if (!belongs) return false;
      }
      return true;
    })
    .sort((a: any, b: any) => (a.date || '').localeCompare(b.date || ''));

  // If no transactions exist, check if acmac1 has a static balance (e.g. legacy ledgers with no vouchers)
  if (entries.length === 0) {
    const initialDb = Number(ledgerRow?.db_bal) || 0;
    const initialCr = Number(ledgerRow?.cr_bal) || 0;
    const initialNet = initialDb - initialCr;
    return { transactions: [], openingBalance: initialNet, closingBalance: initialNet };
  }

  // NOTE: acmac1.db_bal/cr_bal in MProfit are cumulative lifetime totals, NOT starting balances.
  // Starting balance vouchers (VID=0 / DT=0001-01-01) are already included in entries.
  // Therefore, runningBalance MUST start at 0 to avoid double-counting.
  let openingBalance = 0;
  let runningBalance = 0;
  const transactions: any[] = [];

  entries.forEach((e: any) => {
    const dr = Number(e.debit) || 0;
    const cr = Number(e.credit) || 0;
    const v = voucherMap[e.voucherId];
    const entryDate = e.date || v?.date || '';
    const isOpening = !entryDate || entryDate === '' || entryDate === 'undefined' || String(entryDate).startsWith('0001');

    const before = startDate ? (isOpening || entryDate < startDate) : isOpening;
    const inRange = (!startDate || entryDate >= startDate) && (!endDate || entryDate <= endDate) && !isOpening;

    if (before) {
      runningBalance += dr - cr;
      openingBalance = runningBalance;
    } else if (inRange) {
      runningBalance += dr - cr;

      // Find counter ledger name in the same voucher
      let againstName = '';
      if (e.voucherId) {
        const otherLegs = allEntries.filter((t: any) => t.voucherId === e.voucherId && t.id !== e.id);
        if (otherLegs.length === 1) {
          const otherMaid = otherLegs[0].ledgerId;
          const otherLedger = (state.acmac1 || []).find((a: any) => String(a.id) === String(otherMaid) && (!acidNum || a.acid === acidNum));
          againstName = otherLedger ? otherLedger.name : getAssetName(Number(otherMaid)) || `Ledger ${otherMaid}`;
        } else if (otherLegs.length > 1) {
          againstName = 'Multiple Accounts';
        }
      }

      const vtypMap: Record<string, string> = { '2': 'payment', '4': 'receipt', '5': 'journal', '14': 'purchase', '15': 'sale' };
      transactions.push({
        date: entryDate,
        voucherId: e.voucherId,
        voucherType: v?.type ? (vtypMap[v.type] || v.type) : 'journal',
        narration: v?.narration || '',
        debit: dr,
        credit: cr,
        balance: runningBalance,
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

// ── SHARED FIFO CONSTANTS ───────────────────────────────────────────────────
// Single source of truth for which transaction-type codes count as a "buy" vs
// a "sell" for cost-basis purposes. Both getCapitalGains() (the Capital Gains
// report) and createVoucher() (manual sale P&L booking) must use these same
// sets — previously they each had their own, slightly different, list, which
// meant the two engines could compute different cost bases for the same trade.
// Complete MProfit inflow / buy transaction types: 20 (Buy), 12/25 (IPO/Rights),
// 19 (Op Bal), 30 (Investment), 35 (Div Reinvest), 38 (Merger), 40 (Bonus), 46/47 (Demerger)
export const FIFO_BUY_TRTY = new Set([12, 15, 19, 20, 25, 30, 35, 38, 40, 46, 47]);
export const FIFO_SELL_TRTY = new Set([99, 101, 150]);

/**
 * Builds the FIFO delivery-lot ledger for ONE asset's full transaction history
 * (already filtered to a single pfid+amid[+sid] and sorted by date ascending).
 *
 * This is the single implementation of: settlement-cycle short-cover
 * detection, same-day intraday netting (stocks only), stock-split/bonus
 * adjustment, and FIFO lot depletion. It is used both to generate the
 * Capital Gains report (results within fromDate..toDate) and, by
 * createVoucher(), to find the still-open lots as of a given sale date so a
 * manually entered sale can be costed identically to how the report would
 * cost it.
 *
 * IMPORTANT: this function does NOT mutate the transaction objects passed in
 * (it clones before any date reordering), so it's safe to call repeatedly or
 * on objects that are live references into state.bs1.
 *
 * @returns results: realized-gain rows whose sellDate falls within [fromDate, toDate]
 * @returns openLots: remaining un-sold delivery lots after processing all of txListIn
 */
export function buildAssetFifoLedger(
  txListIn: any[],
  fromDate: string,
  toDate: string,
  scMap: Map<number, { sellExp: number; buyExp: number }>,
  cnTrades: Record<number, { totalAmt: number }>
): { results: any[]; openLots: any[] } {
  const regularBuyTrty = FIFO_BUY_TRTY;
  const regularSellTrty = FIFO_SELL_TRTY;
  const results: any[] = [];

  // Clone every transaction before any in-place reordering/redating below.
  // The originals are live references into state.bs1 — mutating them here
  // would permanently corrupt the source trade dates for every other
  // consumer of state.bs1 (holdings, other reports, subsequent calls).
  const txList = txListIn.map(t => ({ ...t }));

  // Pre-pass: If a sell occurs without prior inventory and is covered within 5 days (settlement cycle / short cover),
  // ensure the buy is processed first so the short trade is closed cleanly and does not leave a phantom buy lot.
  for (let i = 0; i < txList.length - 1; i++) {
    const cur = txList[i];
    const next = txList[i + 1];
    if (cur && next && regularSellTrty.has(Number(cur.trty)) && regularBuyTrty.has(Number(next.trty))) {
      let priorNetQty = 0;
      for (let j = 0; j < i; j++) {
        if (regularBuyTrty.has(Number(txList[j].trty))) priorNetQty += Number(txList[j].qn) || 0;
        if (regularSellTrty.has(Number(txList[j].trty))) priorNetQty -= Number(txList[j].qn) || 0;
      }
      if (priorNetQty < (Number(cur.qn) || 0)) {
        const dCur = new Date((cur.dt || '').substring(0, 10)).getTime();
        const dNext = new Date((next.dt || '').substring(0, 10)).getTime();
        if (Math.abs(dNext - dCur) <= 5 * 86400000) {
          cur.dt = next.dt;
          txList[i] = next;
          txList[i + 1] = cur;
        }
      }
    }
  }

  // Group transactions by date for same-day intraday netting
  const byDate: Record<string, { buys: any[]; sells: any[]; corp: any[] }> = {};
  txList.forEach(t => {
    const dt = (t.dt || '').slice(0, 10);
    if (!byDate[dt]) byDate[dt] = { buys: [], sells: [], corp: [] };
    const trty = Number(t.trty);
    if ([85, 45].includes(trty)) {
      byDate[dt].corp.push(t);
    } else if (regularBuyTrty.has(trty)) {
      byDate[dt].buys.push({ ...t, remQty: Number(t.qn) || 0 });
    } else if (regularSellTrty.has(trty)) {
      byDate[dt].sells.push({ ...t, remQty: Number(t.qn) || 0 });
    }
  });

  const deliveryLots: any[] = [];
  const isMf = txList[0] && (txList[0].atyid === 60 || txList[0].atyid === 61 || txList[0].atyid === 62);

  Object.keys(byDate).sort().forEach(dt => {
    const day = byDate[dt];

    // Match same-day buys and sells first ONLY for Stocks/Equities (Intraday netting)
    if (!isMf) {
      day.buys.forEach(b => {
        day.sells.forEach(s => {
          if (b.remQty > 0 && s.remQty > 0) {
            const match = Math.min(b.remQty, s.remQty);
            b.remQty -= match;
            s.remQty -= match;

            const buyPrice = Number(b.netpr) || Number(b.purpr) || 0;
            const grossSellAmt = Number(s.amt) || (Number(s.qn) * (Number(s.netpr) || Number(s.purpr) || 0));
            const cnid = Number(s.cnid);
            let transferExp = 0;
            if (cnid && cnid > 0 && scMap.has(cnid)) {
              const totalCnAmt = cnTrades[cnid]?.totalAmt || grossSellAmt;
              const cnInfo = scMap.get(cnid);
              const totalCnExp = cnInfo ? cnInfo.sellExp : 0;
              transferExp = totalCnAmt > 0 ? (grossSellAmt / totalCnAmt) * totalCnExp : 0;
            }
            const netSellAmtVal = Math.max(0, grossSellAmt - transferExp);
            const sellPrice = Number(s.qn) > 0 ? (netSellAmtVal / Number(s.qn)) : (Number(s.netpr) || Number(s.purpr) || 0);

            const buyVal = match * buyPrice;
            const sellVal = match * sellPrice;
            const gain = sellVal - buyVal;

            if (dt >= fromDate && dt <= toDate) {
              const port = state.portfolios.find((p: any) => p.id === s.pfid);
              const atyid = resolveAssetType(Number(s.pfid), Number(s.amid), Number(s.atyid));
              const isin = getAssetISIN(Number(s.amid));
              const folio = getFolioNumber(s.sid, s.amid, s.pfid);
              results.push({
                portfolioId: s.pfid,
                portfolioName: port?.investor_name || `Portfolio ${s.pfid}`,
                assetName: getAssetName(s.amid),
                isin,
                folio,
                amid: s.amid,
                assetType: atyid,
                assetTypeName: ASSET_TYPE_MAP[atyid] || 'Stocks',
                buyDate: dt,
                sellDate: dt,
                holdingDays: 0,
                quantity: match,
                buyPrice,
                sellPrice,
                costBasis: buyVal,
                saleProceeds: sellVal,
                gainLoss: gain,
                gainType: 'Intraday',
                taxRate: 0,
                estimatedTax: 0,
                indexationUsed: false,
                notes: 'Same-day square off (Intraday)'
              });
            }
          }
        });
      });
    }

    // Handle Stock Split Outflow (85) & Inflow (45)
    day.corp.forEach(t => {
      const trty = Number(t.trty);
      if (trty === 85) {
        const inflow = day.corp.find(x => Number(x.trty) === 45);
        if (inflow && Number(t.qn) > 0) {
          const ratio = Number(inflow.qn) / Number(t.qn);
          deliveryLots.forEach(lot => {
            lot.qty *= ratio;
            lot.remaining *= ratio;
            lot.costPerUnit /= ratio;
          });
        }
      }
    });

    // Enqueue remaining buys as delivery lots
    day.buys.forEach(b => {
      if (b.remQty > 0) {
        const trty = Number(b.trty);
        const qn = Number(b.qn) || 0;
        const unitPrice = Number(b.netpr) || Number(b.purpr) || 0;
        const amtVal = Number(b.amt) || 0;
        const totalAmt = trty === 40 ? 0 : (amtVal > 0 ? amtVal : qn * unitPrice);
        const costPerUnit = trty === 40 ? 0 : (qn > 0 ? (totalAmt / qn) : unitPrice);
        deliveryLots.push({
          date: dt,
          qty: b.remQty,
          remaining: b.remQty,
          totalAmt: costPerUnit * b.remQty,
          costPerUnit,
          amid: b.amid,
          atyid: b.atyid,
          pfid: b.pfid,
          sid: b.sid,
          trid: b.trid,
          // Merger (38) / Demerger (46, 47): under Sec 47(vii)/49(2), amalgamation
          // is not a "transfer" -- the ORIGINAL acquisition date of the pre-merger
          // holding should carry forward for holding-period purposes, not the
          // corporate-action date. This engine does not currently have access to
          // that original date (it processes one asset's transactions in
          // isolation and has no link back to the extinguished holding in the
          // other, pre-merger asset's transaction history), so `date` here is
          // the corporate-action date -- likely UNDERSTATING the true holding
          // period. Flagged via corpActionOrigin so results rows can carry a
          // visible warning instead of silently presenting a possibly-wrong
          // STCG/LTCG classification as certain.
          corpActionOrigin: [38, 46, 47].includes(trty)
        });
      }
    });

    // Process remaining sells against earlier delivery FIFO lots
    day.sells.forEach(s => {
      let delQty = s.remQty;
      if (delQty <= 0) return;

      const qn = Number(s.qn) || 0;
      const grossSellAmt = Number(s.amt) || (qn * (Number(s.netpr) || Number(s.purpr) || 0));
      const sellPrice = qn > 0 ? (grossSellAmt / qn) : (Number(s.netpr) || Number(s.purpr) || 0);
      const port = state.portfolios.find((p: any) => p.id === s.pfid);
      const isInPeriod = dt >= fromDate && dt <= toDate;

      while (delQty > 0.000001 && deliveryLots.length > 0) {
        const lot = deliveryLots[0];
        const mq = Math.min(delQty, lot.remaining);
        const cost = mq * lot.costPerUnit;
        const proceeds = mq * sellPrice;

        lot.remaining -= mq;
        delQty -= mq;

        if (isInPeriod) {
          const resolvedAtty = resolveAssetType(s.pfid, s.amid, s.atyid);
          const aname = getAssetName(s.amid);
          const taxRes = computeAssetTax(resolvedAtty, aname, cost, proceeds, lot.date || '', dt || '');
          const folio = getFolioNumber(s.sid || lot.sid, s.amid, s.pfid);

          const corpActionNote = lot.corpActionOrigin
            ? 'REVIEW: cost basis originates from a merger/demerger. Holding period is calculated from the corporate-action date -- Sec 47(vii)/49(2) may entitle this lot to an earlier original acquisition date from the pre-merger holding, which this engine cannot look up automatically. Verify manually before filing.'
            : '';

          results.push({
            portfolioId: s.pfid,
            portfolioName: port?.investor_name || `Portfolio ${s.pfid}`,
            assetName: aname,
            isin: getAssetISIN(s.amid) || s.isin || '',
            folio,
            amid: s.amid,
            assetType: resolvedAtty,
            assetTypeName: ASSET_TYPE_MAP[resolvedAtty] || 'Other',
            buyDate: lot.date,
            sellDate: dt,
            holdingDays: taxRes.holdingDays,
            quantity: mq,
            buyPrice: lot.costPerUnit,
            sellPrice,
            costBasis: taxRes.costBasis,
            saleProceeds: taxRes.saleProceeds,
            gainLoss: taxRes.gainLoss,
            gainType: taxRes.gainType,
            taxRate: typeof taxRes.taxRate === 'number' ? taxRes.taxRate : 30,
            estimatedTax: taxRes.estimatedTax,
            indexationUsed: taxRes.indexationUsed,
            notes: corpActionNote ? `${corpActionNote} ${taxRes.notes || ''}`.trim() : taxRes.notes,
            needsReview: !!lot.corpActionOrigin,
            realEstateComparison: taxRes.realEstateComparison
          });
        }

        if (lot.remaining <= 0.000001) deliveryLots.shift();
      }

      if (delQty > 0.000001 && isInPeriod) {
        const proceeds = delQty * sellPrice;
        const resolvedAtty = resolveAssetType(s.pfid, s.amid, s.atyid);
        const aname = getAssetName(s.amid);
        const purDt = (s.purdt || s.dt || '').slice(0, 10);
        const taxRes = computeAssetTax(resolvedAtty, aname, 0, proceeds, purDt, dt);
        const folio = getFolioNumber(s.sid, s.amid, s.pfid);

        results.push({
          portfolioId: s.pfid,
          portfolioName: port?.investor_name || `Portfolio ${s.pfid}`,
          assetName: aname,
          isin: getAssetISIN(s.amid) || s.isin || '',
          amid: s.amid,
          assetType: resolvedAtty,
          assetTypeName: ASSET_TYPE_MAP[resolvedAtty] || 'Other',
          buyDate: purDt,
          sellDate: dt,
          holdingDays: taxRes.holdingDays,
          quantity: delQty,
          buyPrice: 0,
          sellPrice,
          costBasis: 0,
          saleProceeds: proceeds,
          gainLoss: proceeds,
          gainType: taxRes.gainType,
          taxRate: typeof taxRes.taxRate === 'number' ? taxRes.taxRate : 30,
          estimatedTax: taxRes.estimatedTax,
          indexationUsed: taxRes.indexationUsed,
          notes: taxRes.notes,
          realEstateComparison: taxRes.realEstateComparison
        });
      }
    });
  });

  return { results, openLots: deliveryLots };
}

/**
 * Depletes a FIFO openLots array (as returned by buildAssetFifoLedger) by
 * `qty`, in lot order, WITHOUT mutating the input array or its lot objects.
 * Used by createVoucher() to cost a new manual sale against exactly the same
 * open-lot state the Capital Gains report would see for that asset as of
 * that date.
 */
export function depleteFifoLots(openLots: any[], qty: number): { totalCost: number; matchedLots: { date: string; qty: number; costPerUnit: number }[] } {
  let remaining = qty;
  let totalCost = 0;
  const matchedLots: { date: string; qty: number; costPerUnit: number }[] = [];
  for (const src of openLots) {
    if (remaining <= 0.000001) break;
    if (src.remaining <= 0.000001) continue;
    const mq = Math.min(remaining, src.remaining);
    totalCost += mq * src.costPerUnit;
    matchedLots.push({ date: src.date, qty: mq, costPerUnit: src.costPerUnit });
    remaining -= mq;
  }
  return { totalCost, matchedLots };
}

export interface PreCutoffPosition {
  pfid: number;
  amid: number;
  atyid: number;
  quantity: number;
  costBasis: number;
  avgRate: number;
  openLots: any[];
}

export interface PortfolioOpeningConsolidation {
  portfolioId: number;
  totalCost: number;
  positions: PreCutoffPosition[];
}

/**
 * Computes consolidated opening positions as of `cutoffDate` (default: '2015-04-01')
 * from raw pre-cutoff transaction history in bs1.
 *
 * Uses the exact same FIFO engine (buildAssetFifoLedger) that powers the Capital
 * Gains report, ensuring that:
 * 1. Fully-exited positions before cutoff (e.g. voucher 400 trade) leave 0 lots and vanish completely.
 * 2. Still-held positions carry forward their verified open delivery lots and weighted-average purchase cost.
 * 3. Pre-cutoff history is consolidated per-portfolio without cross-contamination.
 */
export function computePreCutoffOpeningPositions(
  bs1Rows: any[],
  cutoffDate: string = '2015-04-01'
): Map<number, PortfolioOpeningConsolidation> {
  const result = new Map<number, PortfolioOpeningConsolidation>();
  if (!bs1Rows || !Array.isArray(bs1Rows)) return result;

  // Filter strictly pre-cutoff records
  const preCutoffTxs = bs1Rows.filter((t: any) => (t.dt || '').slice(0, 10) < cutoffDate);

  // Group by pfid -> amid
  const groupedByPf = new Map<number, Map<number, any[]>>();
  preCutoffTxs.forEach((t: any) => {
    const pfid = Number(t.pfid);
    const amid = Number(t.amid);
    if (!pfid || !amid) return;

    if (!groupedByPf.has(pfid)) groupedByPf.set(pfid, new Map());
    const pfMap = groupedByPf.get(pfid)!;
    if (!pfMap.has(amid)) pfMap.set(amid, []);
    pfMap.get(amid)!.push(t);
  });

  for (const [pfid, assetMap] of groupedByPf.entries()) {
    const positions: PreCutoffPosition[] = [];
    let totalPortfolioCost = 0;

    for (const [amid, txs] of assetMap.entries()) {
      const sortedTxs = [...txs].sort((a: any, b: any) => (a.dt || '').localeCompare(b.dt || ''));
      const { openLots } = buildAssetFifoLedger(sortedTxs, '0001-01-01', cutoffDate, new Map(), {});

      const remainingQty = openLots.reduce((s: number, l: any) => s + (Number(l.remaining) || 0), 0);
      const totalCost = openLots.reduce((s: number, l: any) => s + ((Number(l.remaining) || 0) * (Number(l.costPerUnit) || 0)), 0);

      // Only remainingQty gates inclusion -- totalCost legitimately can be 0
      // (e.g. a pre-cutoff bonus-share holding with no purchase cost). Requiring
      // totalCost > 0 would silently drop that as if it were fully exited, which
      // it isn't.
      if (remainingQty > 0.000001) {
        const avgRate = totalCost > 0.000001 ? totalCost / remainingQty : 0;
        const atyid = openLots[0]?.atyid || sortedTxs[0]?.atyid || 50;

        positions.push({
          pfid,
          amid,
          atyid,
          quantity: Number(remainingQty.toFixed(4)),
          costBasis: Number(totalCost.toFixed(2)),
          avgRate: Number(avgRate.toFixed(4)),
          openLots
        });
        totalPortfolioCost += Number(totalCost.toFixed(2));
      }
    }

    if (positions.length > 0) {
      result.set(pfid, {
        portfolioId: pfid,
        totalCost: Number(totalPortfolioCost.toFixed(2)),
        positions
      });
    }
  }

  return result;
}

/**
 * @deprecated This function (and the pre-2015 bs1 consolidation feature it
 * powered) caused two confirmed live-data incidents: collapsing stock/MF
 * trade history into a single weighted-average position destroys the
 * individual lot dates and costs that determine STCG vs LTCG classification
 * for capital gains tax -- exactly the thing this app exists to get right.
 * Stocks and mutual funds must import with FULL, untouched trade history;
 * buildAssetFifoLedger already computes correct cost basis and holding
 * periods directly from that history, so there was never a real need to
 * synthesize a consolidated position for bs1 data at all.
 *
 * Kept in the codebase (unused) only so its history and the lessons in its
 * comments aren't lost. Do NOT wire this back into the import pipeline.
 * See computeLedgerOpeningBalanceGaps below for the correct fix to the
 * underlying problem this was trying to solve (missing opening value for
 * ledgers whose history predates MProfit's own accounting-module start
 * date) -- applied to the GENERAL LEDGER (transc1/acmac1) only, never to
 * bs1.
 */

export interface LedgerOpeningGap {
  ledgerId: number;
  acid: number;
  ledgerName: string;
  impliedOpeningBalance: number; // positive = net debit (asset-side), negative = net credit (liability-side)
}

/**
 * Computes the "implied opening balance" gap for every ledger: MProfit's own
 * ledger-master cr_bal/db_bal fields are CUMULATIVE LIFETIME TOTALS (all
 * credits ever, all debits ever) as of the export snapshot -- not merely an
 * opening balance. If a ledger's true history predates whatever date range
 * the imported transc1 rows actually cover (e.g. MProfit's own accounting
 * module only started tracking discrete transactions from a later date, with
 * everything before that folded into the cumulative totals with no
 * transaction-level detail exported at all), there will be a gap between
 * (db_bal - cr_bal) and the net of what actually got imported into transc1.
 *
 * Confirmed against real data: a PPF ledger's db_bal/cr_bal implied a
 * ₹11,02,943.23 opening balance with no corresponding transaction row
 * anywhere in the import, silently understating that ledger (and the
 * Balance Sheet) by exactly that amount. The same gap affects ANY ledger
 * with pre-accounting-module history -- bank accounts, jewellery, real
 * estate deposits, broker payables -- not just PPF.
 *
 * Deliberately operates on transc1/acmac1 only. bs1 (stock/MF trade
 * history) is a separate, parallel tracking system for FIFO cost basis and
 * is never touched here -- see the deprecation note above for why.
 *
 * @param acmac1Rows raw ledger-master rows (must include id, acid, name, cr_bal, db_bal, is_group)
 * @param transc1Rows raw transaction rows actually imported (must include maid, dramt, cramt)
 * @param threshold gaps smaller than this (in rupees) are ignored as rounding noise
 */
export function computeLedgerOpeningBalanceGaps(
  acmac1Rows: any[],
  transc1Rows: any[],
  threshold: number = 0.01
): LedgerOpeningGap[] {
  const netByLedger = new Map<number, number>();
  transc1Rows.forEach((t: any) => {
    const maid = Number(t.maid);
    const net = (Number(t.dramt) || 0) - (Number(t.cramt) || 0);
    netByLedger.set(maid, (netByLedger.get(maid) || 0) + net);
  });

  const gaps: LedgerOpeningGap[] = [];
  acmac1Rows.forEach((ledger: any) => {
    if (ledger.is_group) return; // groups don't carry their own balance
    const id = Number(ledger.id);
    const dbBal = Number(ledger.db_bal) || 0;
    const crBal = Number(ledger.cr_bal) || 0;
    const cumulativeNet = dbBal - crBal;
    const importedNet = netByLedger.get(id) || 0;
    const gap = cumulativeNet - importedNet;

    if (Math.abs(gap) >= threshold) {
      gaps.push({
        ledgerId: id,
        acid: Number(ledger.acid),
        ledgerName: ledger.name || `Ledger ${id}`,
        impliedOpeningBalance: Number(gap.toFixed(2)),
      });
    }
  });

  return gaps;
}

/**
 * Expands a set of portfolio/account ids to include everything linked to them
 * via accPflink (family/account groupings), following links in both
 * directions until no new ids are found. Shared by getCapitalGains() and the
 * XIRR engine (xirrEngine.ts) so "which portfolios belong together" can never
 * disagree between the two.
 */
export function expandPortfolioFamily(ids: (number | string)[]): number[] {
  const expandedSet = new Set<number>(ids.map(Number));
  let changed = true;
  while (changed) {
    const sizeBefore = expandedSet.size;
    state.accPflink.forEach((link: any) => {
      if (expandedSet.has(Number(link.acid))) expandedSet.add(Number(link.pfid));
      if (expandedSet.has(Number(link.pfid))) expandedSet.add(Number(link.acid));
    });
    if (expandedSet.size === sizeBefore) changed = false;
  }
  return Array.from(expandedSet);
}

export function getCapitalGains(portfolioIds: (number | string)[], fromDate: string, toDate: string) {
  const expandedSet = new Set<number>(expandPortfolioFamily(portfolioIds));

  const pSet = expandedSet;

  function getScnoteTransferCharges(sc: any, isSell: boolean) {
    if (!sc) return 0;
    let exp = (Number(sc.servtax) || 0) + (Number(sc.tranchrg) || 0) + (Number(sc.othchrg) || 0);
    let stamp = Number(sc.stmpchrgs) || 0;
    if (sc.cstr && typeof sc.cstr === 'string') {
      const parts = sc.cstr.split(';');
      parts.forEach((p: string) => {
        const [k, v] = p.split('=');
        const key = (k || '').trim().toUpperCase();
        const val = Number(v) || 0;
        if (['ST', 'TC', 'OC', 'GST', 'SEBI'].includes(key)) {
          exp += val;
        } else if (key === 'SC') {
          stamp += val;
        }
      });
    }
    return isSell ? exp : (exp + stamp);
  }

  // Build CN charges map: CNID -> { totalAmt, allowableExp }
  const cnTrades: Record<number, { totalAmt: number }> = {};
  state.bs1.forEach((t: any) => {
    const cnid = Number(t.cnid);
    if (!cnid || cnid <= 0) return;
    if (!cnTrades[cnid]) cnTrades[cnid] = { totalAmt: 0 };
    cnTrades[cnid].totalAmt += Number(t.amt) || 0;
  });

  const scMap = new Map<number, { sellExp: number; buyExp: number }>();
  (state.scnote1 || []).forEach((sc: any) => {
    const cnid = Number(sc.cnid);
    if (!cnid || cnid <= 0) return;
    scMap.set(cnid, {
      sellExp: getScnoteTransferCharges(sc, true),
      buyExp: getScnoteTransferCharges(sc, false)
    });
  });

  // Group transactions by (pfid, amid, sid for mutual funds/schemes)
  const allTx = state.bs1
    .filter((t: any) => {
      if (!pSet.has(Number(t.pfid))) return false;
      const atyid = Number(t.atyid);
      // Exclude Derivatives / F&O (Futures & Options) as they are Business Income (PGBP under Sec 43(5)), not Capital Gains
      if ([30, 80, 81, 82, 83].includes(atyid)) return false;
      return true;
    })
    .sort((a: any, b: any) => (a.dt || '').localeCompare(b.dt || ''));

  const txByAsset: Record<string, any[]> = {};
  allTx.forEach((t: any) => {
    const isMf = t.atyid === 60 || t.atyid === 61 || t.atyid === 62;
    const sidKey = (isMf && t.sid) ? `_${t.sid}` : '';
    const key = `${t.pfid}_${t.amid}${sidKey}`;
    if (!txByAsset[key]) txByAsset[key] = [];
    txByAsset[key].push(t);
  });

  const results: any[] = [];

  Object.values(txByAsset).forEach(txList => {
    const ledger = buildAssetFifoLedger(txList, fromDate, toDate, scMap, cnTrades);
    results.push(...ledger.results);
  });

  // IMPORTANT: this only computes the correct Sec 112A exemption when
  // [fromDate, toDate] spans a FULL financial year (e.g. 2024-04-01 to
  // 2025-03-31). If this is called for a partial period (e.g. one quarter),
  // the exemption is calculated only against that partial window's LTCG,
  // which will over-exempt if the report is run repeatedly for sub-periods
  // of the same FY. For anything other than a full-FY call, treat the
  // exemption/estimatedTax figures here as indicative, not final.
  applySection112AExemption(results);

  return results;
}

// ── VOUCHER HELPERS ───────────────────────────────────────────────────────────
export function getNextVoucherNo(type: string, fy: string): string {
  const prefix = ({receipt:'RCPT',payment:'PAY',journal:'JRN',contra:'CON'} as any)[type.toLowerCase()] || 'VCH';
  const count = state.vouchersC1.filter((v: any) => String(v.vtyp) === type).length + 1;
  return `${prefix}-${count.toString().padStart(4,'0')}`;
}

export function getVoucherById(id: string | number) {
  const strId = String(id || '');
  const isExplicitTrid = strId.startsWith('trid_');
  const numId = isExplicitTrid ? Number(strId.replace('trid_', '')) : Number(id);

  function formatBs1Voucher(tx: any) {
    const resolvedAcid = getAccountForPortfolio(tx.pfid) || tx.acid;
    const isBuy = [19, 20, 12, 25, 30, 35, 36, 37, 38, 39, 40, 45, 46, 47, 48, 49].includes(tx.trty);
    const isMf = tx.atyid === 60 || tx.atyid === 61 || tx.atyid === 62;
    const qty = Number(tx.qn) || 0;
    const price = Number(tx.purpr) || 0;
    const amount = Number(tx.amt) || 0;
    const brokerage = Number(tx.brkg) || 0;
    const charges = Number(tx.chrgs) || 0;
    const ledgers = getStoredLedgers(resolvedAcid);
    const bankLedger = ledgers.find((l: any) => l.name.toLowerCase().includes('bank')) || ledgers[0] || { id: 'Bank', name: 'Bank' };
    const brokerLedger = ledgers.find((l: any) => l.groupId === '75') || ledgers[0] || { id: 'Broker', name: 'Broker' };
    const counterLedgerId = isMf ? bankLedger.id : brokerLedger.id;
    
    const assetLedger = state.acmac1.find((l: any) => l.id === tx.amid || l.id === (500000 + tx.amid)) || { id: String(tx.amid), name: getAssetName(tx.amid) };

    const lines: any[] = [
      {
        id: `asset_${tx.trid}`,
        ledgerId: String(assetLedger.id),
        ledgerName: assetLedger.name || getAssetName(tx.amid),
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
        ledgerId: 'charges',
        ledgerName: 'Stamp & Other Charges',
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
      id: 'trid_' + tx.trid,
      voucherNo: `BS-${tx.trid}`,
      date: (tx.dt || '').substring(0, 10),
      type: isMf ? 'contra' : (isBuy ? 'purchase' : 'sale'),
      portfolioId: String(tx.pfid),
      accountId: resolvedAcid ? String(resolvedAcid) : undefined,
      narration: tx.narr || '',
      lines
    };
  }

  function formatAccountingVoucher(v: any, transSrc: any[]) {
    const vtypMap: Record<number, string> = { 2: 'payment', 4: 'receipt', 5: 'journal', 14: 'purchase', 15: 'sale' };
    return { 
      ...v, 
      id: String(v.vid), 
      type: vtypMap[v.vtyp] || 'journal',
      voucherNo: v.vchno || '',
      date: v.dt || '',
      accountId: v.acid ? String(v.acid) : '',
      narration: v.narr || '',
      portfolioId: v.pfid ? String(v.pfid) : (state.bs1.find((t: any) => Number(t.acvch) === v.vid)?.pfid ? String(state.bs1.find((t: any) => Number(t.acvch) === v.vid).pfid) : undefined),
      lines: transSrc
        .filter((e: any) => e.vid === v.vid)
        .map((e: any) => {
          const isAsset = Number(e.maid) >= 100000;
          let bsTx = null;
          if (isAsset) {
            const ledgerObj = state.acmac1.find((l: any) => l.id === Number(e.maid));
            const ledgerName = ledgerObj ? ledgerObj.name.toLowerCase().replace(/[^a-z0-9]/g, '') : '';
            const matchingTxs = state.bs1.filter((t: any) => Number(t.acvch) === v.vid || (v.cnid && t.cnid === v.cnid));
            
            if (matchingTxs.length === 1) {
              bsTx = matchingTxs[0];
            } else if (matchingTxs.length > 1 && ledgerName) {
              bsTx = matchingTxs.find((t: any) => {
                const anm = (state.assetNameMap[t.amid] || '').toLowerCase().replace(/[^a-z0-9]/g, '');
                return ledgerName.startsWith(anm) || anm.startsWith(ledgerName);
              }) || matchingTxs[0];
            }
          }
          const ledgerObj = state.acmac1.find((l: any) => l.id === Number(e.maid));
          const rawAmid = Number(e.maid) >= 500000 ? Number(e.maid) - 500000 : Number(e.maid);
          const lName = ledgerObj?.name || state.assetNameMap[e.maid] || state.assetNameMap[rawAmid] || getAssetName(rawAmid) || `Ledger ${e.maid}`;
          return {
            id: String(e.transid),
            ledgerId: String(e.maid),
            ledgerName: lName,
            debit: Number(e.dramt) || 0,
            credit: Number(e.cramt) || 0,
            narration: e.narr || '',
            quantity: bsTx ? Number(bsTx.qn) || 0 : 0,
            price: bsTx ? Number(bsTx.purpr) || 0 : 0
          };
        })
    };
  }

  // 0. If explicit TRID or passed as trid_ prefix, resolve BS1 trade directly
  if (isExplicitTrid) {
    const tx = state.bs1.find((t: any) => t.trid === numId);
    if (tx) {
      let v = null;
      let transSrc = state.transC1;
      const linkedVid = Number(tx.acvch);
      if (linkedVid && !isNaN(linkedVid)) {
        v = state.vouchersC1.find((v: any) => v.vid === linkedVid);
        if (!v) {
          v = state.vouchers1.find((v: any) => v.vid === linkedVid);
          transSrc = state.trans1;
        }
      }
      if (!v && tx.cnid && Number(tx.cnid) > 0) {
        v = state.vouchersC1.find((v: any) => v.cnid === Number(tx.cnid));
        if (!v) {
          v = state.vouchers1.find((v: any) => v.cnid === Number(tx.cnid));
          transSrc = state.trans1;
        }
      }
      if (v) {
        return formatAccountingVoucher(v, transSrc);
      }
      return formatBs1Voucher(tx);
    }
  }

  // 1. Check direct VID match in vouchersC1 / vouchers1
  let v = state.vouchersC1.find((v: any) => v.vid === numId);
  let transSrc = state.transC1;
  if (!v) {
    v = state.vouchers1.find((v: any) => v.vid === numId);
    transSrc = state.trans1;
  }
  
  // 2. If not found by direct VID, check if id is a bs1 TRID linking to a voucher via acvch or cnid
  if (!v) {
    const tx = state.bs1.find((t: any) => t.trid === numId);
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
      if (!v && tx.cnid && Number(tx.cnid) > 0) {
        v = state.vouchersC1.find((v: any) => v.cnid === Number(tx.cnid));
        if (!v) {
          v = state.vouchers1.find((v: any) => v.cnid === Number(tx.cnid));
          transSrc = state.trans1;
        }
      }
      if (!v) {
        return formatBs1Voucher(tx);
      }
    }
  }

  if (!v) return null;
  return formatAccountingVoucher(v, transSrc);
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

export const ASSET_GROUP_IDS = [200050, 200051, 200061, 200062, 200075, 200077, 200040, 200070, 200058, 200155, 200150, 200145, 200160, 200095, 200115, 200120, 200135, 200140, 200141, 200195, 36, 75];

/**
 * Given one voucher line, resolves its amid (asset master id) and builds the
 * bs1 row it should produce -- the SAME logic createVoucher() has always used
 * for its single-voucher path, extracted so createVouchersBulk() can share it
 * exactly rather than needing its own re-implementation (which previously
 * didn't exist at all -- bulk-imported trades never reached bs1, see the
 * Step-6/7 audit notes).
 *
 * `trid` is passed in (not computed via nextTrid()) so a caller processing
 * many lines/vouchers in one batch can allocate a distinct, sequential trid
 * per line without re-querying state.bs1 on every call (which would be
 * O(n^2) for a large bulk import and, until the final batched write, would
 * not yet reflect earlier rows in the same batch anyway).
 */
export function resolveAssetLineToBsRow(
  data: any,
  assetLine: any,
  pfid: number,
  vid: number,
  trid: number,
  linesToProcessCount: number
): { bsRow: any; amid: number } | null {
  if (!assetLine) return null;
  let amid = assetLine.amid ? Number(assetLine.amid) : (data.assetId ? Number(data.assetId) : undefined);

  if (!amid) {
    const ledgerIdNum = Number(assetLine.ledgerId);
    const ledger = state.acmac1.find((l: any) => l.id === ledgerIdNum);
    if (ledger) {
      if (ledger.exint1) amid = Number(ledger.exint1);
      if (!amid) {
        const cleanLedgerName = ledger.name.toLowerCase().replace(/[^a-z0-9]/g, '');
        const matchedAsset = state.assetMaster.find((a: any) => {
          const cleanAssetName = a.name.toLowerCase().replace(/[^a-z0-9]/g, '');
          return cleanAssetName === cleanLedgerName || cleanAssetName.startsWith(cleanLedgerName) || cleanLedgerName.startsWith(cleanAssetName);
        }) || state.sam.find((s: any) => {
          const cleanAssetName = s.anm.toLowerCase().replace(/[^a-z0-9]/g, '');
          return cleanAssetName === cleanLedgerName || cleanAssetName.startsWith(cleanLedgerName) || cleanLedgerName.startsWith(cleanAssetName);
        });
        if (matchedAsset) amid = matchedAsset.amid;
      }
    }
    if (!amid) amid = ledgerIdNum;
  }

  if (!amid) return null;

  const isAddQtyType = data.type === 'bonus' || data.type === 'split' || data.type === 'rights' || data.type === 'ipo' || data.type === 'reinvest';
  const isBuy = isAddQtyType || (assetLine ? (assetLine.tradeType === 'BUY' || Number(assetLine.debit) > 0) : (data.type !== 'dividend' && data.type !== 'buyback' && data.type !== 'writeoff'));
  const qty = Number(assetLine.quantity) || (linesToProcessCount === 1 ? Number(data.quantity) || 0 : 0);
  const price = Number(assetLine.price) || (linesToProcessCount === 1 ? Number(data.price) || 0 : 0);
  const amt = Number(assetLine.debit) || Number(assetLine.credit) || (linesToProcessCount === 1 ? Number(data.amount) || qty * price || 0 : qty * price);

  const asset = state.assetMaster.find((a: any) => a.amid === amid);
  const atyid = asset ? asset.asset_type : (assetLine.atyid ? Number(assetLine.atyid) : 50);

  let trty = isBuy ? 20 : 99;
  let trstr = isBuy ? 'Buy' : 'Sell';

  if (data.isOpeningBalance || data.type === 'opening_balance') {
    trty = 19;
    trstr = 'Opening Balance';
  } else if (data.type === 'dividend') {
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
    if (isBuy) {
      // Inflow (new/merged-into company) leg: use 38 so the FIFO engine
      // picks this up as a buy (FIFO_BUY_TRTY) and the Step-4
      // corpActionOrigin review-flag fires on it.
      trty = 38;
    } else {
      // Outflow (original/merging-away company) leg: explicitly pinned to
      // 45 (matching this app's original, pre-audit behavior) rather than
      // left at the generic default of 99 (a regular sell). 99 would make
      // the FIFO engine treat the merger as an actual taxable "transfer" of
      // the old holding -- fabricating a capital-gains event that Sec 47(vii)
      // explicitly says a genuine amalgamation is NOT. 45 is a no-op in the
      // FIFO engine (it's not picked up as a buy or a sell), which does NOT
      // correctly close out the old holding either -- but that is a smaller,
      // visible problem (a stale open lot) than an invented tax liability. A
      // real fix needs a dedicated trty code and product decision, not a
      // guess made here.
      trty = 45;
    }
    trstr = '*Merged';
  } else if (data.type === 'writeoff') {
    trty = 99;
    trstr = 'Write Off';
  }

  const bsRow = {
    trid,
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

  return { bsRow, amid };
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
    const isBuy = [19, 20, 12, 25, 30, 35, 36, 37, 38, 39, 40, 45, 46, 47, 48, 49].includes(t.trty);
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
      const localIdx = state.sumTable.findIndex(s => String(s.sid) === String(existing[0].sid));
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

/**
 * Classifies a voucher line's cash-flow nature, per corrected Jcode point 1.
 * This DOCUMENTS the distinction the existing `assetLines` filter (below,
 * in createVoucher/createVouchersBulk) already enforces -- only lines that
 * classify as 'ASSET' ever contribute to quantity totals (bs1/sum_table).
 * Lines classified INCOME/EXPENSE/INTERNAL never carry a `quantity` in this
 * app's data model, so they were never actually at risk of double-counting
 * a position -- but naming the categories explicitly here makes that
 * guarantee auditable rather than implicit in a set of unlabeled conditions.
 *
 * NOTE: only the ASSET/NON_ASSET distinction is asserted with confidence --
 * ASSET_GROUP_IDS is the one list actually verified against this app's real
 * Chart of Accounts (it's the same list resolveAssetLineToBsRow already
 * uses). The finer INFLOW/OUTFLOW/INCOME/INTERNAL breakdown Gemini's
 * proposal asked for would need the actual cash/bank/income group ids from
 * your live acmac1 table (run SCHEMA_EXPORT_INSTRUCTIONS.md and check the
 * `groups` table) before those can be asserted as fact rather than guessed --
 * left as 'NON_ASSET' pending that confirmation rather than fabricating ids.
 */
export function classifyLedgerFlow(ledgerId: number): 'ASSET' | 'NON_ASSET' | 'UNKNOWN' {
  if (ledgerId >= 500000) return 'ASSET'; // synthetic asset-ledger id range used elsewhere in this file
  const ledger = state.acmac1.find((a: any) => a.id === ledgerId);
  if (!ledger) return 'UNKNOWN';
  return ASSET_GROUP_IDS.includes(Number(ledger.parent_id)) ? 'ASSET' : 'NON_ASSET';
}

export async function createVoucher(data: any, reuseVid?: number) {
  const acid = data.accountId ? Number(data.accountId) : null;
  const vtyp = VTYP_MAP[data.type] ?? 5; // default journal

  // 1. Insert voucher into vouchersc1, retrying with a higher vid on
  // collision. vid is computed as max(existing)+1 in JS (not database-
  // generated), which was found to be a real, confirmed cause of data loss
  // when called rapidly across many portfolios in one run (the pre-2015
  // consolidation post-mortem) -- see the identical fix in
  // ensureLedgerExists. Previously ANY insert failure here threw
  // immediately, uncaught, which is what silently aborted the entire
  // remaining consolidation loop after the first portfolio succeeded.
  let vid!: number;
  let voucherRow: any;
  {
    const MAX_ATTEMPTS = 10;
    let lastError: any = null;
    let inserted = false;
    for (let attempt = 0; attempt < MAX_ATTEMPTS && !inserted; attempt++) {
      vid = reuseVid ?? (nextVid() + attempt);
      voucherRow = {
        vid,
        acid,
        dt: data.date,
        narr: data.narration || '',
        vtyp,
        pfid: data.portfolioId ? Number(data.portfolioId) : null,
      };
      const { error: vErr } = await supabase.from('vouchersc1').insert(voucherRow);
      if (!vErr) {
        inserted = true;
        break;
      }
      lastError = vErr;
      const isConflict = (vErr as any).code === '23505' || /duplicate key/i.test(vErr.message || '');
      if (reuseVid || !isConflict || attempt === MAX_ATTEMPTS - 1) {
        console.error('❌ Failed to save voucher:', vErr.message);
        throw new Error(`Failed to save voucher: ${vErr.message}`);
      }
      console.warn(`⚠️ voucher vid ${vid} collided (attempt ${attempt + 1}/${MAX_ATTEMPTS}), retrying with a higher vid...`);
    }
    if (!inserted) {
      throw new Error(`Failed to save voucher: ${lastError?.message || 'unknown error'}`);
    }
  }

  // 2. Process lines to auto-book P&L for Asset Sales
  let rawLines = (data.lines || []).filter((l: any) => l.ledgerId && (Number(l.debit) > 0 || Number(l.credit) > 0 || data.type === 'bonus' || data.type === 'split' || data.type === 'merger' || data.type === 'demerger'));
  
  const processedLines: any[] = [];
  const pfid = data.portfolioId ? Number(data.portfolioId) : null;

  for (const l of rawLines) {
    const isSale = (data.type === 'payment' || data.type === 'sale') && Number(l.credit) > 0;
    const qtySold = Number(l.quantity);

    if (isSale && qtySold > 0 && pfid) {
      // Find AMID
      const ledgerIdNum = Number(l.ledgerId);
      let amid = null;
      const ledger = state.acmac1.find((a: any) => a.id === ledgerIdNum);
      if (ledger) {
        const cleanLedgerName = ledger.name.toLowerCase().replace(/[^a-z0-9]/g, '');
        const matchedAsset = state.assetMaster.find((a: any) => {
          const c = a.name.toLowerCase().replace(/[^a-z0-9]/g, '');
          return c === cleanLedgerName || c.startsWith(cleanLedgerName) || cleanLedgerName.startsWith(c);
        }) || state.sam.find((s: any) => {
          const c = s.anm.toLowerCase().replace(/[^a-z0-9]/g, '');
          return c === cleanLedgerName || c.startsWith(cleanLedgerName) || cleanLedgerName.startsWith(c);
        });
        if (matchedAsset) amid = matchedAsset.amid;
        else amid = ledgerIdNum;
      } else {
        amid = ledgerIdNum;
      }

      if (amid) {
        // Calculate FIFO cost using the SAME lot-building engine as the Capital
        // Gains report (buildAssetFifoLedger), instead of a separate inline
        // implementation. This guarantees the P&L booked on a manual sale
        // voucher matches what the Capital Gains report would compute for the
        // identical trade — previously the two used different buy/sell
        // transaction-type sets and this copy skipped stock-split adjustment
        // and the settlement-cover heuristic entirely, so the two could and
        // did diverge.
        const priorTxForAsset = state.bs1
          .filter((t: any) => t.pfid === pfid && t.amid === amid && (t.dt || '') <= (data.date || '') && (FIFO_BUY_TRTY.has(Number(t.trty)) || FIFO_SELL_TRTY.has(Number(t.trty)) || [85, 45].includes(Number(t.trty))))
          .sort((a: any, b: any) => (a.dt || '').localeCompare(b.dt || ''));

        // scMap/cnTrades affect only the *realized-gain rows* buildAssetFifoLedger
        // would return, not the open-lot quantities/costs we need here, so empty
        // maps are safe — we only consume `openLots` below.
        const { openLots } = buildAssetFifoLedger(priorTxForAsset, '0001-01-01', data.date, new Map(), {});
        const { totalCost, matchedLots } = depleteFifoLots(openLots, qtySold);

        // Persist which lot(s) this sale actually consumed -- a queryable
        // audit trail for "why did this sale cost what it did," per the
        // corrected Jcode point 2 (see supabase_step8_precision_and_audit.sql).
        // This does NOT feed back into any calculation -- buildAssetFifoLedger
        // keeps recomputing fresh from bs1 every time, as it always has.
        // Non-blocking: an audit-trail write failure shouldn't prevent the
        // actual sale from being recorded.
        if (matchedLots.length > 0) {
          const consumptionRows = matchedLots.map(m => ({
            vid,
            pfid,
            amid,
            sell_date: data.date,
            lot_date: m.date,
            qty_consumed: m.qty,
            cost_per_unit: m.costPerUnit,
            cost_consumed: m.qty * m.costPerUnit,
          }));
          supabase.from('tax_lot_consumption').insert(consumptionRows).then(({ error }) => {
            if (error) console.error('⚠️ Failed to write tax_lot_consumption audit trail (sale itself was NOT affected):', error.message);
          });
        }

        const proceeds = Number(l.credit);
        const gain = proceeds - totalCost;

        // Determine asset type for correct STCG/LTCG ledger
        // Exact ledger IDs from Chart of Accounts (Capital Gains group id=180)
        const GAIN_LEDGERS = {
          STCG_EQUITY: 460,  // Short Term Gain (Equity)  — >12 months
          LTCG_EQUITY: 465,  // Long Term Gain (Equity)
          STCG_DEBT:   470,  // Short Term Gain (Debt)    — >36 months
          LTCG_DEBT:   475,  // Long Term Gain (Debt)
          STCG_BONDS:  490,  // Short Term Gain (Bonds)   — >36 months
          LTCG_BONDS:  485,  // Long Term Gain (Bonds)
        };

        // Earliest matched lot date, for holding-period calculation — same
        // definition the Capital Gains report uses per matched lot, simplified
        // here to the earliest lot consumed by this sale.
        const firstBuyDate = matchedLots.length > 0 ? matchedLots[0].date : data.date;
        const holdingDays = Math.abs((new Date(data.date).getTime() - new Date(firstBuyDate).getTime()) / 86400000);

        // Find asset type (atyid) from bs1
        const bs1Asset = state.bs1.find((t: any) => t.pfid === pfid && t.amid === amid);
        const atyid = bs1Asset?.atyid || 0;

        const EQUITY_GROUPS = new Set([200050, 200051, 200061, 50]);
        const DEBT_GROUPS   = new Set([200062, 200058]);
        const BOND_GROUPS   = new Set([200040, 200070]);

        let gainLedgerId: number;
        if (EQUITY_GROUPS.has(atyid)) {
          gainLedgerId = holdingDays > 365  ? GAIN_LEDGERS.LTCG_EQUITY : GAIN_LEDGERS.STCG_EQUITY;
        } else if (DEBT_GROUPS.has(atyid)) {
          gainLedgerId = holdingDays > 1095 ? GAIN_LEDGERS.LTCG_DEBT   : GAIN_LEDGERS.STCG_DEBT;
        } else if (BOND_GROUPS.has(atyid)) {
          gainLedgerId = holdingDays > 1095 ? GAIN_LEDGERS.LTCG_BONDS  : GAIN_LEDGERS.STCG_BONDS;
        } else {
          // Default: treat as equity
          gainLedgerId = holdingDays > 365  ? GAIN_LEDGERS.LTCG_EQUITY : GAIN_LEDGERS.STCG_EQUITY;
        }

        // Push Asset Line (Cost Basis only)
        processedLines.push({ ...l, credit: totalCost });

        // Push Gain/Loss Line to correct STCG/LTCG ledger
        if (gain > 0) {
          processedLines.push({ ledgerId: gainLedgerId, debit: 0, credit: gain });
        } else if (gain < 0) {
          processedLines.push({ ledgerId: gainLedgerId, debit: Math.abs(gain), credit: 0 });
        }
        continue; // Skip pushing the original line
      }
    }
    processedLines.push(l);
  }

  const lines = processedLines;

  // ── Voucher balance validation ────────────────────────────────────────────
  // Previously NOTHING checked that a voucher's total debits equalled its
  // total credits before writing it to transc1 -- the only such check
  // (validateVoucher/validateDebitCredit) lived in src/accounting-engine/,
  // which is never imported anywhere and was dead code. This enforces it
  // directly, scoped to standard double-entry voucher types only.
  //
  // Corporate-action types (bonus/split/merger/demerger/ipo/buyback) are
  // deliberately EXCLUDED here: split records a quantity-only line (debit=0,
  // credit=0 by design), and demerger currently writes only ONE line (debit,
  // no offsetting credit) in PMSCorporateActionModal.tsx -- see the comment
  // there. That looks like it may be its own separate accounting-treatment
  // issue, but fixing it requires understanding the intended double-entry
  // design (does the original asset ledger get credited? does a capital
  // account absorb the difference?), which wasn't specified anywhere I could
  // find. Flagging it rather than guessing at a fix here.
  const STRICT_BALANCE_TYPES = new Set(['payment', 'receipt', 'journal', 'contra', 'sale', 'opening_balance']);
  if (STRICT_BALANCE_TYPES.has(data.type)) {
    const totalDebit = lines.reduce((s: number, l: any) => s + (Number(l.debit) || 0), 0);
    const totalCredit = lines.reduce((s: number, l: any) => s + (Number(l.credit) || 0), 0);
    const diff = Math.abs(totalDebit - totalCredit);
    if (diff >= 0.01) {
      // Roll back the voucher header already inserted above so no orphan
      // record is left behind.
      await supabase.from('vouchersc1').delete().eq('vid', vid);
      throw new Error(
        `Voucher is not balanced: total debit ₹${totalDebit.toFixed(2)} vs total credit ₹${totalCredit.toFixed(2)} (difference ₹${diff.toFixed(2)}). Voucher was not saved.`
      );
    }
  }

  let transRows: any[] = [];
  {
    const MAX_ATTEMPTS = 10;
    let inserted = false;
    let lastError: any = null;
    for (let attempt = 0; attempt < MAX_ATTEMPTS && !inserted; attempt++) {
      let currentTransid = nextTransid() + attempt * lines.length;
      transRows = lines.map((line: any) => ({
        transid: currentTransid++,
        vid,
        acid,
        maid: Number(line.ledgerId),
        dramt: Number(line.debit) || 0,
        cramt: Number(line.credit) || 0,
        dt: data.date,
      }));

      if (transRows.length === 0) {
        inserted = true;
        break;
      }

      const { error: tErr } = await supabase.from('transc1').insert(transRows);
      if (!tErr) {
        inserted = true;
        break;
      }
      lastError = tErr;
      const isConflict = (tErr as any).code === '23505' || /duplicate key/i.test(tErr.message || '');
      if (!isConflict || attempt === MAX_ATTEMPTS - 1) {
        console.error('❌ Failed to save entries:', tErr.message);
        await supabase.from('vouchersc1').delete().eq('vid', vid);
        throw new Error(`Failed to save entries: ${tErr.message}`);
      }
      console.warn(`⚠️ transc1 transid batch starting at ${currentTransid - transRows.length} collided (attempt ${attempt + 1}/${MAX_ATTEMPTS}), retrying with higher ids...`);
    }
    if (!inserted) {
      await supabase.from('vouchersc1').delete().eq('vid', vid);
      throw new Error(`Failed to save entries: ${lastError?.message || 'unknown error'}`);
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

    // Find all lines representing distinct asset holdings/trades
    const assetLines = (data.lines || []).filter((l: any) => {
      if (l.amid && Number(l.amid) > 0) return true;
      if (Number(l.quantity) > 0 || Number(l.price) > 0) return true;
      const ledgerIdNum = Number(l.ledgerId);
      if (ledgerIdNum >= 500000) return true;
      const ledger = state.acmac1.find((a: any) => a.id === ledgerIdNum);
      if (ledger && ASSET_GROUP_IDS.includes(Number(ledger.parent_id))) return true;
      return false;
    });

    const linesToProcess = assetLines.length > 0 ? assetLines : [data.lines[0]];
    const CORP_ACTION_TYPES = new Set(['split', 'bonus', 'merger', 'demerger']);

    for (const assetLine of linesToProcess) {
      let bsRow: any = null;
      let amid: number | undefined;
      {
        const MAX_ATTEMPTS = 10;
        let inserted = false;
        for (let attempt = 0; attempt < MAX_ATTEMPTS && !inserted; attempt++) {
          const resolved = resolveAssetLineToBsRow(data, assetLine, pfid, vid, nextTrid() + attempt, linesToProcess.length);
          if (!resolved) break;
          bsRow = resolved.bsRow;
          amid = resolved.amid;

          const { error: bsErr } = await supabase.from('bs1').insert(bsRow);
          if (!bsErr) {
            inserted = true;
            break;
          }
          const isConflict = (bsErr as any).code === '23505' || /duplicate key/i.test(bsErr.message || '');
          if (!isConflict || attempt === MAX_ATTEMPTS - 1) {
            console.error('❌ Failed to insert into bs1:', bsErr.message);
            bsRow = null; // signal failure to the block below
            break;
          }
          console.warn(`⚠️ bs1 trid ${bsRow.trid} collided (attempt ${attempt + 1}/${MAX_ATTEMPTS}), retrying with a higher trid...`);
        }
      }
      if (!bsRow || amid === undefined) continue;

      state.bs1.push({ ...bsRow, _src: 'c' });
      await syncPortfolioStats(pfid, amid);

      // Corrected Jcode point 3: pure event log, no trigger, no mutation
      // of bs1/sum_table/anything else -- see the rationale in
      // supabase_step8_precision_and_audit.sql. Purely for reporting/
      // display convenience; bs1 remains the actual source of truth.
      if (CORP_ACTION_TYPES.has(data.type)) {
        supabase.from('corporate_actions').insert({
          pfid,
          amid,
          action_type: data.type,
          action_date: data.date,
          ratio_or_pct: data.costAllocationPct ?? data.ratio ?? null,
          related_amid: data.assetId && Number(data.assetId) !== amid ? Number(data.assetId) : null,
          vid,
          narration: data.narration || '',
        }).then(({ error }) => {
          if (error) console.error('⚠️ Failed to write corporate_actions log entry (bs1 record was NOT affected):', error.message);
        });
      }
    }
  }
}

export async function updateVoucher(data: any) {
  let rawVid = null;
  if (data.id) {
    const match = String(data.id).match(/\d+/);
    if (match) {
      let candidateVid = Number(match[0]);

      // If the passed id was a bs1 trid, we need to find the actual voucher vid (acvch)
      const bsMatch = state.bs1.find((t: any) => t.trid === candidateVid);
      if (bsMatch && bsMatch.acvch) {
        candidateVid = Number(bsMatch.acvch);
      }

      const exists = state.vouchersC1.some((v: any) => v.vid === candidateVid) ||
                     state.vouchers1.some((v: any) => v.vid === candidateVid) ||
                     state.bs1.some((t: any) => t.trid === candidateVid || Number(t.acvch) === candidateVid);
      if (exists) {
        rawVid = candidateVid;
      }
    }
  }

  if (rawVid && !isNaN(rawVid)) {
    const txs = state.bs1.filter((t: any) => t.trid === rawVid || Number(t.acvch) === rawVid);
    const affectedStats = txs.map((t: any) => ({ pfid: t.pfid, amid: t.amid })).filter(t => t.pfid && t.amid);

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

    for (const stat of affectedStats) {
      await syncPortfolioStats(stat.pfid, stat.amid);
    }
  }
  await createVoucher(data, rawVid || undefined);
}

export async function deleteVoucher(id: any) {
  let rawVid = null;
  if (id) {
    const match = String(id).match(/\d+/);
    if (match) {
      let candidateVid = Number(match[0]);
      
      // If the passed id was a bs1 trid, we need to find the actual voucher vid (acvch)
      const bsMatch = state.bs1.find((t: any) => t.trid === candidateVid);
      if (bsMatch && bsMatch.acvch) {
        candidateVid = Number(bsMatch.acvch);
      }

      const exists = state.vouchersC1.some((v: any) => v.vid === candidateVid) ||
                     state.vouchers1.some((v: any) => v.vid === candidateVid) ||
                     state.bs1.some((t: any) => t.trid === candidateVid || Number(t.acvch) === candidateVid);
      if (exists) {
        rawVid = candidateVid;
      }
    }
  }
  if (rawVid && !isNaN(rawVid)) {
    const txs = state.bs1.filter((t: any) => t.trid === rawVid || Number(t.acvch) === rawVid);
    const affectedStats = txs.map((t: any) => ({ pfid: t.pfid, amid: t.amid })).filter(t => t.pfid && t.amid);

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

    for (const stat of affectedStats) {
      await syncPortfolioStats(stat.pfid, stat.amid);
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
    capital: 1,
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

  // Id allocation for new ledgers: `id` is a GLOBAL primary key shared across
  // EVERY account's ledgers (not scoped per acid), computed here in JS as
  // max(existing ids) + 1, rather than database-generated. This was found to
  // be a real, confirmed data-loss bug when called rapidly across many
  // accounts in one run (see the pre-2015 consolidation post-mortem): the
  // live database had 730 ledger rows packed into an id range of only 671,
  // essentially zero headroom, and any staleness between the in-memory
  // state.acmac1 snapshot and the true DB state (or any other process
  // touching this table concurrently) produces a primary-key collision,
  // which previously surfaced as a silent, uncaught INSERT failure --
  // dropping the entire ledger (and, upstream, the entire asset position
  // that depended on it) with only a console.error and no retry.
  //
  // This retries with an incrementing id on a detected primary-key conflict,
  // re-reading the current max from state.acmac1 each attempt (which is kept
  // in sync via the push() below after every successful insert).
  const MAX_ATTEMPTS = 10;
  for (let attempt = 0; attempt < MAX_ATTEMPTS; attempt++) {
    const allIds = state.acmac1.map((a: any) => Number(a.id)).filter(id => id < 100000);
    const nextId = (allIds.length > 0 ? Math.max(...allIds) : 1000) + 1 + attempt;

    const newRow = {
      id: nextId,
      name,
      parent_id: parentId,
      is_group: false,
      acid: acidNum,
      special_type_id: 150
    };

    const { error } = await supabase.from('acmac1').insert(newRow);
    if (!error) {
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

    // Primary-key/unique-constraint violation: retry with a higher id.
    // Postgres error code 23505, or a message containing "duplicate key".
    const isConflict = (error as any).code === '23505' || /duplicate key/i.test(error.message || '');
    if (isConflict && attempt < MAX_ATTEMPTS - 1) {
      console.warn(`⚠️ ledger id ${nextId} collided (attempt ${attempt + 1}/${MAX_ATTEMPTS}), retrying with a higher id...`);
      continue;
    }

    console.error('❌ Failed to insert ledger into acmac1:', error.message);
    throw new Error(`Failed to create ledger: ${error.message}`);
  }

  return null;
}

export async function updateAssetPrice(assetId: string, price: number) {
  const amidNum = Number(assetId);
  if (isNaN(amidNum)) return;

  const todayStr = new Date().toISOString().split('T')[0];
  const asset = state.assetMaster.find((a: any) => a.amid === amidNum);
  const source_id_atyp = asset ? asset.asset_type : 50;

  // Delete all existing price rows for this asset today to avoid duplicate key conflicts
  await supabase.from('mprices').delete().eq('amid', amidNum).eq('date', todayStr);

  // Insert fresh row
  const priceRow = {
    amid: amidNum,
    currp: price,
    prevp: state.priceMap[amidNum]?.curr || price,
    date: todayStr,
    source_id_atyp
  };

  const { error } = await supabase.from('mprices').insert(priceRow);
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
  await performBackgroundSync();
  state.initialized = true;
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

  // For bs1 rows -- previously this function never queried or wrote bs1 at
  // all, which is why bulk-imported trades were invisible to the FIFO/
  // Capital-Gains engine (see the audit notes). Mirrors the nextVid/
  // nextTransid pattern: query the live max once, then increment locally
  // across the whole batch (calling nextTrid() per-row would re-scan
  // state.bs1 on every call and wouldn't see rows from earlier in this same
  // batch until the final insert completes).
  const { data: maxTrid } = await supabase.from('bs1').select('trid').order('trid', { ascending: false }).limit(1);
  let nextTridCounter = (maxTrid?.[0]?.trid || 0) + 1;

  const vouchers: any[] = [];
  const allTrans: any[] = [];
  const allNotes: any[] = [];
  const allBsRows: any[] = [];

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

    // Same scoped balance check as createVoucher() -- see the comment there
    // for why corporate-action types are excluded. This path is a fully
    // separate line-building implementation from createVoucher's transc1
    // handling, so it needed its own copy of the check rather than
    // inheriting it.
    const STRICT_BALANCE_TYPES = new Set(['payment', 'receipt', 'journal', 'contra', 'sale', 'sales']);
    if (STRICT_BALANCE_TYPES.has(data.type)) {
      const totalDebit = lines.reduce((s: number, l: any) => s + (Number(l.debit) || 0), 0);
      const totalCredit = lines.reduce((s: number, l: any) => s + (Number(l.credit) || 0), 0);
      const diff = Math.abs(totalDebit - totalCredit);
      if (diff >= 0.01) {
        throw new Error(
          `Bulk voucher batch aborted: an unbalanced "${data.type}" voucher dated ${data.date} was found (total debit ₹${totalDebit.toFixed(2)} vs total credit ₹${totalCredit.toFixed(2)}, difference ₹${diff.toFixed(2)}). No vouchers in this batch were saved -- fix the source data and retry.`
        );
      }
    }

    for (const line of lines) {
      const transid = nextTransid++;
      const amid = data.assetId ? Number(data.assetId) : null;
      allTrans.push({
        transid,
        vid,
        acid,
        dt: data.date,
        maid: Number(line.ledgerId),
        // CRITICAL FIX: every reader of transc1 in this codebase (getLedgerWithBalance,
        // trial balance, etc. -- see logic.ts lines ~552, ~1031, ~1709) reads
        // `dramt`/`cramt` exclusively. This function was writing `crdr`/`amount`
        // instead, a column shape nothing ever reads -- meaning every voucher
        // created through bulk import had a debit/credit of effectively ₹0 in
        // every ledger, balance, and report in the app, silently. Writing the
        // same shape as createVoucher() (and every reader) fixes this.
        dramt: Number(line.debit) || 0,
        cramt: Number(line.credit) || 0,
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

    // ── bs1 sync (the actual fix for this step) ────────────────────────────
    // Uses the SAME line-resolution logic as createVoucher() (extracted into
    // resolveAssetLineToBsRow), so bulk-imported trades are costed and
    // classified identically to trades entered one at a time through the UI.
    if (data.portfolioId) {
      const pfid = Number(data.portfolioId);
      const assetLines = (data.lines || []).filter((l: any) => {
        if (l.amid && Number(l.amid) > 0) return true;
        if (Number(l.quantity) > 0 || Number(l.price) > 0) return true;
        const ledgerIdNum = Number(l.ledgerId);
        if (ledgerIdNum >= 500000) return true;
        const ledger = state.acmac1.find((a: any) => a.id === ledgerIdNum);
        if (ledger && ASSET_GROUP_IDS.includes(Number(ledger.parent_id))) return true;
        return false;
      });
      const linesToProcess = assetLines.length > 0 ? assetLines : [data.lines[0]];

      for (const assetLine of linesToProcess) {
        const resolved = resolveAssetLineToBsRow(data, assetLine, pfid, vid, nextTridCounter++, linesToProcess.length);
        if (resolved) allBsRows.push(resolved.bsRow);
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

  if (allBsRows.length > 0) {
    for (let i = 0; i < allBsRows.length; i += 500) {
      const chunk = allBsRows.slice(i, i + 500);
      const { error: bsErr } = await supabase.from('bs1').insert(chunk);
      if (bsErr) throw new Error('Bulk insert failed for bs1: ' + bsErr.message);
    }
    allBsRows.forEach(row => state.bs1.push({ ...row, _src: 'c' }));

    // Refresh portfolio holdings summary once per unique (pfid, amid) pair
    // touched by this batch, rather than once per row (syncPortfolioStats
    // re-reads the live bs1 table itself, so it's safe to call after the
    // batch insert above has fully landed).
    const uniquePairs = new Map<string, { pfid: number; amid: number }>();
    allBsRows.forEach(row => {
      const key = `${row.pfid}_${row.amid}`;
      if (!uniquePairs.has(key)) uniquePairs.set(key, { pfid: row.pfid, amid: row.amid });
    });
    for (const { pfid, amid } of uniquePairs.values()) {
      await syncPortfolioStats(pfid, amid);
    }
  }
}
