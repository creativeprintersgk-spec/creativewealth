/**
 * WealthCore - Asset Master Service
 * 
 * Handles:
 * - Asset search (stocks + MF) from Supabase asset_master table
 * - Live NAV fetch for Mutual Funds via mfapi.in (free, no API key)
 * - Live price fetch for Stocks via Yahoo Finance (free, no API key)
 * - Price caching to avoid repeated API calls
 */

import { supabase } from '../supabase';

// ─── Types ───────────────────────────────────────────────────────────────────

export interface AssetMaster {
  amid: number;
  name: string;
  asset_type: number;        // 50=Stock, 60=MF, 40=Bond, 75=Gold, etc.
  asset_type_name: string;
  exchange_group: string | null;  // A, B, S, Z (BSE groups, stocks only)
  bse_code: number | null;
  amfi_code: number | null;
  nse_symbol: string | null;
  ticker: string | null;
}

export interface LivePrice {
  amid: number;
  name: string;
  price: number;
  change: number;       // absolute change
  change_pct: number;   // % change
  as_of: string;        // date string
  source: 'mfapi' | 'yahoo' | 'cached';
}

// In-memory price cache (resets on page refresh — OK for a session)
const priceCache = new Map<number, { price: LivePrice; fetchedAt: number }>();
const CACHE_TTL_MS = 5 * 60 * 1000; // 5 minutes

// ─── Asset Search ─────────────────────────────────────────────────────────────

/**
 * Search assets by name. Returns top 20 matches.
 * Used for the asset picker in transaction modals.
 */
export async function searchAssets(
  query: string,
  assetType?: number   // pass 50 for stocks only, 60 for MF only, undefined for all
): Promise<AssetMaster[]> {
  if (!query || query.trim().length < 2) return [];

  let q = supabase
    .from('asset_master')
    .select('amid, name, asset_type, asset_type_name, exchange_group, bse_code, amfi_code, ticker')
    .ilike('name', `%${query.trim()}%`)
    .limit(20);

  if (assetType !== undefined) {
    q = q.eq('asset_type', assetType);
  }

  const { data, error } = await q;
  if (error) {
    console.error('Asset search error:', error.message);
    return [];
  }
  return data || [];
}

/**
 * Search by BSE code (for broker import matching)
 */
export async function findByBseCode(bseCode: number): Promise<AssetMaster | null> {
  const { data } = await supabase
    .from('asset_master')
    .select('*')
    .eq('bse_code', bseCode)
    .single();
  return data || null;
}

/**
 * Search by AMFI code (for CAMS/CDSL CAS import matching)
 */
export async function findByAmfiCode(amfiCode: number): Promise<AssetMaster | null> {
  const { data } = await supabase
    .from('asset_master')
    .select('*')
    .eq('amfi_code', amfiCode)
    .single();
  return data || null;
}

/**
 * Get asset by MProfit ID
 */
export async function getAssetByAmid(amid: number): Promise<AssetMaster | null> {
  const { data } = await supabase
    .from('asset_master')
    .select('*')
    .eq('amid', amid)
    .single();
  return data || null;
}

// ─── Live Price Fetching ──────────────────────────────────────────────────────

/**
 * Fetch live NAV for a Mutual Fund from mfapi.in
 * Free, no API key needed. Returns today's NAV.
 */
async function fetchMFNav(amfiCode: number): Promise<{ price: number; date: string } | null> {
  try {
    const res = await fetch(`https://api.mfapi.in/mf/${amfiCode}/latest`);
    if (!res.ok) return null;
    const data = await res.json();
    if (!data?.data?.[0]) return null;
    return {
      price: parseFloat(data.data[0].nav),
      date: data.data[0].date
    };
  } catch {
    return null;
  }
}

/**
 * Fetch live price for a Stock from Yahoo Finance (BSE)
 * Uses BSE code with .BO suffix e.g. "500002.BO" for Reliance
 * Free, no API key needed.
 */
async function fetchStockPrice(bseCode: number): Promise<{ price: number; change: number; change_pct: number; date: string } | null> {
  try {
    const symbol = `${bseCode}.BO`;
    const url = `https://query1.finance.yahoo.com/v8/finance/chart/${symbol}?interval=1d&range=1d`;
    const res = await fetch(url, {
      headers: { 'User-Agent': 'Mozilla/5.0' }
    });
    if (!res.ok) return null;
    const data = await res.json();
    const meta = data?.chart?.result?.[0]?.meta;
    if (!meta) return null;
    const price = meta.regularMarketPrice ?? meta.previousClose;
    const prev = meta.previousClose ?? price;
    const change = price - prev;
    const change_pct = prev > 0 ? (change / prev) * 100 : 0;
    return {
      price: parseFloat(price.toFixed(2)),
      change: parseFloat(change.toFixed(2)),
      change_pct: parseFloat(change_pct.toFixed(2)),
      date: new Date(meta.regularMarketTime * 1000).toISOString().split('T')[0]
    };
  } catch {
    return null;
  }
}

/**
 * Get live price for any asset (stocks + MF)
 * Automatically routes to the right API based on asset_type.
 * Uses in-memory cache — refreshes every 5 minutes.
 */
export async function getLivePrice(asset: AssetMaster): Promise<LivePrice | null> {
  // Check cache first
  const cached = priceCache.get(asset.amid);
  if (cached && Date.now() - cached.fetchedAt < CACHE_TTL_MS) {
    return { ...cached.price, source: 'cached' };
  }

  let result: LivePrice | null = null;

  // Mutual Fund — use mfapi.in
  if (asset.asset_type === 60 && asset.amfi_code) {
    const nav = await fetchMFNav(asset.amfi_code);
    if (nav) {
      result = {
        amid: asset.amid,
        name: asset.name,
        price: nav.price,
        change: 0,       // mfapi doesn't give previous NAV in /latest
        change_pct: 0,
        as_of: nav.date,
        source: 'mfapi'
      };
    }
  }

  // Stock — use Yahoo Finance BSE
  if (asset.asset_type === 50 && asset.bse_code) {
    const quote = await fetchStockPrice(asset.bse_code);
    if (quote) {
      result = {
        amid: asset.amid,
        name: asset.name,
        price: quote.price,
        change: quote.change,
        change_pct: quote.change_pct,
        as_of: quote.date,
        source: 'yahoo'
      };
    }
  }

  if (result) {
    priceCache.set(asset.amid, { price: result, fetchedAt: Date.now() });
  }

  return result;
}

/**
 * Fetch live prices for multiple assets in parallel (max 10 at a time)
 * Used for the Holdings dashboard to update all prices at once.
 */
export async function getLivePricesBatch(assets: AssetMaster[]): Promise<Map<number, LivePrice>> {
  const results = new Map<number, LivePrice>();
  const CHUNK = 10;

  for (let i = 0; i < assets.length; i += CHUNK) {
    const chunk = assets.slice(i, i + CHUNK);
    const prices = await Promise.allSettled(chunk.map(a => getLivePrice(a)));
    prices.forEach((result, idx) => {
      if (result.status === 'fulfilled' && result.value) {
        results.set(chunk[idx].amid, result.value);
      }
    });
  }

  return results;
}

// ─── CII Indexation Table ─────────────────────────────────────────────────────

/**
 * Capital Gains Indexation (CII) table from MProfit
 * New series: 2001-02 onwards (used for current LTCG calculations on debt funds)
 * Old series: 1981-82 onwards (for grandfathered assets pre-2001)
 */
export const CII_TABLE: Record<number, number> = {
  2001: 100, 2002: 105, 2003: 109, 2004: 113, 2005: 117,
  2006: 122, 2007: 129, 2008: 137, 2009: 148, 2010: 167,
  2011: 184, 2012: 200, 2013: 220, 2014: 240, 2015: 254,
  2016: 264, 2017: 272, 2018: 280, 2019: 289, 2020: 301,
  2021: 317, 2022: 331, 2023: 348, 2024: 363
};

/**
 * Get CII for a financial year
 * Pass the start year of the FY e.g. 2023 for FY 2023-24
 */
export function getCII(year: number): number {
  return CII_TABLE[year] ?? 0;
}

/**
 * Calculate indexed cost for LTCG (debt funds, bonds, property)
 * indexedCost = (purchaseCost × CII_of_sale_year) / CII_of_purchase_year
 */
export function calculateIndexedCost(
  purchaseCost: number,
  purchaseYear: number,
  saleYear: number
): number {
  const ciiPurchase = getCII(purchaseYear);
  const ciSale = getCII(saleYear);
  if (!ciiPurchase || !ciSale) return purchaseCost;
  return (purchaseCost * ciSale) / ciiPurchase;
}
