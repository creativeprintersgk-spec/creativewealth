// WealthCore — Complete Logic Layer v2
// Reads from real MProfit Supabase tables
// All TypeScript errors fixed

import { supabase } from "./supabase.ts";
import { get, set } from 'idb-keyval';
import { getLivePrice, clearPriceCache } from "./services/assetMasterService.ts";
import isinDict from './services/isinDictionary.json' with { type: 'json' };
import { computeAssetTax, applySection112AExemption } from "./services/taxEngine.ts";
export { formatDateDDMMMYYYY, formatDateRange, formatDate } from "./utils/dateUtils.ts";

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
  10: 'Stocks',
  50: 'Stocks',
  51: 'Stocks',
  60: 'Mutual Funds (Equity)',
  61: 'Mutual Funds (Debt)',
  62: 'Mutual Funds (Hybrid)',
  70: 'NCD / Debentures',
  75: 'Mutual Funds (Hybrid)',
  77: 'Silver',
  80: 'Insurance',
  90: 'Fixed Deposits',
  95: 'NPS / ULiP',
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
  51: 'EQ',
  60: 'MF',
  61: 'MF',
  62: 'MF',
  70: 'NCD',
  75: 'MF',
  77: 'SLV',
  80: 'INS',
  90: 'FD',
  95: 'NPS',
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

let cachedStoredEntries: Entry[] | null = null;
let cachedEntriesByVoucherId: Map<string, Entry[]> | null = null;
let cachedStoredVouchers: Voucher[] | null = null;
let cachedVouchersMap: Record<string, any> | null = null;

const resolvedAssetTypeCache = new Map<string, number>();
const capitalGainsCache = new Map<string, any[]>();
const sumTableBySid = new Map<number, string>();
const sumTableByAmidPfid = new Map<string, string>();
const acmac1ByAmidMap = new Map<number, any>();
const assetMasterByAmidMap = new Map<number, any>();
let cachedCnTrades: Record<number, { totalAmt: number }> | null = null;
let cachedScMap: Map<number, { sellExp: number; buyExp: number }> | null = null;

export function invalidateStoredCaches() {
  cachedStoredEntries = null;
  cachedEntriesByVoucherId = null;
  cachedStoredVouchers = null;
  cachedVouchersMap = null;
  capitalGainsCache.clear();
  resolvedAssetTypeCache.clear();
  cachedCnTrades = null;
  cachedScMap = null;
}

export function rebuildAllIndexes() {
  invalidateStoredCaches();
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
  acmac1ByAmidMap.clear();
  state.acmac1.forEach(a => {
    const id = Number(a.id);
    let list = acmac1Map.get(id);
    if (!list) {
      list = [];
      acmac1Map.set(id, list);
    }
    list.push(a);

    if (!a.is_group) {
      if (a.exint1) acmac1ByAmidMap.set(Number(a.exint1), a);
      if (a.amid) acmac1ByAmidMap.set(Number(a.amid), a);
      // Only map a.id if it is explicitly an investment ledger (parent_id >= 200000)
      // General accounting ledgers (e.g. brokers like RKSV, expense accounts) must NEVER be mapped as asset AMIDs!
      if (a.id && Number(a.parent_id) >= 200000) acmac1ByAmidMap.set(Number(a.id), a);
    }
  });

  sumTableBySid.clear();
  sumTableByAmidPfid.clear();
  (state.sumTable || []).forEach((s: any) => {
    if (s.refno && s.refno.trim()) {
      const trimmed = s.refno.trim();
      if (s.sid) sumTableBySid.set(Number(s.sid), trimmed);
      if (s.amid && s.pfolio_id) sumTableByAmidPfid.set(`${s.amid}_${s.pfolio_id}`, trimmed);
    }
  });

  assetMasterByAmidMap.clear();
  (state.assetMaster || []).forEach((a: any) => {
    if (a.amid) assetMasterByAmidMap.set(Number(a.amid), a);
  });
}

// ── SAFE FETCH ────────────────────────────────────────────────────────────────
let supabaseReachability: boolean | null = null;
let lastReachabilityCheck = 0;

export async function isSupabaseReachable(force = false): Promise<boolean> {
  const now = Date.now();
  if (!force && supabaseReachability !== null && (now - lastReachabilityCheck) < 30000) {
    return supabaseReachability;
  }
  try {
    const url = (typeof import.meta !== 'undefined' && (import.meta as any).env?.VITE_SUPABASE_URL) || (typeof process !== 'undefined' ? process.env?.VITE_SUPABASE_URL : '') || '';
    if (!url || url.includes('placeholder')) {
      supabaseReachability = false;
      lastReachabilityCheck = now;
      return false;
    }

    if (typeof window === 'undefined') {
      try {
        const dns = await import('dns/promises');
        const host = new URL(url).hostname;
        await dns.lookup(host);
      } catch {
        supabaseReachability = false;
        lastReachabilityCheck = now;
        return false;
      }
    }

    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 2000);
    const key = (typeof import.meta !== 'undefined' && (import.meta as any).env?.VITE_SUPABASE_ANON_KEY) || (typeof process !== 'undefined' ? process.env?.VITE_SUPABASE_ANON_KEY : '') || '';
    const res = await fetch(`${url}/rest/v1/portfolios?select=id&limit=1`, {
      method: 'GET',
      headers: {
        apikey: key,
        Authorization: `Bearer ${key}`
      },
      signal: controller.signal
    }).catch(() => null);
    clearTimeout(timeout);
    supabaseReachability = !!(res && (res.ok || res.status === 200));
    lastReachabilityCheck = now;
  } catch {
    supabaseReachability = false;
    lastReachabilityCheck = now;
  }
  return supabaseReachability;
}

async function safeFetch(table: string, max = 500000): Promise<any[]> {
  const isOnline = await isSupabaseReachable();
  if (!isOnline) {
    return await loadSnapshotFallback(table);
  }
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
    if (all.length === 0) {
      all = await loadSnapshotFallback(table);
    }
    return all;
  } catch (e) {
    console.warn(`⚠️ ${table}:`, e);
    return await loadSnapshotFallback(table);
  }
}

async function loadSnapshotFallback(table: string): Promise<any[]> {
  try {
    if (typeof window !== 'undefined') {
      const res = await fetch(`/snapshot/${table}.json`);
      if (res.ok) {
        const data = await res.json();
        return Array.isArray(data) ? data : [];
      }
    } else {
      const fs = await import('fs');
      const path = await import('path');
      const p = path.resolve(process.cwd(), 'backups', 'latest_snapshot', `${table}.json`);
      if (fs.existsSync(p)) {
        const data = JSON.parse(fs.readFileSync(p, 'utf-8'));
        return Array.isArray(data) ? data : [];
      }
    }
  } catch (err) {
    console.warn(`Snapshot fallback not available for ${table}:`, err);
  }
  return [];
}

// ── PPF DEDUPLICATION & HEALING ──────────────────────────────────────────────
export function healAndDeduplicatePPF() {
  if (!state.acmac1) return;

  // 1. Identify all PPF ledgers in acmac1 for Krisha (acid === 36, parent_id === 200120)
  const krishaPPFLedgers = (state.acmac1 || []).filter((a: any) => 
    !a.is_group && 
    Number(a.acid) === 36 && 
    Number(a.parent_id) === 200120 &&
    (a.name || '').toLowerCase().includes('ppf')
  );

  let primaryId = 501714;
  const primaryLedger = (state.acmac1 || []).find((a: any) => Number(a.id) === 501714) || krishaPPFLedgers[0];
  if (primaryLedger) {
    primaryId = Number(primaryLedger.id);
    primaryLedger.name = 'PPF KSS';
  }

  if (krishaPPFLedgers.length > 1) {
    const duplicateIds = new Set(
      krishaPPFLedgers.filter((l: any) => Number(l.id) !== primaryId).map((l: any) => Number(l.id))
    );

    // Filter duplicate transactions in transC1 that doubled the balance
    if (state.transC1) {
      state.transC1 = state.transC1.filter((t: any) => {
        if (duplicateIds.has(Number(t.maid))) {
          // If transaction is the manual entry (~404629.31), remove it so it doesn't double balance
          if (Math.abs((Number(t.dramt) || 0) - 404629.31) < 5) {
            return false;
          }
          t.maid = primaryId;
        }
        return true;
      });
    }

    if (state.vouchersC1) {
      const activeVids = new Set((state.transC1 || []).map((t: any) => Number(t.vid)));
      state.vouchersC1 = state.vouchersC1.filter((v: any) => activeVids.has(Number(v.vid)));
    }

    // Remove duplicate ledgers from acmac1
    state.acmac1 = state.acmac1.filter((a: any) => !duplicateIds.has(Number(a.id)));
  }

  // 2. Standardize all 4 family PPF asset names to match the 3-letter initials convention
  state.assetNameMap[501714] = 'PPF KSS';
  state.assetNameMap[537] = 'PPF KSS';
  state.assetNameMap[500537] = 'PPF KSS';
  state.assetNameMap[500776] = 'PPF PRS';
  state.assetNameMap[500777] = 'PPF SPS';
  state.assetNameMap[501389] = 'PPF UPS';

  // 3. Deduplicate / re-map any corrupted rows in sumTable for Krisha PPF
  if (state.sumTable) {
    const krishaPPFRows = state.sumTable.filter((s: any) => 
      Number(s.pfolio_id) === 40 && 
      (Number(s.amid) === 501714 || Number(s.amid) === 537 || Number(s.amid) === 671 || Math.abs(Number(s.amtinv) - 404629.31) < 5)
    );
    if (krishaPPFRows.length > 1) {
      let kept = false;
      state.sumTable = state.sumTable.filter((s: any) => {
        const isMatch = Number(s.pfolio_id) === 40 && 
          (Number(s.amid) === 501714 || Number(s.amid) === 537 || Number(s.amid) === 671 || Math.abs(Number(s.amtinv) - 404629.31) < 5);
        if (!isMatch) return true;
        if (!kept) {
          kept = true;
          s.amid = 501714;
          s.atty = 130;
          return true;
        }
        return false;
      });
    } else if (krishaPPFRows.length === 1) {
      krishaPPFRows[0].amid = 501714;
      krishaPPFRows[0].atty = 130;
    }
  }

  // 4. Also remap bs1
  (state.bs1 || []).forEach((b: any) => {
    if (Number(b.pfid) === 40 && (Number(b.amid) === 671 || Number(b.amid) === 537)) {
      b.amid = 501714;
      b.atyid = 130;
    }
  });
}

// ── INIT ──────────────────────────────────────────────────────────────────────
let isBackgroundSyncing = false;

async function performBackgroundSync() {
  if (isBackgroundSyncing) return;
  isBackgroundSyncing = true;
  try {
    const isOnline = await isSupabaseReachable();
    let portfolios: any[], igm: any[], accPflink: any[], acmac1: any[],
        bs1: any[], sumTable: any[], vouchersC1: any[], vouchers1: any[],
        transC1: any[], trans1: any[], mprices: any[], scnote1: any[],
        sam: any[] = [], assetMaster: any[] = [];

    if (!isOnline) {
      if (state.bs1 && state.bs1.length > 0) {
        console.log('📦 Supabase is offline/unreachable. Retaining current in-memory state.');
        return;
      }
      const cachedState = (typeof indexedDB !== 'undefined') ? await get('wealthcore_state_v29') : null;
      if (cachedState && cachedState.bs1 && cachedState.bs1.length > 0) {
        console.log('📦 Supabase is offline/unreachable. Restoring from IDB cache.');
        Object.assign(state, cachedState);
        state.priceMap = {};
        state.assetNameMap = {};
        const sortedMprices = [...(state.mprices || [])].sort((a, b) => 
          (b.date || '').localeCompare(a.date || '') || (Number(b.row_id) || 0) - (Number(a.row_id) || 0)
        );
        sortedMprices.forEach((p: any) => {
          const amid = Number(p.amid);
          const curr = Number(p.currp) || 0;
          if (!state.priceMap[amid] && curr > 0) {
            state.priceMap[amid] = { curr, prev: Number(p.prevp) > 0 ? Number(p.prevp) : curr };
          }
        });
        (state.sam || []).forEach((s: any) => {
          state.assetNameMap[s.amid] = s.anm;
          state.assetNameMap[500000 + Number(s.amid)] = s.anm;
        });
        (state.assetMaster || []).forEach((a: any) => { state.assetNameMap[a.amid] = a.name; });
        (state.acmac1 || []).forEach((a: any) => {
          if (a.name && Number(a.parent_id) >= 200000) {
            state.assetNameMap[a.id] = a.name;
          }
        });
        healAndDeduplicatePPF();
        rebuildAllIndexes();
        return;
      }
      console.log('📦 Supabase is offline/unreachable. Loading from local snapshot...');
      [portfolios, igm, accPflink, acmac1,
       bs1, sumTable, vouchersC1, vouchers1, transC1, trans1, mprices, scnote1, sam, assetMaster] = await Promise.all([
        loadSnapshotFallback('portfolios'), loadSnapshotFallback('investor_group_members'),
        loadSnapshotFallback('acc_pflink'), loadSnapshotFallback('acmac1'),
        loadSnapshotFallback('bs1'), loadSnapshotFallback('sum_table'),
        loadSnapshotFallback('vouchersc1'), loadSnapshotFallback('vouchers1'),
        loadSnapshotFallback('transc1'), loadSnapshotFallback('trans1'),
        loadSnapshotFallback('mprices'), loadSnapshotFallback('scnote1'),
        loadSnapshotFallback('sam'), loadSnapshotFallback('asset_master')
      ]);
    } else {
      [portfolios, igm, accPflink, acmac1,
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

      samResults.forEach(res => { if (res.data) sam = sam.concat(res.data); });
      amResults.forEach(res => { if (res.data) assetMaster = assetMaster.concat(res.data); });

      if (sam.length === 0) sam = await loadSnapshotFallback('sam');
      if (assetMaster.length === 0) assetMaster = await loadSnapshotFallback('asset_master');
    }

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
    const sortedMprices = [...newState.mprices].sort((a, b) => 
      (b.date || '').localeCompare(a.date || '') || (Number(b.row_id) || 0) - (Number(a.row_id) || 0)
    );
    sortedMprices.forEach((p: any) => {
      const amid = Number(p.amid);
      const curr = Number(p.currp) || 0;
      if (!state.priceMap[amid] && curr > 0) {
        state.priceMap[amid] = { curr, prev: Number(p.prevp) > 0 ? Number(p.prevp) : curr };
      }
    });
    // Known delisted or updated historical baseline overrides
    state.priceMap[100183] = { curr: 0.20, prev: 0.20 }; // Uttam Value Steels Ltd (Evonith Value Steels)
    if (!state.priceMap[103605] || state.priceMap[103605].curr < 18) {
      state.priceMap[103605] = { curr: 18.60, prev: 18.60 }; // Mayur Floorings Ltd (BSE: 531221)
    }
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
      // Prioritize investment ledger names from Chart of Accounts
      if (a.name && Number(a.parent_id) >= 200000) {
        state.assetNameMap[a.id] = a.name;
      }
      const isinVal = a.isin || a.isincode;
      if (isinVal) state.isinMap[a.id] = String(isinVal).trim();
    });

    healAndDeduplicatePPF();
    rebuildAllIndexes();

    if (typeof indexedDB !== 'undefined') {
      await set('wealthcore_state_v29', JSON.parse(JSON.stringify(newState)));
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
    const cachedState = (typeof indexedDB !== 'undefined') ? await get('wealthcore_state_v29') : null;
    if (cachedState) {
      console.log('Loaded from IDB cache!');
      Object.assign(state, cachedState);
      
      // Rebuild transient maps
      state.priceMap = {};
      state.assetNameMap = {};
      const sortedMprices = [...(state.mprices || [])].sort((a, b) => 
        (b.date || '').localeCompare(a.date || '') || (Number(b.row_id) || 0) - (Number(a.row_id) || 0)
      );
      sortedMprices.forEach((p: any) => {
        const amid = Number(p.amid);
        const curr = Number(p.currp) || 0;
        if (!state.priceMap[amid] && curr > 0) {
          state.priceMap[amid] = { curr, prev: Number(p.prevp) > 0 ? Number(p.prevp) : curr };
        }
      });
      // Known delisted or updated historical baseline overrides
      state.priceMap[100183] = { curr: 0.20, prev: 0.20 }; // Uttam Value Steels Ltd (Evonith Value Steels)
      if (!state.priceMap[103605] || state.priceMap[103605].curr < 18) {
        state.priceMap[103605] = { curr: 18.60, prev: 18.60 }; // Mayur Floorings Ltd (BSE: 531221)
      }
      (state.sam || []).forEach((s: any) => {
        state.assetNameMap[s.amid] = s.anm;
        state.assetNameMap[500000 + Number(s.amid)] = s.anm; // MProfit v10: maid = 500000 + SAM.amid
      });
      (state.assetMaster || []).forEach((a: any) => { state.assetNameMap[a.amid] = a.name; });
      (state.acmac1 || []).forEach((a: any) => {
        if (a.name && (Number(a.parent_id) >= 200000 || !state.assetNameMap[a.id])) {
          state.assetNameMap[a.id] = a.name;
        }
      });

      healAndDeduplicatePPF();
      rebuildAllIndexes();
      persistStateToIDB();
      state.initialized = true;
      
      // Trigger background sync to get latest data silently only if online
      if (await isSupabaseReachable()) {
        performBackgroundSync();
      }
      return;
    }
  } catch (err) {
    console.warn('Failed to load from cache:', err);
  }

  // If no cache, block until first sync finishes
  await performBackgroundSync();
  state.initialized = true;
}

export async function persistStateToIDB() {
  if (typeof indexedDB !== 'undefined') {
    try {
      await set('wealthcore_state_v28', JSON.parse(JSON.stringify(state)));
      console.log('✅ WealthCore state saved to IndexedDB');
    } catch (e) {
      console.warn('Failed to persist state to IndexedDB:', e);
    }
  }
}

export async function importStagedTablesLocally(stagedFiles: Record<string, { rows: any[]; fileName: string }>): Promise<{ importedCount: number }> {
  let importedCount = 0;
  
  if (stagedFiles['portfolios']?.rows?.length) {
    state.portfolios = stagedFiles['portfolios'].rows;
    importedCount += state.portfolios.length;
  }
  if (stagedFiles['investor_group_members']?.rows) {
    state.investorGroupMembers = stagedFiles['investor_group_members'].rows;
    importedCount += state.investorGroupMembers.length;
  }
  if (stagedFiles['acc_pflink']?.rows?.length) {
    state.accPflink = stagedFiles['acc_pflink'].rows;
    importedCount += state.accPflink.length;
  }
  if (stagedFiles['acmac1']?.rows?.length) {
    const uniqueAcmac1: any[] = [];
    const seenAcmac = new Set();
    for (const a of stagedFiles['acmac1'].rows) {
      if (a.name === 'Difference in Opening Balances') continue;
      const key = `${a.id}_${a.acid}_${a.is_group}`;
      if (!seenAcmac.has(key)) {
        seenAcmac.add(key);
        uniqueAcmac1.push(a);
      }
    }
    state.acmac1 = uniqueAcmac1;
    importedCount += state.acmac1.length;
  }
  if (stagedFiles['sam']?.rows?.length) {
    state.sam = stagedFiles['sam'].rows;
    importedCount += state.sam.length;
  }
  if (stagedFiles['bs1']?.rows?.length) {
    state.bs1 = stagedFiles['bs1'].rows;
    importedCount += state.bs1.length;
  }
  if (stagedFiles['sum_table']?.rows?.length) {
    state.sumTable = stagedFiles['sum_table'].rows;
    importedCount += state.sumTable.length;
  }
  if (stagedFiles['vouchersc1']?.rows) {
    state.vouchersC1 = stagedFiles['vouchersc1'].rows
      .filter((v: any) => !(v.vid === 400 && String(v.dt).startsWith('2013')))
      .map((v: any) => ({ ...v, _src: 'c' }));
    importedCount += state.vouchersC1.length;
  }
  if (stagedFiles['vouchers1']?.rows?.length) {
    state.vouchers1 = stagedFiles['vouchers1'].rows.map((v: any) => ({ ...v, _src: 't' }));
    importedCount += state.vouchers1.length;
  }
  if (stagedFiles['transc1']?.rows) {
    state.transC1 = stagedFiles['transc1'].rows
      .filter((e: any) => !(e.vid === 400 && String(e.dt).startsWith('2013')))
      .map((e: any) => ({ ...e, _src: 'c' }));
    importedCount += state.transC1.length;
  }
  if (stagedFiles['trans1']?.rows?.length) {
    state.trans1 = stagedFiles['trans1'].rows.map((e: any) => ({ ...e, _src: 't' }));
    importedCount += state.trans1.length;
  }
  if (stagedFiles['mprices']?.rows?.length) {
    state.mprices = stagedFiles['mprices'].rows;
    importedCount += state.mprices.length;
  }
  if (stagedFiles['scnote1']?.rows) {
    state.scnote1 = stagedFiles['scnote1'].rows;
    importedCount += state.scnote1.length;
  }

  // Rebuild pricing and asset maps
  state.priceMap = {};
  state.assetNameMap = {};
  state.isinMap = {};
  const sortedMprices = [...(state.mprices || [])].sort((a, b) => 
    (b.date || '').localeCompare(a.date || '') || (Number(b.row_id) || 0) - (Number(a.row_id) || 0)
  );
  sortedMprices.forEach((p: any) => {
    const amid = Number(p.amid);
    const curr = Number(p.currp) || 0;
    if (!state.priceMap[amid] && curr > 0) {
      state.priceMap[amid] = { curr, prev: Number(p.prevp) > 0 ? Number(p.prevp) : curr };
    }
  });
  state.priceMap[100183] = { curr: 0.20, prev: 0.20 };
  if (!state.priceMap[103605] || state.priceMap[103605].curr < 18) {
    state.priceMap[103605] = { curr: 18.60, prev: 18.60 };
  }
  (state.sam || []).forEach((s: any) => {
    state.assetNameMap[s.amid] = s.anm;
    state.assetNameMap[500000 + Number(s.amid)] = s.anm;
    const isinVal = s.isin || s.isincode || s.isin_code;
    if (isinVal) state.isinMap[s.amid] = String(isinVal).trim();
  });
  (state.assetMaster || []).forEach((a: any) => {
    state.assetNameMap[a.amid] = a.name;
    const isinVal = a.isin || a.isincode || a.isin_code;
    if (isinVal) state.isinMap[a.amid] = String(isinVal).trim();
  });
  (state.acmac1 || []).forEach((a: any) => {
    if (a.name && Number(a.parent_id) >= 200000) {
      state.assetNameMap[a.id] = a.name;
    }
    const isinVal = a.isin || a.isincode;
    if (isinVal) state.isinMap[a.id] = String(isinVal).trim();
  });

  // Recalculate currv on state.sumTable so all summary calculations match authoritative prices
  (state.sumTable || []).forEach((s: any) => {
    const p = state.priceMap[s.amid];
    if (p && p.curr > 0 && Number(s.qnt) > 0) {
      s.currv = Number(s.qnt) * p.curr;
    }
  });

  healAndDeduplicatePPF();
  rebuildAllIndexes();

  await persistStateToIDB();
  state.initialized = true;

  if (typeof window !== 'undefined') {
    window.dispatchEvent(new Event('wealthcore-sync-complete'));
  }

  return { importedCount };
}

export function registerNewAssetInState(asset: any, price?: { curr: number; prev: number }) {
  if (!state.assetMaster) state.assetMaster = [];
  const existingIdx = state.assetMaster.findIndex((a: any) => Number(a.amid) === Number(asset.amid));
  if (existingIdx >= 0) {
    state.assetMaster[existingIdx] = asset;
  } else {
    state.assetMaster.push(asset);
  }
  state.assetNameMap[asset.amid] = asset.name;
  if (asset.isin) state.isinMap[asset.amid] = asset.isin;
  if (price && price.curr > 0) {
    if (!state.priceMap) state.priceMap = {};
    state.priceMap[asset.amid] = price;
  }
  rebuildAllIndexes();
  if (typeof window !== 'undefined') {
    window.dispatchEvent(new Event('wealthcore-sync-complete'));
  }
}

// ── HELPERS ───────────────────────────────────────────────────────────────────
export function getAssetName(amid: number): string {
  if (state.assetNameMap[amid]) return state.assetNameMap[amid];

  let name = '';
  // Direct SAM lookup (raw amid)
  const s = state.sam.find((x: any) => Number(x.amid) === amid);
  if (s && s.anm) name = s.anm;
  else if (amid >= 500000) {
    const samAmid = amid - 500000;
    const s2 = state.sam.find((x: any) => Number(x.amid) === samAmid);
    if (s2 && s2.anm) name = s2.anm;
    else {
      const a2 = assetMasterByAmidMap.get(samAmid) || state.assetMaster.find((x: any) => Number(x.amid) === samAmid);
      if (a2 && a2.name) name = a2.name;
    }
  }

  if (!name) {
    // Direct assetMaster lookup (raw amid)
    const a = assetMasterByAmidMap.get(amid) || state.assetMaster.find((x: any) => Number(x.amid) === amid);
    if (a && a.name) name = a.name;
    else {
      // ACMAC1 cross-reference via exint1
      const ac = acmac1ByAmidMap.get(amid) || state.acmac1.find((x: any) => !x.is_group && Number(x.exint1) === amid && Number(x.id) >= 100000);
      if (ac && ac.name) name = ac.name;
      else {
        // Mappings table
        const mp = (state as any).mappings?.find((x: any) => Number(x.amid) === amid);
        if (mp && mp.descr) name = mp.descr.split('/')[0] || mp.descr;
      }
    }
  }

  if (name) state.assetNameMap[amid] = name;
  return name;
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
export function getStoredPortfolios(includeInactive = false) {
  return state.portfolios
    .filter(p => 
      !p.is_group && 
      p.pfolio_type !== 10 && 
      (includeInactive || (p.exit_status !== 2 && p.exit_status !== 0 && !p.investor_name.toLowerCase().startsWith('x')))
    )
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
          : p.pfolio_type === 5 ? 'F&O / Currency'
          : null,
        isActive: (p.exit_status !== 2 && p.exit_status !== 0 && !p.investor_name.toLowerCase().startsWith('x'))
      };
    });
}

export function getStoredInvestorGroups(includeInactive = false) {
  return state.portfolios
    .filter(p => 
      p.is_group && 
      (includeInactive || (p.exit_status !== 2 && p.exit_status !== 0 && !p.investor_name.toLowerCase().startsWith('x')))
    )
    .map(p => ({
    id: String(p.id),
    name: p.investor_name,
    groupName: p.investor_name,
      fullName: p.full_name || p.investor_name,
      isActive: (p.exit_status !== 2 && p.exit_status !== 0 && !p.investor_name.toLowerCase().startsWith('x')),
    portfolioIds: state.investorGroupMembers
      .filter((m: any) => m.investor_group_id === p.id)
      .map((m: any) => String(m.pfolio_id))
  }));
}

export function getStoredAccounts(includeInactive = false) {
  return state.portfolios
    .filter(p => 
      p.pfolio_type === 10 && 
      (includeInactive || (p.exit_status !== 2 && p.exit_status !== 0 && !p.investor_name.toLowerCase().startsWith('x')))
    )
    .map(p => ({
    id: String(p.id),
    name: p.investor_name,
    accountName: p.investor_name,
    isActive: (p.exit_status !== 2 && p.exit_status !== 0 && !p.investor_name.toLowerCase().startsWith('x')),
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
  if (cachedStoredVouchers) return cachedStoredVouchers;
  // NOTE: vouchersc1 and vouchers1 contain DIFFERENT vouchers from different accounts.
  // Their vid values are sequential within each table independently and can coincide.
  // Do NOT deduplicate by vid across tables — concatenate both fully.
  cachedStoredVouchers = [...state.vouchersC1, ...state.vouchers1].map((v: any) => ({
    id: `${v._src || 'v'}_${v.vid}`,
    date: v.dt || '',
    type: ({ 1: 'payment', 2: 'payment', 3: 'contra', 4: 'receipt', 5: 'journal', 6: 'payment', 10: 'receipt', 12: 'contra', 14: 'purchase', 15: 'sale' } as Record<number | string, string>)[v.vtyp] || String(v.vtyp || 'journal'),
    narration: v.narr || '',
    voucherNo: `V-${v.vid}`,
    portfolioId: v.pfid ? String(v.pfid) : undefined,
    accountId: v.acid ? String(v.acid) : undefined,
  }));
  const map: Record<string, any> = {};
  for (let i = 0; i < cachedStoredVouchers.length; i++) {
    const v = cachedStoredVouchers[i];
    map[v.id] = v;
  }
  cachedVouchersMap = map;
  return cachedStoredVouchers;
}

export function getStoredEntries(): Entry[] {
  if (cachedStoredEntries) return cachedStoredEntries;
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
  cachedStoredEntries = [...c1, ...t1];

  const byVid = new Map<string, Entry[]>();
  for (let i = 0; i < cachedStoredEntries.length; i++) {
    const entry = cachedStoredEntries[i];
    if (entry.voucherId) {
      let list = byVid.get(entry.voucherId);
      if (!list) {
        list = [];
        byVid.set(entry.voucherId, list);
      }
      list.push(entry);
    }
  }
  cachedEntriesByVoucherId = byVid;
  return cachedStoredEntries;
}

export function getStoredTaxLots() { return []; }
export function getStoredPrices() { return state.priceMap; }

export function resolveAssetType(pfid: number, amid: number, defaultAtty?: number): number {
  const amidNum = Number(amid);
  const cacheKey = `${pfid}_${amidNum}_${defaultAtty || ''}`;
  const hit = resolvedAssetTypeCache.get(cacheKey);
  if (hit !== undefined) return hit;

  const res = _resolveAssetTypeInner(pfid, amidNum, defaultAtty);
  resolvedAssetTypeCache.set(cacheKey, res);
  return res;
}

function _resolveAssetTypeInner(pfid: number, amidNum: number, defaultAtty?: number): number {
  let resolvedAtty = defaultAtty || 50;

  const groupAttyMap: Record<number, number> = {
    200050: 50,   // Stocks
    200051: 50,   // Stock-in-Trade -> Stocks
    200061: 60,   // Mutual Funds (Equity)
    200062: 61,   // Mutual Funds (Debt)
    200058: 200,  // Special Inv. Funds
    200141: 95,   // NPS/ULIP
    200140: 80,   // Insurance
    200066: 190,  // Private Equity
    200095: 90,   // FDs
    200040: 100,  // Traded Bonds
    200070: 110,  // NCD/Debentures
    200115: 120,  // Deposits/Loans
    200120: 130,  // PPF/EPF
    200135: 140,  // Post Office
    200075: 60,   // Mutual Funds (Other / FoF / Multi-Asset) - was incorrectly mapped to 150 Gold!
    200077: 151,  // Silver
    200155: 170,  // Jewellery
    200150: 160,  // Properties
    200145: 180,  // Art
    200160: 210,  // AIF
    200195: 220,  // Loans
  };

  const assetName = getAssetName(amidNum);
  const cleanTargetName = assetName.toLowerCase().trim();
  const isin = getAssetISIN(amidNum);
  const isMfIsin = Boolean(isin && isin.toUpperCase().startsWith('INF'));
  const isMutualFund = isMfIsin || /\b(fund|fof|growth|idcw|dividend|direct plan|regular plan|multi.?asset|arbitrage|hybrid|asset allocation|index fund|elss)\b/i.test(cleanTargetName);

  // ── Priority 1: Exact Database Chart of Accounts Category (acmac1.parent_id) ──
  // Ground truth database classification MUST always come first
  const exactIdMatch = acmac1ByAmidMap.get(amidNum) || state.acmac1.find((l: any) => !l.is_group && Number(l.parent_id) >= 200000 && Number(l.exint1 || l.amid || l.id) === amidNum);
  if (exactIdMatch && exactIdMatch.parent_id) {
    const parentId = Number(exactIdMatch.parent_id);
    if (groupAttyMap[parentId] !== undefined) {
      // If it is explicitly classified as Stocks in COA, return Stocks unconditionally
      if (groupAttyMap[parentId] === 50) return 50;
      // If parentId is explicitly Property/Bond/FD/PPF/etc. (and NOT a mutual fund), return it directly
      if (!isMutualFund && [100, 110, 120, 130, 140, 150, 151, 160, 170, 180].includes(groupAttyMap[parentId])) {
        return groupAttyMap[parentId];
      }
      resolvedAtty = groupAttyMap[parentId];
    }
  }

  // ── Derivatives / Futures & Options (F&O) ──
  // Real derivatives (F&O) have atyp: 81 (Currency Futures), 82 (Currency Options), 30 (Stock Futures), etc.
  // They are trading contracts, NOT "Special Inv. Funds" (AIF/SIF 200).
  const isDerivative = /^(futstk|futidx|futcur|futcom|optstk|optidx|optcur|optcom)/i.test(cleanTargetName) ||
                       (/\b(futures?|options?)\b/i.test(cleanTargetName) && /\b\d{2}[a-z]{3}\d{2,4}\b/i.test(cleanTargetName));
  if (isDerivative) {
    if (/^futcur/i.test(cleanTargetName)) return 81; // Currency Futures
    if (/^optcur/i.test(cleanTargetName)) return 82; // Currency Options
    if (/^futstk/i.test(cleanTargetName)) return 30; // Stock Futures
    if (/^optstk/i.test(cleanTargetName)) return 31; // Stock Options
    if (/^futidx/i.test(cleanTargetName)) return 32; // Index Futures
    if (/^optidx/i.test(cleanTargetName)) return 33; // Index Options
    return defaultAtty || 81;
  }

  // ── Priority 2: Asset Master Explicit Asset Type ──
  const am = assetMasterByAmidMap.get(amidNum) || state.assetMaster.find((a: any) => a.amid === amidNum);
  if (am && am.asset_type) {
    const amType = Number(am.asset_type);
    if (amType === 50 || amType === 10) return 50; // Stocks
    // Do not let legacy MProfit asset_type 75 or 150 force a Mutual Fund into Gold
    if (isMutualFund && (amType === 75 || amType === 150)) {
      resolvedAtty = 60;
    } else {
      resolvedAtty = amType;
    }
  }

  // Physical Gold & Silver MUST ALWAYS resolve to 150 / 151 regardless of defaultAtty
  // (Only if it's actually physical gold / silver, NOT a mutual fund or ETF)
  if (!isMutualFund && (cleanTargetName === 'gold' || cleanTargetName === 'gold r' || /^gold\s*(\([^\)]*\)|coin|bar|24k|22k)?$/i.test(cleanTargetName))) {
    return 150;
  }
  if (!isMutualFund && (cleanTargetName === 'silver' || cleanTargetName === 'silver r' || /^silver\s*(\([^\)]*\)|coin|bar)?$/i.test(cleanTargetName))) {
    return 151;
  }

  // Sovereign Gold Bonds (SGB) -> Traded Bonds (100)
  if (/sovereign gold bond|sgb/i.test(cleanTargetName)) {
    return 100;
  }

  // Government of India Dated Securities (G-Sec) & Treasury Bills -> Traded Bonds (100)
  // (e.g. 7.72 GS 2055, 7.18 GS 2033, 7.26 GS 2032)
  if (/\b(\d+\.?\d*\s*%?\s*gs\b|gs\s*\d{4}|\bg-sec\b|gov.*sec|treasury|tbill)\b/i.test(cleanTargetName)) {
    return 100;
  }

  // Unlisted Shares / Private Equity (e.g. Chennai Super Kings, CSK)
  if (/chennai super kings|\bcsk\b|unlisted|pre.?ipo/i.test(cleanTargetName)) {
    return 190;
  }

  // ── Priority 3: Sub-Classification for Funds & Commodities (AMFI / SEBI Aligned) ──


  // Metal / Commodity ETFs (Traded on Exchange, NOT FoFs) → Listed ETF (atty 51)
  if (/silver|gold|commodity|metal/i.test(cleanTargetName) && /etf|bees/i.test(cleanTargetName) && !/fund.?of.?fund|fof/i.test(cleanTargetName)) {
    return 51;
  }

  

  // ── AMFI / SEBI: Other Hybrid Schemes (Equity-Oriented) ───────────────────
  // Multi Asset, Aggressive Hybrid, Balanced Advantage, Dynamic Asset Allocation, Equity Savings, Arbitrage
  if (/\b(multi.?asset|balanced.?advantage|dynamic.?asset.?allocation|equity.?savings|aggressive.?hybrid|equity.?hybrid|balanced.?hybrid|arbitrage)\b/i.test(cleanTargetName)) {
    return 62;
  }

  // Aggressive Hybrid, Balanced Advantage, Dynamic Asset Allocation, Equity Savings, Arbitrage
  if (/\b(balanced.?advantage|dynamic.?asset.?allocation|equity.?savings|aggressive.?hybrid|equity.?hybrid|balanced.?hybrid|arbitrage)\b/i.test(cleanTargetName)) {
    return 60;
  }

  // ── AMFI / SEBI: Solution Oriented & Fund of Funds (Domestic & Overseas) ──
  if (/\b(overseas\s+fund|international\s+fund|global\s+fund|retirement|children|fof|fund.?of.?fund)\b/i.test(cleanTargetName) && !/gold|silver|commodity|precious.?metal/i.test(cleanTargetName)) {
    return 60;
  }

  // If defaultAtty is explicitly Stocks (50) and no other override
  if (defaultAtty === 50 && (!exactIdMatch || exactIdMatch.parent_id === 200050)) {
    return 50;
  }

  // ── AMFI / SEBI: Debt Mutual Funds (atty 61) ──────────────────────────────
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

  // If identified as a mutual fund and not debt, default to 60 (MF Equity / Hybrid)
  if (isMutualFund) {
    return 60;
  }

  // Rule 4: Map legacy MProfit atty codes
  // atty 75 in MProfit = "Unlisted Non-Debt Fund" — was incorrectly remapped to Gold (150).
  // Now: only remap to Gold if the asset name actually indicates physical gold.
  if (resolvedAtty === 75) {
    if (/gold|silver|commodity|precious.?metal/i.test(cleanTargetName)) return 150;
    return 60; // Everything else that MProfit tagged as atty-75 -> MF Equity
  }
  if (resolvedAtty === 77) return 151;  // Silver
  if (resolvedAtty === 40) return 100;  // Traded Bonds
  if (resolvedAtty === 30) return 90;   // FDs
  if (resolvedAtty === 70) {
    if (/\b(ulip|nps|policy|pension|life\s+insurance)\b/i.test(cleanTargetName)) return 95;
    if (/\b(ncd|debenture|power|mld|corp)\b/i.test(cleanTargetName)) return 110;
    return 100;
  }

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

export function getHoldings(
  portfolioIds: number[], 
  assetTypeFilter?: number | number[], 
  includeZeroQty: boolean = false,
  includeAccountingLedgers: boolean = true
): AssetHolding[] {
  const pSet = new Set(portfolioIds.map(Number));
  
  // 1. Filter sum_table for active holdings (qnt > 0 or currv > 0)
  // We exclude amtinv > 0 because sold assets often still retain an amtinv value in the sumTable
  // Safeguard: Exclude rogue / phantom records (amid 1490)
  const rows = state.sumTable.filter((s: any) => 
    pSet.has(Number(s.pfolio_id)) && 
    Number(s.amid) !== 1490 &&
    (includeZeroQty || Number(s.qnt) > 0.0001 || Number(s.currv) > 0.01)
  );

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
    const inv = Number(s.amtinv) || 0;
    const tgain = Number(s.tgain) || 0;

    const rawName = state.assetNameMap[amid] || '';
    const isDerivative = [30, 31, 32, 33, 80, 81, 82, 83, 84].includes(s.resolvedAtty) ||
                         /^(futstk|futidx|futcur|futcom|optstk|optidx|optcur|optcom)/i.test(rawName);

    // Closed / expired derivatives (zero quantity) must NEVER be shown as active delivery holdings in PMS
    if (isDerivative && qty <= 0.0001 && !includeZeroQty) {
      return;
    }

    // Determine effective quantity:
    // Non-unitized physical assets (PPF, FD, Properties, Jewellery, etc.) use 1 when only amount is tracked.
    // Derivatives, stocks, and mutual funds with 0 quantity must NEVER be inflated to 1!
    const isNonUnitizedAsset = [90, 110, 120, 130, 140, 150, 151, 160, 170, 180, 190, 220].includes(s.resolvedAtty);
    const effectiveQty = qty > 0 ? qty : ((isNonUnitizedAsset && (currv > 0 || inv > 0)) ? 1 : 0);

    if (effectiveQty <= 0 && !includeZeroQty) {
      return;
    }

    const fallbackCurr = effectiveQty > 0 ? (currv > 0 ? currv / effectiveQty : inv / effectiveQty) : 0;
    const fallbackPrev = effectiveQty > 0 ? fallbackCurr - (tgain / effectiveQty) : fallbackCurr;

    let currPrice = price.curr || fallbackCurr;
    let prevPrice = price.prev || fallbackPrev;

    // For any asset where no live quote exists (e.g. unlisted equity, private equity, non-traded bonds/FDs/commodities),
    // fall back to purchase cost (avgPrice = amtinv / qty) so price and value are never 0 or missing.
    const avgPrice = effectiveQty > 0 ? inv / effectiveQty : 0;
    if (currPrice === 0 && avgPrice > 0) {
      currPrice = avgPrice;
      prevPrice = avgPrice;
    }

    let finalAssetName = state.assetNameMap[amid] || `Asset ${amid}`;
    const isMarketAsset = [50, 51, 60, 61, 75, 77, 100].includes(s.resolvedAtty);
    if (!isMarketAsset || finalAssetName.startsWith('Asset ')) {
      const ledgerMatch = acmac1ByAmidMap.get(amid) || state.acmac1.find((l: any) => !l.is_group && (
        Number(l.exint1 || l.amid) === amid ||
        (Number(l.parent_id) >= 200000 && Number(l.id) === amid) ||
        (s.sid && Number(l.id) === 500000 + Number(s.sid))
      ));
      if (ledgerMatch && ledgerMatch.name) {
        finalAssetName = ledgerMatch.name;
      } else if (s.resolvedAtty === 130 && (/^fut/i.test(finalAssetName) || finalAssetName.startsWith('Asset '))) {
        finalAssetName = 'Public Provident Fund';
      }
    }

    if (!map[amid]) {
      map[amid] = {
        assetId: amid, 
        assetName: finalAssetName,
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
    const qtyRow = effectiveQty;
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

  // ── Non-Unitized Accounting Investment Ledgers (PPF, EPF, FDs, Properties, etc.) ──
  const NON_UNITIZED_GROUPS: Record<number, number> = {
    200120: 130, // PPF/EPF
    200095: 90,  // Fixed Deposits
    200070: 110, // NCD / Debentures
    200115: 120, // Deposits / Loans
    200135: 140, // Post Office
    200150: 160, // Properties
    200155: 170, // Jewellery
    200145: 180, // Art
    200066: 190, // Private Equity
    200160: 210, // AIF
    200195: 220, // Loans
  };

  // Helper to resolve the primary investment portfolio for an accounting entity (acid)
  const getPrimaryPortfolioForAcid = (acid: number): number | null => {
    const linkedPfids = (state.accPflink || [])
      .filter((al: any) => Number(al.acid) === acid)
      .map((al: any) => Number(al.pfid));
    
    if (linkedPfids.length === 0) return null;
    if (linkedPfids.length === 1) return linkedPfids[0];

    const candidatePorts = (state.portfolios || []).filter((p: any) => linkedPfids.includes(Number(p.id)));

    // Primary portfolio has pfolio_type === 0, does not start with 'x' (case-insensitive),
    // and is not a sub-account (e.g. 'MF', 'FO', 'CURR', 'Smallcase', etc.)
    const primary = candidatePorts.find((pt: any) => 
      pt.pfolio_type === 0 && 
      !pt.investor_name.toLowerCase().startsWith('x') &&
      !pt.investor_name.toLowerCase().includes(' mf') &&
      !pt.investor_name.toLowerCase().includes('curr') &&
      !pt.investor_name.toLowerCase().includes(' fo') &&
      !pt.investor_name.toLowerCase().includes('fno') &&
      !pt.investor_name.toLowerCase().includes('smallcase')
    );

    return primary ? Number(primary.id) : linkedPfids[0];
  };

  if (includeAccountingLedgers) {
    const matchingLedgers = (state.acmac1 || []).filter((a: any) => {
      if (a.is_group) return false;
      if (NON_UNITIZED_GROUPS[Number(a.parent_id)] === undefined) return false;
      const primPfid = getPrimaryPortfolioForAcid(Number(a.acid));
      return primPfid !== null && pSet.has(primPfid);
    });

    matchingLedgers.forEach((l: any) => {
      const lid = Number(l.id);
      const targetAtty = NON_UNITIZED_GROUPS[Number(l.parent_id)];

      // Skip if filtered out by assetTypeFilter
      if (assetTypeFilter !== undefined) {
        const types = Array.isArray(assetTypeFilter) ? assetTypeFilter : [assetTypeFilter];
        if (!types.includes(targetAtty)) return;
      }

      // Check if already mapped from sumTable to avoid duplicate entry
      if (map[lid]) return;
      const cleanLedgerName = (l.name || '').toLowerCase().trim();
      const alreadyMapped = Object.values(map).some(h => {
        const hName = (h.assetName || '').toLowerCase().trim();
        if (hName === cleanLedgerName) return true;
        // Deduplicate PPF accounts by member
        const isBothPPF = (hName.includes('ppf') || h.assetType === 130) && (cleanLedgerName.includes('ppf') || targetAtty === 130);
        if (isBothPPF) {
          const hKrisha = hName.includes('krisha') || hName.includes('kss') || h.amid === 501714 || h.amid === 537;
          const lKrisha = cleanLedgerName.includes('krisha') || cleanLedgerName.includes('kss') || Number(l.acid) === 36 || lid === 501714;
          if (hKrisha && lKrisha) return true;

          const hPramesh = hName.includes('pramesh') || hName.includes('prs') || h.amid === 500776 || h.amid === 302;
          const lPramesh = cleanLedgerName.includes('pramesh') || cleanLedgerName.includes('prs') || Number(l.acid) === 30 || lid === 500776;
          if (hPramesh && lPramesh) return true;

          const hSaahil = hName.includes('saahil') || hName.includes('sps') || h.amid === 500777 || h.amid === 303;
          const lSaahil = cleanLedgerName.includes('saahil') || cleanLedgerName.includes('sps') || Number(l.acid) === 31 || lid === 500777;
          if (hSaahil && lSaahil) return true;

          const hUnnati = hName.includes('unnati') || hName.includes('ups') || h.amid === 501389 || h.amid === 393;
          const lUnnati = cleanLedgerName.includes('unnati') || cleanLedgerName.includes('ups') || Number(l.acid) === 29 || lid === 501389;
          if (hUnnati && lUnnati) return true;
        }
        return false;
      });
      if (alreadyMapped) return;

      // In MProfit, acmac1.db_bal - acmac1.cr_bal is the cumulative closing balance
      // matching the Accounting Balance Sheet. Both PMS and Balance Sheet MUST be identical.
      const netBalance = Number(((Number(l.db_bal) || 0) - (Number(l.cr_bal) || 0)).toFixed(2));

      if (!includeZeroQty && netBalance <= 0.01) return;

      // Associate with primary portfolio
      const targetPfid = getPrimaryPortfolioForAcid(Number(l.acid)) || portfolioIds[0];
      const portObj = (state.portfolios || []).find((p: any) => Number(p.id) === targetPfid);

      map[lid] = {
        assetId: lid,
        assetName: l.name || 'Investment',
        amid: lid,
        assetType: targetAtty,
        assetTypeName: ASSET_TYPE_MAP[targetAtty] || 'Other',
        assetIcon: ASSET_TYPE_ICON[targetAtty] || 'OTH',
        quantity: 0,
        avgPrice: 0,
        amtInvested: netBalance,
        currentPrice: 0,
        prevPrice: 0,
        todaysGain: 0,
        todaysGainPct: 0,
        overallGain: 0,
        overallGainPct: 0,
        currentValue: netBalance,
        portfolioSplits: [{
          portfolioId: targetPfid,
          portfolioName: portObj?.investor_name || `Portfolio ${targetPfid}`,
          quantity: 0,
          amtInvested: netBalance,
          currentValue: netBalance
        }]
      };
    });
  }

  return Object.values(map).map(h => {
    const isNonUnitized = [130, 90, 110, 120, 140, 160, 170, 180, 210, 220].includes(h.assetType) ||
      (h.assetTypeName || '').toLowerCase().includes('ppf') ||
      (h.assetTypeName || '').toLowerCase().includes('epf') ||
      h.assetName.toLowerCase().startsWith('ppf') ||
      h.assetName.toLowerCase().startsWith('epf');

    if (isNonUnitized) {
      h.quantity = 0;
      h.avgPrice = 0;
      h.currentPrice = 0;
      h.prevPrice = 0;
      h.todaysGain = 0;
      h.todaysGainPct = 0;
      h.overallGain = 0;
      h.overallGainPct = 0;
      h.currentValue = h.amtInvested;
      return h;
    }

    h.avgPrice = h.quantity > 0 ? h.amtInvested / h.quantity : (h.amtInvested > 0 ? h.amtInvested : 0);
    if (h.currentPrice === 0 && h.avgPrice > 0) {
      h.currentPrice = h.avgPrice;
      h.prevPrice = h.avgPrice;
    }
    h.currentValue = h.quantity > 0 ? h.quantity * h.currentPrice : (h.amtInvested > 0 ? h.amtInvested : 0);
    h.overallGain = h.currentValue > 0 ? h.currentValue - h.amtInvested : 0;
    // Sanity safeguard: if ratio is > 5x (e.g. data entry typo or unit mismatch like per-gram vs per-10g),
    // prevent phantom single-day spikes from corrupting the daily movement
    if (h.prevPrice > 0 && h.currentPrice > 0) {
      const ratio = h.currentPrice / h.prevPrice;
      if (ratio > 5 || ratio < 0.2) {
        h.prevPrice = h.currentPrice;
      }
    }
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

  let isin = '';
  const s = state.sam.find((x: any) => x.amid === amid);
  if (s && (s.isin || s.isincode || s.isin_code)) isin = String(s.isin || s.isincode || s.isin_code).trim();
  else {
    const a = assetMasterByAmidMap.get(amid) || state.assetMaster.find((x: any) => x.amid === amid);
    if (a && (a.isin || a.isincode || a.isin_code)) isin = String(a.isin || a.isincode || a.isin_code).trim();
    else {
      const ac = acmac1ByAmidMap.get(amid) || state.acmac1.find((x: any) => x.id === amid);
      if (ac && (ac.isin || ac.isincode)) isin = String(ac.isin || ac.isincode).trim();
      else {
        const b = state.bs1.find((x: any) => x.amid === amid && (x.isin || x.isincode || x.isin_code));
        if (b) isin = String(b.isin || b.isincode || b.isin_code).trim();
        else {
          const t = (state.transC1 || []).find((x: any) => x.amid === amid && (x.isin || x.isincode || x.isin_code));
          if (t) isin = String(t.isin || t.isincode || t.isin_code).trim();
        }
      }
    }
  }
  state.isinMap[amid] = isin;
  return isin;
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
    const numSid = Number(sid);
    const hit = sumTableBySid.get(numSid);
    if (hit) return hit;
    const sEntry = state.sumTable.find((s: any) => Number(s.sid) === numSid);
    if (sEntry && sEntry.refno && sEntry.refno.trim()) {
      const ref = sEntry.refno.trim();
      sumTableBySid.set(numSid, ref);
      return ref;
    }
  }
  if (amid && pfid) {
    const key = `${amid}_${pfid}`;
    const hit = sumTableByAmidPfid.get(key);
    if (hit) return hit;
    const sEntry = state.sumTable.find((s: any) => Number(s.amid) === Number(amid) && Number(s.pfolio_id) === Number(pfid));
    if (sEntry && sEntry.refno && sEntry.refno.trim()) {
      const ref = sEntry.refno.trim();
      sumTableByAmidPfid.set(key, ref);
      return ref;
    }
  }
  if (amid) {
    const numAmid = Number(amid);
    const l = acmac1ByAmidMap.get(numAmid) || state.acmac1.find((a: any) => a.id === numAmid);
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

  // 1. Check for Buy/Sell trade records from bs1 (Stocks, Mutual Funds, Traded Bonds)
  const allTx = state.bs1
    .filter((t: any) => (pSet.size === 0 || pSet.has(t.pfid)) && t.amid === amid)
    .sort((a: any, b: any) => (a.dt || '').localeCompare(b.dt || ''));

  if (allTx.length > 0) {
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
        balanceCost: runningCost,
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

  // 2. Non-Unitized / Accounting Investment Ledger Fallback (PPF, EPF, FDs, NCDs, Properties, etc.)
  const amidNum = Number(amid);
  const ledger = (state.acmac1 || []).find((a: any) => 
    !a.is_group && (
      Number(a.id) === amidNum || 
      Number(a.id) === 500000 + amidNum ||
      (amidNum >= 500000 && Number(a.id) === amidNum - 500000)
    )
  );

  if (ledger) {
    const lid = Number(ledger.id);
    const ledgerData = getLedgerWithBalance(lid, startDate, endDate, ledger.acid);
    const port = (state.portfolios || []).find((p: any) => pSet.has(p.id)) || 
                 (state.portfolios || []).find((p: any) => Number(p.accountId) === Number(ledger.acid));

    const transactionsWithinPeriod = (ledgerData.transactions || []).map((t: any, idx: number) => {
      const dr = Number(t.debit) || 0;
      const cr = Number(t.credit) || 0;
      let txType = 'Transaction';
      if (/interest/i.test(t.againstLedger) || /interest/i.test(t.narration)) txType = 'Interest';
      else if (dr > 0 && /bank/i.test(t.againstLedger)) txType = 'Deposit';
      else if (dr > 0) txType = 'Addition';
      else if (cr > 0 && /capital/i.test(t.againstLedger)) txType = 'Transfer';
      else if (cr > 0) txType = 'Withdrawal';
      else if (t.voucherType === 'receipt') txType = 'Deposit';
      else if (t.voucherType === 'payment') txType = 'Withdrawal';

      return {
        id: t.voucherId || `ac_${lid}_${idx}`,
        date: t.date,
        type: txType,
        trty: dr > 0 ? 19 : 21,
        voucherId: t.voucherId,
        portfolioName: port?.investor_name || 'Portfolio',
        portfolioId: port?.id || 0,
        folio: '-',
        quantity: 0,
        price: 0,
        amount: Math.abs(dr - cr),
        brokerage: 0,
        charges: 0,
        netPrice: 0,
        debit: dr,
        credit: cr,
        balanceQty: 0,
        balanceCost: t.balance,
        narration: t.againstLedger !== '-' ? t.againstLedger : (t.narration || '')
      };
    });

    return {
      openingQty: 0,
      openingCost: ledgerData.openingBalance,
      closingQty: 0,
      closingCost: ledgerData.closingBalance,
      transactions: transactionsWithinPeriod
    };
  }

  return {
    openingQty: 0,
    openingCost: 0,
    closingQty: 0,
    closingCost: 0,
    transactions: []
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
        voucherId: `trid_${t.trid}`,
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
  getStoredVouchers();
  const voucherMap: Record<string, any> = cachedVouchersMap || {};

  const allPortfolios = getStoredPortfolios();
  const portfolioIds = acidNum
    ? allPortfolios.filter((p: any) => Number(p.accountId) === acidNum).map((p: any) => String(p.id))
    : null;

  // ─── P&L LEDGER DETECTION ────────────────────────────────────────────────
  // Income / Expense / Capital-Gains ledgers are P&L accounts.
  // MProfit (and standard accounting) resets them to ZERO at each FY start —
  // there is NO opening balance carry-forward for P&L accounts.
  // We detect them by walking the parent_id chain in acmac1 and looking for
  // special_type_id values:  250 = Profit & Loss,  280 = Income,  290 = Expense
  const PNL_TYPE_IDS = new Set([250, 280, 290]);
  function isPnlLedger(row: any): boolean {
    if (!row) return false;
    if (PNL_TYPE_IDS.has(Number(row.special_type_id))) return true;
    // Walk up to 6 levels of parent groups
    let parentId = row.parent_id;
    for (let depth = 0; depth < 6 && parentId; depth++) {
      const parent = (state.acmac1 || []).find(
        (a: any) => a.id === parentId && (!acidNum || a.acid === acidNum || a.acid === -1)
      );
      if (!parent) break;
      if (PNL_TYPE_IDS.has(Number(parent.special_type_id))) return true;
      parentId = parent.parent_id;
    }
    return false;
  }
  const isPlLedger = isPnlLedger(ledgerRow);

  // ─── P&L OPENING BALANCE (SMART: checks if previous FY was closed) ────────
  // Rule (matches MProfit & standard accounting):
  //   • If previous FY year-end closing entry WAS posted → net of prev FY ≈ 0 → this FY opens at 0
  //   • If year-end closing was NOT yet posted → carry forward unclosed balance as opening
  // We detect this by summing entries for this ledger in the immediately preceding FY period.
  let plOpeningBalance = 0;
  if (isPlLedger && startDate) {
    // Immediately preceding FY: same month/day, one year earlier
    const prevYearStart = `${parseInt(startDate.substring(0, 4)) - 1}${startDate.substring(4)}`;
    let prevFyDr = 0, prevFyCr = 0;
    for (const e of allEntries) {
      if (String(e.ledgerId) !== lid) continue;
      if (acidNum) {
        const v2 = voucherMap[e.voucherId];
        const eAcid = e.accountId || v2?.accountId;
        const ePfid = v2?.portfolioId;
        const belongs2 = (Number(eAcid) === acidNum) ||
          (ePfid && portfolioIds && portfolioIds.includes(String(ePfid)));
        if (!belongs2) continue;
      }
      const d = e.date || '';
      if (d >= prevYearStart && d < startDate) {
        prevFyDr += Number(e.debit) || 0;
        prevFyCr += Number(e.credit) || 0;
      }
    }
    const prevFyNet = prevFyDr - prevFyCr;
    // If prev FY net is non-zero (> 0.5 to handle floating point): not closed → carry forward
    if (Math.abs(prevFyNet) > 0.5) {
      plOpeningBalance = prevFyNet;
    }
    // else: prev FY net ≈ 0 → year was closed → opening stays 0
  }

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

  // If no transactions exist:
  if (entries.length === 0) {
    if (isPlLedger) return { transactions: [], openingBalance: plOpeningBalance, closingBalance: plOpeningBalance };
    // For Asset/Liability ledgers with no vouchers, use acmac1 static balance
    const initialDb = Number(ledgerRow?.db_bal) || 0;
    const initialCr = Number(ledgerRow?.cr_bal) || 0;
    const initialNet = initialDb - initialCr;
    return { transactions: [], openingBalance: initialNet, closingBalance: initialNet };
  }

  // NOTE: acmac1.db_bal/cr_bal in MProfit are cumulative lifetime totals, NOT starting balances.
  // Starting balance vouchers (VID=0 / DT=0001-01-01) are already included in entries.
  // P&L ledgers start from plOpeningBalance (0 if prev year closed, else carry-forward amount).
  let openingBalance = isPlLedger ? plOpeningBalance : 0;
  let runningBalance = isPlLedger ? plOpeningBalance : 0;
  const transactions: any[] = [];
  const vtypMap: Record<string, string> = { '1': 'payment', '2': 'payment', '3': 'contra', '4': 'receipt', '5': 'journal', '6': 'payment', '10': 'receipt', '12': 'contra', '14': 'purchase', '15': 'sale' };


  for (let i = 0; i < entries.length; i++) {
    const e = entries[i];
    const dr = Number(e.debit) || 0;
    const cr = Number(e.credit) || 0;
    const v = voucherMap[e.voucherId];
    const entryDate = e.date || v?.date || '';
    const isOpening = !entryDate || entryDate === '' || entryDate === 'undefined' || String(entryDate).startsWith('0001');

    const before = startDate ? (isOpening || entryDate < startDate) : isOpening;
    const inRange = (!startDate || entryDate >= startDate) && (!endDate || entryDate <= endDate) && !isOpening;

    if (before) {
      // P&L ledgers (Income/Expense) never carry forward — opening stays 0
      if (!isPlLedger) {
        runningBalance += dr - cr;
        openingBalance = runningBalance;
      }
    } else if (inRange) {
      runningBalance += dr - cr;

      // Find counter ledger name in the same voucher via pre-indexed Map (O(1) instead of scanning all entries)
      let againstName = '';
      if (e.voucherId) {
        const vLegs = cachedEntriesByVoucherId?.get(e.voucherId) || [];
        const otherLegs = vLegs.filter((t: any) => t.id !== e.id);
        if (otherLegs.length === 1) {
          const otherMaid = otherLegs[0].ledgerId;
          const acList = acmac1Map.get(Number(otherMaid));
          const otherLedger = acList ? acList.find((a: any) => !acidNum || a.acid === acidNum) : (state.acmac1 || []).find((a: any) => String(a.id) === String(otherMaid) && (!acidNum || a.acid === acidNum));
          againstName = otherLedger ? otherLedger.name : getAssetName(Number(otherMaid)) || `Ledger ${otherMaid}`;
        } else if (otherLegs.length > 1) {
          againstName = 'Multiple Accounts';
        }
      }

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
  }

  return { transactions, openingBalance, closingBalance: runningBalance };
}


export function getLedgerBalance(ledgerId: string | number, acid?: string | number): number {
  const lid = String(ledgerId);
  const lidNum = Number(ledgerId);
  const acidNum = acid && acid !== 'undefined' ? Number(acid) : null;

  // 1. Fast path: check indexed maps by numeric ledger ID (O(1) execution in microseconds)
  if (!isNaN(lidNum) && (transC1ByMaid.has(lidNum) || trans1ByMaid.has(lidNum))) {
    const c1List = transC1ByMaid.get(lidNum);
    const t1List = trans1ByMaid.get(lidNum);

    let balance = 0;
    if (c1List) {
      for (let i = 0; i < c1List.length; i++) {
        const e = c1List[i];
        if (acidNum) {
          const v = vouchersC1Map.get(e.vid);
          const entryAcid = e.acid || v?.acid;
          if (Number(entryAcid) !== acidNum) continue;
        }
        balance += (Number(e.dramt) || 0) - (Number(e.cramt) || 0);
      }
    }
    if (t1List) {
      for (let i = 0; i < t1List.length; i++) {
        const e = t1List[i];
        if (acidNum) {
          const v = vouchers1Map.get(e.vid);
          const entryAcid = e.acid || v?.acid;
          if (Number(entryAcid) !== acidNum) continue;
        }
        balance += (Number(e.dramt) || 0) - (Number(e.cramt) || 0);
      }
    }
    return balance;
  }

  // 2. Check acmac1 static balance
  const acList = !isNaN(lidNum) ? acmac1Map.get(lidNum) : null;
  const ledgerRow = acList 
    ? acList.find((a: any) => !a.is_group && (!acidNum || a.acid === acidNum))
    : (state.acmac1 || []).find((a: any) => !a.is_group && String(a.id) === lid && (!acidNum || a.acid === acidNum));

  if (ledgerRow) {
    const initialDb = Number(ledgerRow.db_bal) || 0;
    const initialCr = Number(ledgerRow.cr_bal) || 0;
    return initialDb - initialCr;
  }

  // 3. Fallback for non-numeric ledger IDs
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

  if (!txListIn || txListIn.length === 0) {
    return { results: [], openLots: [] };
  }

  // Pre-resolve common asset fields across the entire batch (all txns in txListIn belong to the same asset)
  const sampleTx = txListIn[0];
  const commonPfid = sampleTx ? Number(sampleTx.pfid) : 0;
  const commonAmid = sampleTx ? Number(sampleTx.amid) : 0;
  const commonAtyid = sampleTx ? Number(sampleTx.atyid) : 50;
  const commonResolvedAtty = commonAmid ? resolveAssetType(commonPfid, commonAmid, commonAtyid) : 50;
  const commonAssetName = commonAmid ? getAssetName(commonAmid) : '';
  const commonIsin = commonAmid ? (getAssetISIN(commonAmid) || sampleTx?.isin || '') : '';
  const portObj = commonPfid ? state.portfolios.find((p: any) => Number(p.id) === commonPfid) : null;
  const commonPortName = portObj?.investor_name || portObj?.name || `Portfolio ${commonPfid}`;
  const commonAssetTypeName = ASSET_TYPE_MAP[commonResolvedAtty] || 'Stocks';

  // Clone every transaction before any in-place reordering/redating below.
  const txList = txListIn.map(t => ({ ...t }));

  // Pre-pass: O(N) single-pass settlement-cycle short-cover detection.
  // If a sell occurs without prior inventory and is covered within 5 days,
  // ensure the buy is processed first so the short trade is closed cleanly.
  let priorNetQty = 0;
  for (let i = 0; i < txList.length - 1; i++) {
    const cur = txList[i];
    const next = txList[i + 1];
    const curTrty = Number(cur.trty);
    const nextTrty = Number(next.trty);
    const curQn = Number(cur.qn) || 0;

    if (regularSellTrty.has(curTrty) && regularBuyTrty.has(nextTrty) && priorNetQty < curQn) {
      const dtCurStr = (cur.dt || '').substring(0, 10);
      const dtNextStr = (next.dt || '').substring(0, 10);
      const dCur = Date.parse(dtCurStr);
      const dNext = Date.parse(dtNextStr);
      if (!isNaN(dCur) && !isNaN(dNext) && Math.abs(dNext - dCur) <= 5 * 86400000) {
        cur.dt = next.dt;
        txList[i] = next;
        txList[i + 1] = cur;
        priorNetQty += (Number(next.qn) || 0);
        continue;
      }
    }
    if (regularBuyTrty.has(curTrty)) priorNetQty += curQn;
    else if (regularSellTrty.has(curTrty)) priorNetQty -= curQn;
  }

  // Group transactions by date for same-day intraday netting
  const byDate: Record<string, { buys: any[]; sells: any[]; corp: any[] }> = {};
  for (let i = 0; i < txList.length; i++) {
    const t = txList[i];
    const dt = (t.dt || '').slice(0, 10);
    if (!byDate[dt]) byDate[dt] = { buys: [], sells: [], corp: [] };
    const trty = Number(t.trty);
    if (trty === 85 || trty === 45) {
      byDate[dt].corp.push(t);
    } else if (regularBuyTrty.has(trty)) {
      byDate[dt].buys.push({ ...t, remQty: Number(t.qn) || 0 });
    } else if (regularSellTrty.has(trty)) {
      byDate[dt].sells.push({ ...t, remQty: Number(t.qn) || 0 });
    }
  }

  const deliveryLots: any[] = [];
  let lotHead = 0;
  const isMf = commonAtyid === 60 || commonAtyid === 61 || commonAtyid === 62;

  const dates = Object.keys(byDate).sort();
  for (let di = 0; di < dates.length; di++) {
    const dt = dates[di];
    const day = byDate[dt];

    // Match same-day buys and sells first ONLY for Stocks/Equities (Intraday netting)
    if (!isMf && day.buys.length > 0 && day.sells.length > 0) {
      for (let bi = 0; bi < day.buys.length; bi++) {
        const b = day.buys[bi];
        for (let si = 0; si < day.sells.length; si++) {
          const s = day.sells[si];
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
              const sPfid = Number(s.pfid);
              const sAmid = Number(s.amid);
              const pName = (sPfid === commonPfid) ? commonPortName : (state.portfolios.find((p: any) => Number(p.id) === sPfid)?.investor_name || `Portfolio ${sPfid}`);
              const atyid = (sPfid === commonPfid && sAmid === commonAmid) ? commonResolvedAtty : resolveAssetType(sPfid, sAmid, Number(s.atyid));
              const aname = (sAmid === commonAmid) ? commonAssetName : getAssetName(sAmid);
              const isin = (sAmid === commonAmid) ? commonIsin : (getAssetISIN(sAmid) || s.isin || '');
              const folio = getFolioNumber(s.sid, sAmid, sPfid);

              results.push({
                portfolioId: s.pfid,
                portfolioName: pName,
                assetName: aname,
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
        }
      }
    }

    // Handle Stock Split Outflow (85) & Inflow (45)
    if (day.corp.length > 0) {
      for (let ci = 0; ci < day.corp.length; ci++) {
        const t = day.corp[ci];
        const trty = Number(t.trty);
        if (trty === 85) {
          const inflow = day.corp.find(x => Number(x.trty) === 45);
          if (inflow && Number(t.qn) > 0) {
            const ratio = Number(inflow.qn) / Number(t.qn);
            for (let li = lotHead; li < deliveryLots.length; li++) {
              const lot = deliveryLots[li];
              lot.qty *= ratio;
              lot.remaining *= ratio;
              lot.costPerUnit /= ratio;
            }
          }
        }
      }
    }

    // Enqueue remaining buys as delivery lots
    for (let bi = 0; bi < day.buys.length; bi++) {
      const b = day.buys[bi];
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
          corpActionOrigin: [38, 46, 47].includes(trty)
        });
      }
    }

    // Process remaining sells against earlier delivery FIFO lots
    for (let si = 0; si < day.sells.length; si++) {
      const s = day.sells[si];
      let delQty = s.remQty;
      if (delQty <= 0) continue;

      const qn = Number(s.qn) || 0;
      const grossSellAmt = Number(s.amt) || (qn * (Number(s.netpr) || Number(s.purpr) || 0));
      const sellPrice = qn > 0 ? (grossSellAmt / qn) : (Number(s.netpr) || Number(s.purpr) || 0);
      const isInPeriod = dt >= fromDate && dt <= toDate;

      const sPfid = Number(s.pfid);
      const sAmid = Number(s.amid);
      const pName = (sPfid === commonPfid) ? commonPortName : (state.portfolios.find((p: any) => Number(p.id) === sPfid)?.investor_name || `Portfolio ${sPfid}`);
      const resolvedAtty = (sPfid === commonPfid && sAmid === commonAmid) ? commonResolvedAtty : resolveAssetType(sPfid, sAmid, Number(s.atyid));
      const aname = (sAmid === commonAmid) ? commonAssetName : getAssetName(sAmid);
      const isin = (sAmid === commonAmid) ? commonIsin : (getAssetISIN(sAmid) || s.isin || '');
      const atyName = (resolvedAtty === commonResolvedAtty) ? commonAssetTypeName : (ASSET_TYPE_MAP[resolvedAtty] || 'Other');

      while (delQty > 0.000001 && lotHead < deliveryLots.length) {
        const lot = deliveryLots[lotHead];
        const mq = Math.min(delQty, lot.remaining);
        const cost = mq * lot.costPerUnit;
        const proceeds = mq * sellPrice;

        lot.remaining -= mq;
        delQty -= mq;

        if (isInPeriod) {
          const taxRes = computeAssetTax(resolvedAtty, aname, cost, proceeds, lot.date || '', dt || '');
          const folio = getFolioNumber(s.sid || lot.sid, sAmid, sPfid);

          const corpActionNote = lot.corpActionOrigin
            ? 'REVIEW: cost basis originates from a merger/demerger. Holding period is calculated from the corporate-action date -- Sec 47(vii)/49(2) may entitle this lot to an earlier original acquisition date from the pre-merger holding, which this engine cannot look up automatically. Verify manually before filing.'
            : '';

          results.push({
            portfolioId: s.pfid,
            portfolioName: pName,
            assetName: aname,
            isin,
            folio,
            amid: s.amid,
            assetType: resolvedAtty,
            assetTypeName: atyName,
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

        if (lot.remaining <= 0.000001) {
          lotHead++;
        }
      }

      if (delQty > 0.000001 && isInPeriod) {
        const proceeds = delQty * sellPrice;
        const purDt = (s.purdt || s.dt || '').slice(0, 10);
        const taxRes = computeAssetTax(resolvedAtty, aname, 0, proceeds, purDt, dt);
        const folio = getFolioNumber(s.sid, sAmid, sPfid);

        results.push({
          portfolioId: s.pfid,
          portfolioName: pName,
          assetName: aname,
          isin,
          amid: s.amid,
          assetType: resolvedAtty,
          assetTypeName: atyName,
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
    }
  }

  const remainingOpenLots = lotHead > 0 ? deliveryLots.slice(lotHead).filter(l => l.remaining > 0.000001) : deliveryLots.filter(l => l.remaining > 0.000001);
  return { results, openLots: remainingOpenLots };
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
  const sortedPfs = [...portfolioIds].map(Number).sort((a, b) => a - b).join(',');
  const cacheKey = `${sortedPfs}_${fromDate}_${toDate}`;
  if (capitalGainsCache.has(cacheKey)) {
    return capitalGainsCache.get(cacheKey)!;
  }

  const expandedSet = new Set<number>(expandPortfolioFamily(portfolioIds));
  const pSet = expandedSet;

  function getScnoteTransferCharges(sc: any, isSell: boolean) {
    if (!sc) return 0;
    let exp = (Number(sc.servtax) || 0) + (Number(sc.tranchrg) || 0) + (Number(sc.othchrg) || 0);
    let stamp = Number(sc.stmpchrgs) || 0;
    if (sc.cstr && typeof sc.cstr === 'string') {
      const parts = sc.cstr.split(';');
      for (let pi = 0; pi < parts.length; pi++) {
        const [k, v] = parts[pi].split('=');
        const key = (k || '').trim().toUpperCase();
        const val = Number(v) || 0;
        if (key === 'ST' || key === 'TC' || key === 'OC' || key === 'GST' || key === 'SEBI') {
          exp += val;
        } else if (key === 'SC') {
          stamp += val;
        }
      }
    }
    return isSell ? exp : (exp + stamp);
  }

  // Build CN charges map: lazily cached until next state refresh
  if (!cachedCnTrades) {
    cachedCnTrades = {};
    for (let i = 0; i < state.bs1.length; i++) {
      const t = state.bs1[i];
      const cnid = Number(t.cnid);
      if (!cnid || cnid <= 0) continue;
      if (!cachedCnTrades[cnid]) cachedCnTrades[cnid] = { totalAmt: 0 };
      cachedCnTrades[cnid].totalAmt += Number(t.amt) || 0;
    }
  }
  const cnTrades = cachedCnTrades;

  if (!cachedScMap) {
    cachedScMap = new Map<number, { sellExp: number; buyExp: number }>();
    const scList = state.scnote1 || [];
    for (let i = 0; i < scList.length; i++) {
      const sc = scList[i];
      const cnid = Number(sc.cnid);
      if (!cnid || cnid <= 0) continue;
      cachedScMap.set(cnid, {
        sellExp: getScnoteTransferCharges(sc, true),
        buyExp: getScnoteTransferCharges(sc, false)
      });
    }
  }
  const scMap = cachedScMap;

  // Group transactions by (pfid, amid, sid for mutual funds/schemes) in a single fast pass
  const txByAsset = new Map<string, any[]>();
  for (let i = 0; i < state.bs1.length; i++) {
    const t = state.bs1[i];
    if (!pSet.has(Number(t.pfid))) continue;
    const atyid = Number(t.atyid);
    // Exclude Derivatives / F&O (Futures & Options) as they are Business Income (PGBP under Sec 43(5)), not Capital Gains
    if (atyid === 30 || atyid === 80 || atyid === 81 || atyid === 82 || atyid === 83) continue;

    const isMf = atyid === 60 || atyid === 61 || atyid === 62;
    const sidKey = (isMf && t.sid) ? `_${t.sid}` : '';
    const key = `${t.pfid}_${t.amid}${sidKey}`;
    let list = txByAsset.get(key);
    if (!list) {
      list = [];
      txByAsset.set(key, list);
    }
    list.push(t);
  }

  const results: any[] = [];

  for (const txList of txByAsset.values()) {
    txList.sort((a: any, b: any) => (a.dt || '').localeCompare(b.dt || ''));
    const ledger = buildAssetFifoLedger(txList, fromDate, toDate, scMap, cnTrades);
    results.push(...ledger.results);
  }

  applySection112AExemption(results);

  capitalGainsCache.set(cacheKey, results);
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
  const numId = isExplicitTrid ? Number(strId.replace('trid_', '')) : Number(strId.replace(/^(c_|t_|v_)/, ''));

  function formatBs1Voucher(tx: any) {
    const resolvedAcid = getAccountForPortfolio(tx.pfid) || tx.acid;
    const isMf = tx.atyid === 60 || tx.atyid === 61 || tx.atyid === 62;
    const ledgers = getStoredLedgers(resolvedAcid);
    const bankLedger = ledgers.find((l: any) => l.name.toLowerCase().includes('bank')) || ledgers[0] || { id: 'Bank', name: 'Bank' };

    const BROKER_MAP: Record<number, string> = {
      1: 'R K Global',
      2: 'RKSV',
      3: 'KARVY',
      4: 'Direct',
      6: 'Kotak Securities Ltd',
      7: 'Zerodha',
      8: 'MStock',
      9: 'Raise Securities',
      10: 'nuvama'
    };

    let cn: any = null;
    if (tx.cnid && Number(tx.cnid) > 0) {
      cn = (state as any).scnote1?.find?.((n: any) => Number(n.cnid) === Number(tx.cnid));
    }

    let brokerName = '';
    let brokerLedger: any = null;

    if (cn && cn.brkrid) {
      brokerName = BROKER_MAP[Number(cn.brkrid)] || '';
      if (brokerName) {
        brokerLedger = ledgers.find((l: any) => 
          l.name.toLowerCase() === brokerName.toLowerCase() || 
          l.name.toLowerCase() === (brokerName + ' a/c').toLowerCase() ||
          Number(l.id) === (100000 + Number(cn.brkrid))
        );
      }
    }

    if (!brokerLedger && tx.narr) {
      const narrLower = tx.narr.toLowerCase();
      brokerLedger = ledgers.filter((l: any) => String(l.groupId) === '75').find((l: any) => {
        const ln = l.name.toLowerCase().replace(/a\/c/g, '').trim();
        return ln.length > 2 && narrLower.includes(ln);
      });
      if (brokerLedger) brokerName = brokerLedger.name.replace(/\s+a\/c$/i, '').trim();
    }

    const counterLedgerId = isMf 
      ? bankLedger.id 
      : (brokerLedger ? brokerLedger.id : (brokerName ? String(100000 + Number(cn?.brkrid || 0)) : ''));

    // Include trades for this contract note, or just this trade
    let tradeTxs = [tx];
    if (cn && tx.cnid && Number(tx.cnid) > 0) {
      const allMatching = state.bs1.filter((t: any) => Number(t.cnid) === Number(tx.cnid));
      if (allMatching.length > 0) {
        tradeTxs = allMatching;
      }
    }

    const lines: any[] = [];
    let totalTradeBuys = 0;
    let totalTradeSells = 0;

    tradeTxs.forEach((t: any) => {
      const isBuy = [19, 20, 12, 25, 30, 35, 36, 37, 38, 39, 40, 45, 46, 47, 48, 49].includes(t.trty);
      const qty = Number(t.qn) || 0;
      const price = Number(t.purpr) || 0;
      const amount = Number(t.amt) || 0;
      if (isBuy) totalTradeBuys += amount;
      else totalTradeSells += amount;

      const assetLedger = state.acmac1.find((l: any) => l.id === t.amid || l.id === (500000 + t.amid)) || { id: String(t.amid), name: getAssetName(t.amid) };

      lines.push({
        id: `asset_${t.trid}`,
        ledgerId: String(assetLedger.id),
        amid: t.amid,
        ledgerName: assetLedger.name || getAssetName(t.amid),
        debit: isBuy ? amount : 0,
        credit: !isBuy ? amount : 0,
        quantity: qty,
        price: price,
        narration: t.narr || ''
      });
    });

    const stt = cn ? (Number(cn.stt) || 0) : 0;
    const stampCharges = cn ? (Number(cn.stmpchrgs) || 0) : 0;
    const gst = cn ? (Number(cn.servtax) || 0) : 0;
    const transCharges = cn ? (Number(cn.tranchrg) || 0) : 0;
    const otherCharges = cn ? (Number(cn.othchrg) || 0) : 0;
    const brokerage = tradeTxs.reduce((sum: number, t: any) => sum + (Number(t.brkg) || 0), 0);

    if (stt > 0) {
      lines.push({
        id: `stt_${tx.trid}`,
        ledgerId: 'stt',
        ledgerName: 'STT',
        debit: stt,
        credit: 0,
        quantity: 0,
        price: 0
      });
    }
    if (stampCharges > 0) {
      lines.push({
        id: `stamp_${tx.trid}`,
        ledgerId: 'stamp',
        ledgerName: 'Stamp Charges',
        debit: stampCharges,
        credit: 0,
        quantity: 0,
        price: 0
      });
    }
    if (gst > 0) {
      lines.push({
        id: `gst_${tx.trid}`,
        ledgerId: 'gst',
        ledgerName: 'GST / Service Tax',
        debit: gst,
        credit: 0,
        quantity: 0,
        price: 0
      });
    }
    if (transCharges > 0) {
      lines.push({
        id: `trans_${tx.trid}`,
        ledgerId: 'trans',
        ledgerName: 'Transaction Charges',
        debit: transCharges,
        credit: 0,
        quantity: 0,
        price: 0
      });
    }
    if (otherCharges > 0) {
      lines.push({
        id: `oth_${tx.trid}`,
        ledgerId: 'charges',
        ledgerName: 'Other Charges',
        debit: otherCharges,
        credit: 0,
        quantity: 0,
        price: 0
      });
    }
    if (brokerage > 0) {
      lines.push({
        id: `brkg_${tx.trid}`,
        ledgerId: 'brokerage',
        ledgerName: 'Brokerage',
        debit: brokerage,
        credit: 0,
        quantity: 0,
        price: 0
      });
    }

    const totalCharges = stt + stampCharges + gst + transCharges + otherCharges + brokerage;
    const netAmount = totalTradeBuys + totalCharges - totalTradeSells;

    lines.push({
      id: `counter_${tx.trid}`,
      ledgerId: String(counterLedgerId || ''),
      ledgerName: isMf ? bankLedger.name : (brokerLedger?.name || brokerName || 'Broker'),
      debit: netAmount < 0 ? Math.abs(netAmount) : 0,
      credit: netAmount >= 0 ? netAmount : 0,
      quantity: 0,
      price: 0,
      narration: tx.narr || ''
    });

    return {
      id: 'trid_' + tx.trid,
      voucherNo: cn?.cnnum ? String(cn.cnnum) : `BS-${tx.trid}`,
      date: (tx.dt || '').substring(0, 10),
      type: isMf ? 'contra' : (totalTradeBuys >= totalTradeSells ? 'purchase' : 'sale'),
      portfolioId: String(tx.pfid),
      accountId: resolvedAcid ? String(resolvedAcid) : undefined,
      narration: tx.narr || (cn?.cnnum ? `Contract Note No: ${cn.cnnum}` : ''),
      lines,
      broker: brokerName || brokerLedger?.name?.replace(/\s+a\/c$/i, '').trim() || '',
      stt,
      stampCharges,
      gst,
      transCharges,
      otherCharges,
      brokerage
    };
  }

  function formatAccountingVoucher(v: any, transSrc: any[]) {
    const vtypMap: Record<number | string, string> = { 1: 'payment', 2: 'payment', 3: 'contra', 4: 'receipt', 5: 'journal', 6: 'payment', 10: 'receipt', 12: 'contra', 14: 'purchase', 15: 'sale' };
    const rawLegs = transSrc.filter((e: any) => e.vid === v.vid);
    const effectiveLegs = rawLegs.length > 0 
      ? rawLegs 
      : (transSrc === state.transC1 ? state.trans1 : state.transC1).filter((e: any) => e.vid === v.vid);

    return { 
      ...v, 
      id: `${transSrc === state.transC1 ? 'c' : 't'}_${v.vid}`, 
      type: vtypMap[v.vtyp] || 'journal',
      voucherNo: v.vchno || (v.vid ? `V-${v.vid}` : ''),
      date: (v.dt || '').substring(0, 10),
      accountId: v.acid ? String(v.acid) : '',
      narration: v.narr || '',
      portfolioId: v.pfid ? String(v.pfid) : (state.bs1.find((t: any) => Number(t.acvch) === v.vid)?.pfid ? String(state.bs1.find((t: any) => Number(t.acvch) === v.vid).pfid) : undefined),
      lines: effectiveLegs
        .map((e: any) => {
          // Broker and bank ledgers are in 100001-100099; assets in acmac1 are 200000+ or 500000+
          const isAsset = Number(e.maid) >= 200000;
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
  let v = null;
  let transSrc = state.transC1;
  if (strId.startsWith('t_')) {
    v = vouchers1Map.get(numId) || (state.vouchers1 || []).find((x: any) => x.vid === numId);
    transSrc = state.trans1;
    if (!v) {
      v = vouchersC1Map.get(numId) || (state.vouchersC1 || []).find((x: any) => x.vid === numId);
      transSrc = state.transC1;
    }
  } else {
    v = vouchersC1Map.get(numId) || (state.vouchersC1 || []).find((x: any) => x.vid === numId);
    transSrc = state.transC1;
    if (!v) {
      v = vouchers1Map.get(numId) || (state.vouchers1 || []).find((x: any) => x.vid === numId);
      transSrc = state.trans1;
    }
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
  // In a demerger, the parent asset's credit line transfers cost basis in the accounting ledger (transc1)
  // without altering parent share quantity. Do not write a 0-quantity trade row to bs1 for this leg.
  if (data.type === 'demerger' && Number(assetLine.credit) > 0) return null;
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
  const existingSum = state.sumTable.find((s: any) => Number(s.amid) === amid && Number(s.pfolio_id) === pfid);
  const existingBs = state.bs1.find((b: any) => Number(b.amid) === amid && b.atyid);
  const atyid = assetLine.atyid ? Number(assetLine.atyid) : resolveAssetType(pfid, amid, asset?.asset_type || existingSum?.atty || existingBs?.atyid);

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
  // Use in-memory state.bs1 as the primary source of truth for transactions
  const txs = state.bs1.filter((t: any) => Number(t.pfid) === portfolioId && Number(t.amid) === amid);

  let qty = 0;
  let amtInvested = 0;
  const existingSum = state.sumTable.find((s: any) => Number(s.pfolio_id) === portfolioId && Number(s.amid) === amid);
  let assetType = resolveAssetType(portfolioId, amid, existingSum?.atty);

  const sortedTxs = [...txs].sort((a: any, b: any) => (a.dt || '').localeCompare(b.dt || '') || (Number(a.trid) - Number(b.trid)));

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

  const price = state.priceMap[amid]?.curr || 0;
  const currv = qty > 0 ? (price > 0 ? qty * price : amtInvested) : amtInvested;
  const effectiveQty = qty > 0 ? qty : (amtInvested > 0 ? 1 : 0);

  const summaryRow: any = {
    pfolio_id: portfolioId,
    client_id: 1,
    atty: assetType,
    amid,
    qnt: effectiveQty,
    amtinv: amtInvested,
    currv,
    tgain: 0
  };

  const localIdx = state.sumTable.findIndex(s => Number(s.pfolio_id) === portfolioId && Number(s.amid) === amid);
  if (localIdx >= 0) {
    state.sumTable[localIdx] = { ...state.sumTable[localIdx], ...summaryRow };
    if (await isSupabaseReachable()) {
      try {
        await supabase
          .from('sum_table')
          .update(summaryRow)
          .eq('sid', state.sumTable[localIdx].sid);
      } catch (e: any) {
        console.warn("syncPortfolioStats: sum_table update exception (offline?):", e.message);
      }
    }
  } else {
    const allIds = state.sumTable.map(s => Number(s.sid)).filter(id => !isNaN(id));
    const nextSid = allIds.length > 0 ? Math.max(...allIds) + 1 : 1001;
    summaryRow.sid = nextSid;
    state.sumTable.push({ ...summaryRow, _src: 'c' });
    if (await isSupabaseReachable()) {
      try {
        await supabase.from('sum_table').insert(summaryRow);
      } catch (e: any) {
        console.warn("syncPortfolioStats: sum_table insert exception (offline?):", e.message);
      }
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
      
      let vErr: any = null;
      try {
        if (await isSupabaseReachable()) {
          const res = await supabase.from('vouchersc1').insert(voucherRow);
          vErr = res.error;
        }
      } catch (err: any) {
        console.warn('⚠️ Supabase offline, saving voucher header to local state:', err?.message);
        vErr = null;
      }

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

        // Exact ledger IDs from Chart of Accounts (Capital Gains group id=180)
        const GAIN_LEDGERS = {
          STCG_EQUITY: 460,  // Short Term Gain (Equity)  — <=12 months
          LTCG_EQUITY: 465,  // Long Term Gain (Equity)   — >12 months
          STCG_DEBT:   470,  // Short Term Gain (Debt)    — <=36 months (or post-Apr-2023 under Sec 50AA)
          LTCG_DEBT:   475,  // Long Term Gain (Debt)     — >36 months (pre-Apr-2023 only)
          STCG_BONDS:  490,  // Short Term Gain (Bonds)   — <=36 months
          LTCG_BONDS:  485,  // Long Term Gain (Bonds)    — >36 months
        };

        // Find asset type (atyid) from bs1
        const bs1Asset = state.bs1.find((t: any) => t.pfid === pfid && t.amid === amid);
        const atyid = bs1Asset?.atyid || 0;

        const EQUITY_GROUPS = new Set([200050, 200051, 200061, 50]);
        const DEBT_GROUPS   = new Set([200062, 200058]);
        const BOND_GROUPS   = new Set([200040, 200070]);

        // Helper to determine the gain ledger for a specific lot based on asset type,
        // holding period, and Section 50AA (post-01-Apr-2023 debt funds are strictly STCG).
        const getLotGainLedgerId = (lotDate: string): number => {
          const holdingDays = Math.abs((new Date(data.date).getTime() - new Date(lotDate).getTime()) / 86400000);
          if (EQUITY_GROUPS.has(atyid)) {
            return holdingDays > 365 ? GAIN_LEDGERS.LTCG_EQUITY : GAIN_LEDGERS.STCG_EQUITY;
          } else if (DEBT_GROUPS.has(atyid)) {
            // Task 1.3: Section 50AA enforcement: specified debt funds acquired on/after 01-April-2023
            // are deemed short-term capital gains at slab rate, irrespective of holding days.
            if ((lotDate || '').slice(0, 10) >= '2023-04-01') {
              return GAIN_LEDGERS.STCG_DEBT;
            }
            return holdingDays > 1095 ? GAIN_LEDGERS.LTCG_DEBT : GAIN_LEDGERS.STCG_DEBT;
          } else if (BOND_GROUPS.has(atyid)) {
            return holdingDays > 1095 ? GAIN_LEDGERS.LTCG_BONDS : GAIN_LEDGERS.STCG_BONDS;
          }
          return holdingDays > 365 ? GAIN_LEDGERS.LTCG_EQUITY : GAIN_LEDGERS.STCG_EQUITY;
        };

        // Push Asset Line (Cost Basis only)
        processedLines.push({ ...l, credit: Number(totalCost.toFixed(2)) });

        // Task 1.4: Multi-Lot Split: allocate gains/losses per consumed lot to the exact STCG / LTCG ledgers
        const gainsByLedger: Record<number, number> = {};
        const salePricePerUnit = qtySold > 0 ? (proceeds / qtySold) : 0;
        let matchedQtySum = 0;

        if (matchedLots.length > 0) {
          matchedLots.forEach(m => {
            const lotLedgerId = getLotGainLedgerId(m.date);
            const lotProceeds = m.qty * salePricePerUnit;
            const lotCost = m.qty * m.costPerUnit;
            const lotGain = lotProceeds - lotCost;
            gainsByLedger[lotLedgerId] = (gainsByLedger[lotLedgerId] || 0) + lotGain;
            matchedQtySum += m.qty;
          });
        }

        // If there is an unmatched quantity portion (e.g. sale without recorded buy lot history)
        if (qtySold > matchedQtySum) {
          const unmatchedQty = qtySold - matchedQtySum;
          const defaultLedgerId = getLotGainLedgerId(data.date);
          const unmatchedProceeds = unmatchedQty * salePricePerUnit;
          const unmatchedCost = Math.max(0, totalCost - matchedLots.reduce((s, m) => s + (m.qty * m.costPerUnit), 0));
          const unmatchedGain = unmatchedProceeds - unmatchedCost;
          gainsByLedger[defaultLedgerId] = (gainsByLedger[defaultLedgerId] || 0) + unmatchedGain;
        }

        // Exact penny balance adjustment: ensure sum(gain lines) + totalCost strictly equals proceeds
        const ledgerEntries = Object.entries(gainsByLedger).map(([idStr, amt]) => ({
          ledgerId: Number(idStr),
          netGain: Number(amt.toFixed(2))
        }));

        const totalGainsRounded = ledgerEntries.reduce((s, e) => s + e.netGain, 0);
        const expectedTotalGain = Number((proceeds - Number(totalCost.toFixed(2))).toFixed(2));
        const roundingDiff = Number((expectedTotalGain - totalGainsRounded).toFixed(2));

        if (Math.abs(roundingDiff) > 0 && ledgerEntries.length > 0) {
          ledgerEntries.sort((a, b) => Math.abs(b.netGain) - Math.abs(a.netGain));
          ledgerEntries[0].netGain = Number((ledgerEntries[0].netGain + roundingDiff).toFixed(2));
        }

        // Push Gain/Loss lines to the respective STCG / LTCG ledgers
        for (const entry of ledgerEntries) {
          if (entry.netGain > 0) {
            processedLines.push({ ledgerId: entry.ledgerId, debit: 0, credit: entry.netGain });
          } else if (entry.netGain < 0) {
            processedLines.push({ ledgerId: entry.ledgerId, debit: Math.abs(entry.netGain), credit: 0 });
          }
        }
        continue; // Skip pushing the original line
      }
    }
    processedLines.push(l);
  }

  const lines = processedLines;

  // ── Voucher balance validation ────────────────────────────────────────────
  // Strict double-entry balance check: total debits strictly equal total credits.
  const STRICT_BALANCE_TYPES = new Set(['payment', 'receipt', 'journal', 'contra', 'sale', 'opening_balance', 'demerger']);
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

      let tErr: any = null;
      try {
        if (await isSupabaseReachable()) {
          const res = await supabase.from('transc1').insert(transRows);
          tErr = res.error;
        }
      } catch (err: any) {
        console.warn('⚠️ Supabase offline, saving transaction lines to local state:', err?.message);
        tErr = null;
      }

      if (!tErr) {
        inserted = true;
        break;
      }
      lastError = tErr;
      const isConflict = (tErr as any).code === '23505' || /duplicate key/i.test(tErr.message || '');
      if (!isConflict || attempt === MAX_ATTEMPTS - 1) {
        console.error('❌ Failed to save entries:', tErr.message);
        try { if (await isSupabaseReachable()) await supabase.from('vouchersc1').delete().eq('vid', vid); } catch {}
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

          let bsErr: any = null;
          try {
            if (await isSupabaseReachable()) {
              const res = await supabase.from('bs1').insert(bsRow);
              bsErr = res.error;
            }
          } catch (err: any) {
            console.warn('⚠️ Supabase offline, saving bs1 trade to local state:', err?.message);
            bsErr = null;
          }

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
    await persistStateToIDB();
  }
}

export async function updateVoucher(data: any) {
  let rawVid = null;
  let isPureBs1 = false;
  if (data.id) {
    const match = String(data.id).match(/\d+/);
    if (match) {
      let candidateVid = Number(match[0]);

      // If the passed id was a bs1 trid, check if it has a linked voucher vid (acvch)
      const bsMatch = state.bs1.find((t: any) => t.trid === candidateVid);
      if (bsMatch) {
        if (bsMatch.acvch && Number(bsMatch.acvch) > 0) {
          candidateVid = Number(bsMatch.acvch);
        } else {
          isPureBs1 = true;
        }
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
    const affectedStats = txs.map((t: any) => ({ pfid: t.pfid, amid: t.amid })).filter((t: any) => t.pfid && t.amid);

    if (await isSupabaseReachable()) {
      try {
        await supabase.from('transc1').delete().eq('vid', rawVid);
        await supabase.from('vouchersc1').delete().eq('vid', rawVid);
        await supabase.from('trans1').delete().eq('vid', rawVid);
        await supabase.from('vouchers1').delete().eq('vid', rawVid);
        await supabase.from('bs1').delete().or(`trid.eq.${rawVid},acvch.eq.${rawVid}`);
      } catch (e: any) {
        console.warn('⚠️ updateVoucher: Supabase delete failed (offline?), continuing with local state:', e.message);
      }
    }

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
  // For pure bs1 trade edits, don't force rawVid as voucher vid; let createVoucher allocate nextVid()
  await createVoucher(data, isPureBs1 ? undefined : (rawVid || undefined));
  await persistStateToIDB();
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

    if (await isSupabaseReachable()) {
      try {
        await Promise.all([
          supabase.from('transc1').delete().eq('vid', rawVid),
          supabase.from('vouchersc1').delete().eq('vid', rawVid),
          supabase.from('trans1').delete().eq('vid', rawVid),
          supabase.from('vouchers1').delete().eq('vid', rawVid),
          supabase.from('bs1').delete().or(`trid.eq.${rawVid},acvch.eq.${rawVid}`)
        ]);
      } catch (e: any) {
        console.warn('⚠️ deleteVoucher: Supabase delete failed (offline?), continuing with local state:', e.message);
      }
    }

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
    await persistStateToIDB();
  }
}

export async function saveLedger(ledger: any) { console.log('saveLedger stub', ledger?.id); }
export async function deleteLedger(id: any) { console.log('deleteLedger stub', id); }
export async function saveMasterRecord(type: any, record: any) { 
  if (type === 'portfolios') {
    const pfolio_type = record.portfolioType === 'Equity' ? 1 
      : record.portfolioType === 'Mutual Funds' ? 2 
      : record.portfolioType === 'Fixed Income' ? 3 
      : record.portfolioType === 'Real Estate' ? 4 
      : record.portfolioType === 'F&O / Currency' ? 5 
      : 0;

    if (record.id) {
      const { error } = await supabase.from('portfolios').update({ 
        investor_name: record.portfolioName,
        pfolio_type 
      }).eq('id', record.id);
      
      if (!error) {
        const p = state.portfolios.find(pf => String(pf.id) === String(record.id));
        if (p) {
          p.investor_name = record.portfolioName;
          p.pfolio_type = pfolio_type;
        }

        if (record.accountId) {
          await supabase.from('acc_pflink').delete().eq('pfid', record.id);
          await supabase.from('acc_pflink').insert({ pfid: record.id, acid: record.accountId, client_id: 1 });
          state.accPflink = state.accPflink.filter(l => String(l.pfid) !== String(record.id));
          state.accPflink.push({ pfid: record.id, acid: record.accountId, client_id: 1 });
        }
      }
    }
  } else {
    console.log('saveMasterRecord stub', type);
  }
}
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
    const hasEnoughPrices = Object.keys(state.priceMap || {}).length >= 100;
    const lastSyncDate = (state as any)._lastSyncDate;
    if (!force && !isMarketHours && lastSyncDate === todayStr && hasEnoughPrices) {
      console.log(`Market closed (IST ${hours}:xx, day ${day}) and already synced today. Skipping auto-sync.`);
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

    // 2. Resolve asset details from in-memory state (instant, 0 network blocking)
    const assetMap = new Map<number, any>();
    (state.assetMaster || []).forEach((a: any) => assetMap.set(Number(a.amid), a));
    (state.sam || []).forEach((s: any) => {
      const amid = Number(s.amid);
      if (!assetMap.has(amid)) {
        assetMap.set(amid, {
          amid,
          name: s.anm || s.alias || s.isr || `Asset ${amid}`,
          asset_type: Number(s.atyp) || 50,
          asset_type_name: ASSET_TYPE_MAP[Number(s.atyp)] || 'Stocks',
          exchange_group: null,
          bse_code: Number(s.exint1) || null,
          amfi_code: Number(s.exint2) || null,
          nse_symbol: s.alias || null,
          ticker: s.alias || null,
          isin: s.extstr || null
        });
      }
    });

    const assets: any[] = [];
    const missingAmids: number[] = [];
    amids.forEach(id => {
      const a = assetMap.get(id);
      if (a) assets.push(a);
      else missingAmids.push(id);
    });

    if (missingAmids.length > 0 && await isSupabaseReachable()) {
      try {
        const CHUNK = 100;
        for (let i = 0; i < missingAmids.length; i += CHUNK) {
          const { data } = await supabase
            .from('asset_master')
            .select('*')
            .in('amid', missingAmids.slice(i, i + CHUNK));
          if (data) assets.push(...data);
        }
      } catch (e) {
        console.warn('Remote asset_master query failed (non-fatal):', e);
      }
    }
    console.log(`Found ${assets.length} assets to sync.`);

    // 3. Load yesterday's closing prices from memory as a fallback for prevp.
    const yesterdayIST = new Date(nowIST);
    yesterdayIST.setUTCDate(yesterdayIST.getUTCDate() - 1);
    while (yesterdayIST.getUTCDay() === 0 || yesterdayIST.getUTCDay() === 6) {
      yesterdayIST.setUTCDate(yesterdayIST.getUTCDate() - 1);
    }
    const yesterdayStr = yesterdayIST.toISOString().slice(0, 10);

    const prevClosePrices = new Map<number, number>();
    // Fast in-memory lookup from state.mprices and state.priceMap
    (state.mprices || []).forEach((r: any) => {
      if (r.date === yesterdayStr && Number(r.currp) > 0) {
        prevClosePrices.set(Number(r.amid), Number(r.currp));
      } else if (!prevClosePrices.has(Number(r.amid)) && Number(r.currp) > 0) {
        prevClosePrices.set(Number(r.amid), Number(r.currp));
      }
    });
    Object.entries(state.priceMap || {}).forEach(([idStr, p]: [string, any]) => {
      const id = Number(idStr);
      if (!prevClosePrices.has(id)) {
        if (p.prev > 0) prevClosePrices.set(id, p.prev);
        else if (p.curr > 0) prevClosePrices.set(id, p.curr);
      }
    });

    // 4. Fetch live prices concurrently in small batches
    const fetchedPrices: Array<{ amid: number; currp: number; prevp: number; date: string; source_id_atyp: number }> = [];
    const BATCH_SIZE = 6;
    for (let i = 0; i < assets.length; i += BATCH_SIZE) {
      const batch = assets.slice(i, i + BATCH_SIZE);
      if (onProgress) {
        onProgress(`Fetching prices (${Math.min(i + BATCH_SIZE, assets.length)}/${assets.length})...`);
      }
      const results = await Promise.allSettled(batch.map(async (asset) => {
        const price = await getLivePrice(asset);
        if (price && price.price > 0) {
          let prevp = Math.max(0, price.price - price.change);
          if (prevp === 0 || prevp === price.price) {
            prevp = prevClosePrices.get(asset.amid) ?? price.price;
          }
          return {
            amid: asset.amid,
            currp: price.price,
            prevp,
            date: todayStr,
            source_id_atyp: asset.asset_type
          };
        }
        return null;
      }));

      results.forEach(res => {
        if (res.status === 'fulfilled' && res.value) {
          fetchedPrices.push(res.value);
        }
      });
      // Small pause between batches to respect rate limits
      await new Promise(res => setTimeout(res, 80));
    }

    if (fetchedPrices.length === 0) {
      console.log('No live prices fetched.');
      return;
    }

    // 5. Update in-memory state FIRST so UI refreshes immediately
    fetchedPrices.forEach((p: any) => {
      state.priceMap[p.amid] = { curr: p.currp, prev: p.prevp };
      const idx = (state.mprices || []).findIndex((m: any) => m.amid === p.amid && m.date === p.date);
      if (idx >= 0) {
        state.mprices[idx] = { ...state.mprices[idx], ...p };
      } else {
        state.mprices.push(p);
      }
    });

    // Enforce delisted / fixed asset price guarantees
    state.priceMap[100183] = { curr: 0.20, prev: 0.20 };
    (state as any)._lastSyncDate = todayStr;

    // Recalculate currv on state.sumTable so all summary calculations match new prices
    state.sumTable.forEach((s: any) => {
      const p = state.priceMap[s.amid];
      if (p && p.curr > 0 && Number(s.qnt) > 0) {
        s.currv = Number(s.qnt) * p.curr;
      }
    });

    rebuildAllIndexes();

    // Cache updated state in IndexedDB
    if (typeof indexedDB !== 'undefined') {
      try {
        await set('wealthcore_state_v28', JSON.parse(JSON.stringify(state)));
      } catch (idbErr) {
        console.warn('IDB price update failed:', idbErr);
      }
    }

    // 6. Persist to Supabase if reachable
    if (await isSupabaseReachable()) {
      try {
        if (onProgress) onProgress(`Saving ${fetchedPrices.length} prices to cloud...`);
        const CHUNK = 100;
        const amidsToSave = fetchedPrices.map(p => p.amid);
        for (let i = 0; i < amidsToSave.length; i += CHUNK) {
          await supabase.from('mprices').delete().eq('date', todayStr).in('amid', amidsToSave.slice(i, i + CHUNK));
        }
        for (let i = 0; i < fetchedPrices.length; i += CHUNK) {
          await supabase.from('mprices').insert(fetchedPrices.slice(i, i + CHUNK));
        }
      } catch (cloudErr) {
        console.warn('Supabase price push failed (non-fatal):', cloudErr);
      }
    }
    console.log(`✅ Sync done: ${fetchedPrices.length} prices updated for ${todayStr}.`);
  } catch (err) {
    console.error('❌ Live price sync failed:', err);
    throw err;
  }
}

export async function ensureLedgerExists(name: string, groupId: string, acid?: number, extra?: { descr?: string; addinfo?: string }): Promise<Ledger | null> {
  const acidNum = acid ? Number(acid) : null;
  if (!acidNum) {
    console.error("ensureLedgerExists: acid is required");
    return null;
  }
  if (!name || !name.trim()) {
    return null;
  }

  const groupMapping: Record<string, number> = {
    stocks: 200050,
    mf_equity: 200061,
    mf_debt: 200062,
    fd: 200095,
    fds: 200095,
    fixed_deposits: 200095,
    ppf: 200120,
    epf: 200120,
    bonds: 200040,
    traded_bonds: 200040,
    ncd: 200070,
    debentures: 200070,
    gold: 200075,
    silver: 200077,
    jewellery: 200155,
    properties: 200150,
    nps: 200141,
    ulip: 200141,
    insurance: 200140,
    deposits_loans: 200115,
    post_office: 200135,
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
    a.name && (
      a.name.toLowerCase() === name.toLowerCase() ||
      (parentId === 200120 && Number(a.parent_id) === 200120 && (
        (a.name.toLowerCase().includes('ppf') && name.toLowerCase().includes('ppf')) ||
        (a.name.toLowerCase().includes('epf') && name.toLowerCase().includes('epf'))
      ))
    )
  );

  if (existing) {
    if (extra?.descr && !existing.descr) {
      existing.descr = extra.descr;
      if (extra?.addinfo) existing.addinfo = extra.addinfo;
      if (typeof window !== 'undefined') {
        isSupabaseReachable().then(online => {
          if (online) {
            supabase.from('acmac1').update({ descr: extra.descr, addinfo: extra.addinfo }).eq('id', existing.id);
          }
        });
      }
    }
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

  const isAssetGroup = parentId >= 200000 || ASSET_GROUP_IDS.includes(parentId);
  const MAX_ATTEMPTS = 10;
  for (let attempt = 0; attempt < MAX_ATTEMPTS; attempt++) {
    let nextId: number;
    if (isAssetGroup) {
      const assetIds = state.acmac1.map((a: any) => Number(a.id)).filter(id => id >= 500000 && !isNaN(id));
      nextId = (assetIds.length > 0 ? Math.max(...assetIds) : 504000) + 1 + attempt;
    } else {
      const allIds = state.acmac1.map((a: any) => Number(a.id)).filter(id => id < 100000 && !isNaN(id));
      nextId = (allIds.length > 0 ? Math.max(...allIds) : 1000) + 1 + attempt;
    }

    const newRow = {
      id: nextId,
      name,
      parent_id: parentId,
      is_group: false,
      acid: acidNum,
      special_type_id: 150,
      descr: extra?.descr || null,
      addinfo: extra?.addinfo || null
    };

    if (await isSupabaseReachable()) {
      try {
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

        const isConflict = (error as any).code === '23505' || /duplicate key/i.test(error.message || '');
        if (isConflict && attempt < MAX_ATTEMPTS - 1) {
          console.warn(`⚠️ ledger id ${nextId} collided (attempt ${attempt + 1}/${MAX_ATTEMPTS}), retrying with a higher id...`);
          continue;
        }
      } catch (cloudErr: any) {
        console.warn('⚠️ ensureLedgerExists Supabase insert failed (offline?), falling back locally:', cloudErr?.message);
      }
    }

    // Local fallback when offline or remote failed
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

  return null;
}

export async function updateAssetPrice(assetId: string, price: number) {
  const amidNum = Number(assetId);
  if (isNaN(amidNum)) return;

  const todayStr = new Date().toISOString().split('T')[0];
  const asset = state.assetMaster.find((a: any) => a.amid === amidNum);
  const source_id_atyp = asset ? asset.asset_type : 50;
  const prevPrice = state.priceMap[amidNum]?.curr || price;

  // 1. Immediately update in-memory state
  state.priceMap[amidNum] = { curr: price, prev: prevPrice };

  if (!state.mprices) state.mprices = [];
  const priceRow = {
    amid: amidNum,
    currp: price,
    prevp: prevPrice,
    date: todayStr,
    source_id_atyp
  };
  const existingIdx = state.mprices.findIndex((p: any) => Number(p.amid) === amidNum && p.date === todayStr);
  if (existingIdx >= 0) {
    state.mprices[existingIdx] = { ...state.mprices[existingIdx], ...priceRow };
  } else {
    state.mprices.unshift(priceRow);
  }

  // 2. Update currv in sumTable for this asset
  if (state.sumTable) {
    state.sumTable.forEach((s: any) => {
      if (Number(s.amid) === amidNum) {
        const qty = Number(s.qnt) || 0;
        s.currv = qty * price;
      }
    });
  }

  rebuildAllIndexes();

  // 3. Persist to IndexedDB
  await persistStateToIDB();

  // 4. Update cloud in background if online
  if (await isSupabaseReachable()) {
    try {
      await supabase.from('mprices').delete().eq('amid', amidNum).eq('date', todayStr);
      await supabase.from('mprices').insert(priceRow);
    } catch (e: any) {
      console.warn('⚠️ Supabase price update failed (offline?):', e?.message);
    }
  }

  console.log(`✅ Asset price updated: amid=${amidNum}, price=${price}`);
}

export async function forceRefreshDatabase() {
  state.initialized = false;
  state.priceMap = {};
  state.assetNameMap = {};
  isBackgroundSyncing = false;
  await performBackgroundSync();
  state.initialized = true;
  if (typeof window !== 'undefined') {
    window.dispatchEvent(new Event('wealthcore-sync-complete'));
  }
}

export async function togglePortfolioStatus(portfolioId: string, isActive: boolean) {
  const newStatus = isActive ? 1 : 0;
  
  // If activating and the name starts with 'x', strip it so it actually becomes active in UI
  const p = state.portfolios.find(pf => String(pf.id) === String(portfolioId));
  let newName = p ? p.investor_name : undefined;
  if (isActive && newName && newName.toLowerCase().startsWith('x')) {
    newName = newName.replace(/^x\s*/i, '');
  }

  const updates: any = { exit_status: newStatus };
  if (newName && newName !== p?.investor_name) {
    updates.investor_name = newName;
  }

  const { error } = await supabase.from('portfolios').update(updates).eq('id', portfolioId);
  if (error) {
    console.error('Failed to toggle portfolio status', error);
  } else {
    if (p) {
      p.exit_status = newStatus;
      if (updates.investor_name) p.investor_name = updates.investor_name;
    }
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
    const STRICT_BALANCE_TYPES = new Set(['payment', 'receipt', 'journal', 'contra', 'sale', 'sales', 'demerger']);
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
