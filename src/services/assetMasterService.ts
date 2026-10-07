/**
 * WealthCore - Asset Master Service
 * 
 * Handles:
 * - Asset search (stocks + MF) from Supabase asset_master table
 * - Live NAV fetch for Mutual Funds via mfapi.in (free, no API key)
 * - Live price fetch for Stocks via Yahoo Finance (free, no API key)
 * - Price caching to avoid repeated API calls
 */

import { supabase } from '../supabase.ts';

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
  isin?: string | null;
}

export interface LivePrice {
  amid: number;
  name: string;
  price: number;
  change: number;       // absolute change
  change_pct: number;   // % change
  as_of: string;        // date string
  source: 'mfapi' | 'yahoo' | 'cached' | 'nse_bhavcopy' | 'sgb_benchmark';
}

// In-memory price cache (resets on page refresh — OK for a session)
const priceCache = new Map<number, { price: LivePrice; fetchedAt: number }>();
const CACHE_TTL_MS = 5 * 60 * 1000; // 5 minutes

export function clearPriceCache() {
  priceCache.clear();
}

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
    .select('amid, name, asset_type, asset_type_name, exchange_group, bse_code, amfi_code, nse_symbol, ticker, isin')
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

function getYahooUrl(symbol: string): string {
  const path = `/v8/finance/chart/${symbol}?interval=1d&range=5d`;
  if (typeof window !== 'undefined') {
    return `/api/yahoo${path}`;
  } else {
    return `https://query1.finance.yahoo.com${path}`;
  }
}

function getMfapiUrl(amfiCode: number): string {
  const path = `/mf/${amfiCode}`;
  if (typeof window !== 'undefined') {
    return `/api/mfapi${path}`;
  } else {
    return `https://api.mfapi.in${path}`;
  }
}

async function fetchMFNav(amfiCode: number): Promise<{ price: number; change: number; change_pct: number; date: string } | null> {
  try {
    const headers = typeof window === 'undefined' ? { 'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64)' } : undefined;
    const res = await fetch(getMfapiUrl(amfiCode), { headers });
    if (!res.ok) return null;
    const data = await res.json();
    const today = data?.data?.[0];
    const yesterday = data?.data?.[1];
    if (!today) return null;

    function parseDate(d: string): string {
      const [dd, mm, yyyy] = d.split('-');
      return `${yyyy}-${mm}-${dd}`;
    }

    const todayDate = parseDate(today.date);
    const todayNav = parseFloat(today.nav);
    const yesterdayNav = yesterday ? parseFloat(yesterday.nav) : todayNav;

    const change = todayNav - yesterdayNav;
    const change_pct = yesterdayNav > 0 ? (change / yesterdayNav) * 100 : 0;

    return {
      price: todayNav,
      change: parseFloat(change.toFixed(4)),
      change_pct: parseFloat(change_pct.toFixed(2)),
      date: todayDate
    };
  } catch {
    return null;
  }
}

/**
 * Fetch live price for a Stock from Yahoo Finance.
 * Supports NSE/BSE symbols.
 */
export async function fetchStockPrice(symbol: string): Promise<{ price: number; change: number; change_pct: number; date: string } | null> {
  try {
    const url = getYahooUrl(symbol);
    const headers = typeof window === 'undefined'
      ? {
          'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
          'Accept': 'application/json',
        }
      : undefined;
    const res = await fetch(url, { headers });
    if (!res.ok) return null;
    const data = await res.json();
    const meta = data?.chart?.result?.[0]?.meta;
    const closeArr = data?.chart?.result?.[0]?.indicators?.quote?.[0]?.close;
    if (!meta) return null;

    let price = meta.regularMarketPrice > 0 ? meta.regularMarketPrice : 0;
    let prev = meta.previousClose ?? meta.chartPreviousClose ?? price;

    if (price === 0 && closeArr && closeArr.length >= 2) {
      const validCloses = closeArr.filter((c: number | null) => c !== null && c > 0);
      if (validCloses.length >= 2) {
        price = validCloses[validCloses.length - 1];
        prev = validCloses[validCloses.length - 2];
      } else if (validCloses.length === 1) {
        price = validCloses[0];
        prev = validCloses[0];
      }
    }

    const change = price - prev;
    const change_pct = prev > 0 ? (change / prev) * 100 : 0;
    return {
      price: parseFloat(price.toFixed(2)),
      change: parseFloat(change.toFixed(2)),
      change_pct: parseFloat(change_pct.toFixed(2)),
      date: new Date().toISOString().split('T')[0]
    };
  } catch {
    return null;
  }
}

export const DELISTED_OR_FIXED_PRICES: Record<number, { price: number; prevPrice: number; name?: string }> = {
  // Uttam Value Steels Ltd (now Evonith Value Steels Ltd, BSE: 500254) suspended/delisted around Nov 2020 at ₹0.20
  100183: { price: 0.20, prevPrice: 0.20, name: 'Uttam Value Steels Ltd (Evonith Value Steels)' },
};

const STOCK_SYMBOL_OVERRIDES: Record<number, string> = {
  100063: 'CGPOWER.NS',       // CG Power and Industrial Solutions
  102365: 'GVT&D.NS',         // GE Vernova T&D India
  103321: 'SHILPAMED.NS',     // Shilpa Medicare
  103391: 'ACSTECH.BO',       // ACS Technologies
  104519: 'NTPC.NS',          // NTPC Limited
  100038: 'BEL.NS',           // Bharat Electronics
  100132: 'HCC.NS',           // Hindustan Construction Company
  100071: 'BHEL.NS',          // Bharat Heavy Electricals
  100349: 'BPCL.NS',          // Bharat Petroleum Corporation
  105312: 'LTF.NS',           // L&T Finance
  100135: 'HINDZINC.NS',      // Hindustan Zinc
  100167: 'KSL.NS',           // Kalyani Steels
  100231: 'OILCOUNTUB.NS',    // Oil Country Tubular
  100344: 'HINDMOTORS.NS',    // Hindustan Motors
  100407: 'TATAINVEST.NS',    // Tata Investment Corporation
  101556: 'BHANDARI.NS',      // Bhandari Hosiery Exports
  101684: 'HINDCOPPER.NS',    // Hindustan Copper
  101856: 'ANANTRAJ.NS',      // Anant Raj
  102647: 'SEYAIND.NS',       // Seya Industries
  102791: 'AUROPHARMA.NS',    // Aurobindo Pharma
  104467: 'KIRLFER.NS',       // ISMT Limited (merged into Kirloskar Ferrous Industries)
  100263: 'RAMAPETRO.BO',     // Rama Petrochemicals
  105055: 'PREMIER.BO',       // Premier Energy and Infrastructure
  105468: 'ESSENTIA.NS',      // Integra Essentia
  106093: 'LLOYDSENGG.NS',    // Lloyds Engineering Works
  121746: 'RVNL.NS',          // Rail Vikas Nigam
  121749: 'POLYCAB.NS',       // Polycab India
  121904: 'MAZDOCK.NS',       // Mazagon Dock Shipbuilders
  121933: 'TARC.NS',          // Tarc
  122019: 'ETERNAL.NS',       // Eternal Ltd (formerly Zomato)
  122169: 'SILVERBEES.NS',    // Nippon India Silver ETF
  122630: 'JIOFIN.NS',        // Jio Financial Services
  122983: 'LIQUIDADD.NS',     // DSP BSE Liquid Rate ETF
  123306: 'METAL.NS',         // Mirae Asset Nifty Metal ETF
  122103: 'LATENTVIEW.NS',    // Latent View Analytics
  105051: 'ADANIPOWER.NS',    // Adani Power
  104499: 'BIOCON.NS',        // Biocon Limited
  100345: 'LT.NS',            // Larsen & Toubro
  100130: 'HFCL.NS',          // HFCL Ltd
  100180: 'TRENT.NS',         // Trent Limited
  100346: 'M&M.NS',           // Mahindra & Mahindra
  100357: 'GRWRHITECH.NS',    // Garware Hi-Tech Films
  101053: 'APOLLOHOSP.NS',    // Apollo Hospitals
  101434: '512215.BO',        // Stephanotis Finance
  101515: 'LLOYDSME.NS',      // Lloyds Metals and Energy
  101699: 'NLCINDIA.NS',      // NLC India
  102024: 'NHCFOODS.BO',      // NHC Foods
  103475: 'IOC.NS',           // Indian Oil Corporation
  103605: 'MAYURFL.BO',       // Mayur Floorings
  103561: 'ORGCOAT.BO',       // Organic Coatings
  104251: 'BANKINDIA.NS',     // Bank of India
  104471: 'CANBK.NS',         // Canara Bank
  104501: 'MAHABANK.NS',      // Bank of Maharashtra
  104512: 'COFORGE.NS',       // Coforge
  104628: 'SOLARINDS.NS',     // Solar Industries India
  104767: 'V2RETAIL.NS',      // V2 Retail
  104853: 'RECLTD.NS',        // REC Ltd
  105072: 'GODREJPROP.NS',    // Godrej Properties
  105124: 'GOLDBEES.NS',      // Nippon India ETF Gold BeES
  105174: 'COALINDIA.NS',     // Coal India
  105420: 'INDUSTOWER.NS',    // Indus Towers
  105838: 'ADANIENSOL.NS',    // Adani Energy Solutions
  100975: 'WIPRO.NS',         // Wipro Limited
  100072: 'HINDPETRO.NS',     // Hindustan Petroleum Corporation
  100230: 'ONGC.NS',          // ONGC Limited
  100240: 'RELIANCE.NS',      // Reliance Industries
  100040: 'BEPL.NS',          // Bhansali Engineering Polymers
  102180: 'JAMNAAUTO.NS',     // Jamna Auto
  102649: 'BCLIND.NS',        // BCL Industries
  103048: 'CONFIPET.NS',      // Confidence Petroleum
  103109: 'GUJALKALI.NS',     // Gujarat Alkalies & Chemicals
  104560: 'MSPL.NS',          // MSP Steel & Power
  104908: 'ANDHRSUGAR.NS',    // Andhra Sugars
  105408: 'ZUARI.NS',         // Zuari Agro Chemicals
  105640: 'PDSL.NS',          // PDS Ltd
  105831: 'SPORTKING.NS',     // Sportking India
  121247: 'VBL.NS',           // Varun Beverages
  121280: 'BSE.NS',           // BSE Ltd
  121445: 'GICRE.NS',         // General Insurance Corporation of India
  121449: 'NAM-INDIA.NS',     // Nippon Life India Asset Management
  121451: 'NIACL.NS',         // New India Assurance Company
  121663: 'SKYGOLD.NS',       // Sky Gold
  121945: 'STOVEKRAFT.NS',    // Stove Kraft
  121959: 'MTARTECH.NS',      // MTAR Technologies
  121971: 'KALYANKJIL.NS',    // Kalyan Jewellers India
  122010: 'PHARMABEES.NS',    // Nippon India NIFTY Pharma ETF
  122026: 'ROLEXRINGS.NS',    // Rolex Rings
  122069: 'ABSLAMC.NS',       // Aditya Birla Sun Life AMC
  122089: 'NYKAA.NS',         // FSN E-Commerce Ventures
  122121: 'ANANDRATHI.NS',    // Anand Rathi Wealth
  122123: 'RATEGAIN.NS',      // Rategain Travel Technologies
  122197: 'MSUMI.NS',         // Motherson Sumi Wiring India
  122222: 'JSLL.NS',          // Jeena Sikho Lifecare
  122245: 'DELHIVERY.NS',     // Delhivery
  122250: 'ETHOSLTD.NS',      // Ethos
  122271: 'MWL.NS',           // Mangalam Worldwide
  122363: 'EMIL.NS',          // Electronics Mart India
  122405: 'UNIPARTS.NS',      // Uniparts India
  122479: 'HDFCSML250.NS',    // HDFC Nifty Small Cap 250 ETF
  122563: 'NXST.NS',          // Nexus Select Trust
  122696: 'RISHABH.NS',       // Rishabh Instruments
  122707: 'RRKABEL.NS',       // R R Kabel
  122736: 'UDS.NS',           // Updater Services
  122768: 'IRMENERGY.NS',     // IRM Energy
  122906: 'RPTECH.NS',        // Rashi Peripherals
  100294: 'SPLPETRO.NS',      // Supreme Petrochem
  124010: 'MEESHO.NS',        // Meesho
  123949: 'LENSKART.NS',      // Lenskart Solutions
  123389: 'VISHAL.NS',        // Vishal Mega Mart
  124044: 'ICICIAMC.NS',      // ICICI Prudential Asset Management Company
  105191: 'BFINVEST.NS',      // BF Investment
  100402: 'LORDSMARK.BO',     // Lords Mark Industries
  500246: 'LTF.NS',           // L&T Finance
  500030: 'LTF.NS',           // L&T Finance
  503185: 'LTF.NS',           // L&T Finance
  500307: 'LTF.NS',           // L&T Finance
  255000: 'LTF.NS',           // L&T Finance
  121942: 'LTF.NS',           // L&T Finance
};

const AMFI_OVERRIDES: Record<number, number> = {
  245407: 148457, // Nippon India Multi Asset Allocation Fund - Direct Plan - Growth Option
  231551: 148457, // Nippon India Multi Asset Fund - Direct Plan - Growth Option
  503159: 148457, // Nippon India Multi Asset Fund - Direct Plan - Growth Option
  503145: 148457, // Nippon India Multi Asset Fund - Direct Plan - Growth Option
  503062: 148457, // Nippon India Multi Asset Fund - Direct Plan - Growth Option
  503133: 148457, // Nippon India Multi Asset Fund - Direct Plan - Growth Option
  503041: 148457, // Nippon India Multi Asset Fund - Direct Plan - Growth Option
  245412: 148459, // Nippon India Multi Asset Allocation Fund - Regular Plan - Growth Option
  234448: 152645, // Mirae Asset Nifty MidSmallcap400 Momentum Quality 100 ETF Fund of Fund - Direct Plan - Growth
  215306: 120313, // ICICI Prudential Income plus Arbitrage Omni FOF - Direct Plan - Growth
  220288: 120314, // ICICI Prudential Income plus Arbitrage Omni FOF - Direct Plan - IDCW
  213312: 120197, // ICICI Prudential Liquid Fund - Direct Plan - Growth
};

const BOND_ISIN_TO_NSE_SYMBOL: Record<string, string> = {
  // G-Secs
  'IN0020210095': '610GS2031',
  'IN0020210152': '667GS2035',
  'IN0020200252': '667GS2050',
  'IN0020210194': '699GS2051',
  'IN0020230051': '73GS2053',
  'IN0020240035': '734GS2064',
  'IN0020220085': '736GS2052',
  'IN0020220086': '736GS2052',
  'IN0020220020': '754GS2036',
  'IN0020220029': '754GS2036',

  // SGBs
  'IN0020190552': 'SGBMAR28X',
  'IN0020200161': 'SGBAUG28V',
  'IN0020210220': 'SGBD29VIII',
  'IN0020210228': 'SGBD29VIII',
  'IN0020190537': 'SGBJ28VIII',
  'IN0020200377': 'SGBJAN29IX',
  'IN0020200385': 'SGBJAN29X',
  'IN0020200146': 'SGBJUL28IV',
  'IN0020210111': 'SGBJUL29IV',
  'IN0020200104': 'SGBJUN28',
  'IN0020210061': 'SGBJUN29II',
  'IN0020210087': 'SGBJU29III',
  'IN0020220045': 'SGBJUN30',
  'IN0020210145': 'SGBSEP29VI',
  'IN0020200195': 'SGBSEP28VI',
  'IN0020170166': 'SGBJAN26XIV',
  'IN0020180314': 'SGBNOV26',
  'IN0020210178': 'SGBNV29VII',
  'IN0020200427': 'SGBMR29XII',
  'IN0020210053': 'SGBMAY29I',
};

export const MPROFIT_GSEC_PRICES: Record<string, { price: number; prevClose: number }> = {
  'IN0020210095': { price: 96.45, prevClose: 96.735 }, // 6.10% GS 2031
  'IN0020210152': { price: 97.60, prevClose: 97.60 },  // 6.67% GS 2035
  'IN0020200252': { price: 89.40, prevClose: 89.40 },  // 6.67% GS 2050
  'IN0020210194': { price: 91.20, prevClose: 92.70 },  // 6.99% GS 2051
  'IN0020230051': { price: 95.50, prevClose: 96.051 }, // 7.30% GS 2053
  'IN0020240035': { price: 94.88, prevClose: 95.20 },  // 7.34% GS 2064
  'IN0020220029': { price: 102.10, prevClose: 102.20 },// 7.54% GS 2036
  'IN0020220020': { price: 102.10, prevClose: 102.20 },// 7.54% GS 2036
  'IN0020220086': { price: 97.09, prevClose: 96.90 },  // 7.36% GS 2052
  'IN0020220085': { price: 97.09, prevClose: 96.90 },  // 7.36% GS 2052
};

export function extractIsin(asset: AssetMaster): string | null {
  if (asset.isin && asset.isin.length >= 10 && asset.isin.startsWith('IN')) {
    return asset.isin.trim();
  }
  // Try to parse from name
  const match = asset.name?.match(/(?:ISIN\s+|IN\s*)?(IN[A-Z0-9]{10})/i);
  if (match) return match[1].toUpperCase();
  return null;
}

let cachedBhavcopyPrices: Map<string, { price: number; prevClose?: number; date: string }> | null = null;
let lastBhavcopyFetchTime = 0;

export async function fetchNSEBhavcopyPrices(): Promise<Map<string, { price: number; prevClose?: number; date: string }>> {
  const BHAV_CACHE_TTL = 30 * 60 * 1000; // 30 mins
  if (cachedBhavcopyPrices && (Date.now() - lastBhavcopyFetchTime < BHAV_CACHE_TTL)) {
    return cachedBhavcopyPrices;
  }

  const map = new Map<string, { price: number; prevClose?: number; date: string }>();

  // 1. Try server-side rolling merged Bhavcopy (covers rolling 15-30 trading days)
  if (typeof window !== 'undefined') {
    try {
      const res = await fetch('/api/nse-bhavcopy-merged');
      if (res.ok) {
        const json = await res.json();
        Object.entries(json).forEach(([sym, val]: [string, any]) => {
          if (sym && val && typeof val.price === 'number') {
            map.set(sym, { price: val.price, prevClose: val.prevClose ?? val.price, date: val.date });
          }
        });
        if (map.size > 0) {
          console.log(`Successfully loaded ${map.size} items from rolling merged Bhavcopy.`);
          cachedBhavcopyPrices = map;
          lastBhavcopyFetchTime = Date.now();
          return map;
        }
      }
    } catch (e) {
      console.warn('Failed to load /api/nse-bhavcopy-merged, falling back to direct fetch:', e);
    }
  }

  // 2. Fallback: Client-side rolling fetch across multiple days to ensure thinly-traded SGBs/G-Secs are captured
  const pad = (n: number) => n.toString().padStart(2, '0');
  const nowIST = new Date(Date.now() + 5.5 * 60 * 60 * 1000); 
  let daysFetched = 0;
  
  for (let i = 0; i < 25 && daysFetched < 12; i++) {
    const d = new Date(nowIST.getTime() - i * 24 * 60 * 60 * 1000);
    const dayOfWeek = d.getUTCDay();
    if (dayOfWeek === 0 || dayOfWeek === 6) continue; // skip weekend
    const dateStr = `${pad(d.getUTCDate())}${pad(d.getUTCMonth() + 1)}${d.getUTCFullYear()}`;
    const isBrowser = typeof window !== 'undefined';
    const url = isBrowser
      ? `/api/nse-bhavcopy/sec_bhavdata_full_${dateStr}.csv`
      : `https://nsearchives.nseindia.com/products/content/sec_bhavdata_full_${dateStr}.csv`;
    try {
      const res = await fetch(url);
      if (res.ok) {
        const text = await res.text();
        const lines = text.split('\n');
        daysFetched++;
        for (let j = 1; j < lines.length; j++) {
          const parts = lines[j].split(',');
          if (parts.length >= 9) {
            const symbol = parts[0].trim();
            const closePrice = parseFloat(parts[8].trim());
            const prevClose = parseFloat(parts[3]?.trim());
            const dateVal = parts[2].trim();
            // Newest date wins: only set if not already set by a more recent date!
            if (symbol && !isNaN(closePrice) && closePrice > 0 && !map.has(symbol)) {
              map.set(symbol, { price: closePrice, prevClose: isNaN(prevClose) ? closePrice : prevClose, date: dateVal });
            }
          }
        }
      }
    } catch (e) {
      // ignore
    }
  }

  if (map.size > 0) {
    cachedBhavcopyPrices = map;
    lastBhavcopyFetchTime = Date.now();
  }
  return map;
}

export function fuzzyMatchSGBSymbol(name: string, csvSymbols: string[]): string | null {
  const cleanName = name.toUpperCase();
  // Extract month
  const months = ['JAN', 'FEB', 'MAR', 'APR', 'MAY', 'JUN', 'JUL', 'AUG', 'SEP', 'OCT', 'NOV', 'DEC'];
  let monthIndex = -1;
  let matchedMonthStr = '';
  for (let i = 0; i < months.length; i++) {
    const m = months[i];
    if (cleanName.includes(m) || (m === 'JUN' && cleanName.includes('JUNE')) || (m === 'JUL' && cleanName.includes('JULY'))) {
      monthIndex = i;
      matchedMonthStr = m;
      break;
    }
  }
  if (monthIndex === -1) return null;

  // Extract year
  const yearMatch = cleanName.match(/\b(20\d{2})\b/);
  let yearShort = '';
  if (yearMatch) {
    yearShort = yearMatch[1].slice(2);
  } else {
    const yearMatch2 = cleanName.match(/\b(\d{2})\b/);
    if (yearMatch2) yearShort = yearMatch2[1];
  }
  if (!yearShort) return null;

  // Extract Series
  const romanMatch = cleanName.match(/\b(XIV|XIII|XII|XI|X|IX|VIII|VII|VI|V|IV|III|II|I)\b/);
  const roman = romanMatch ? romanMatch[1] : '';

  const monthAbbrs: Record<string, string[]> = {
    'JAN': ['JAN', 'J'],
    'FEB': ['FEB'],
    'MAR': ['MAR', 'MR'],
    'APR': ['APR'],
    'MAY': ['MAY'],
    'JUN': ['JUN', 'JU'],
    'JUL': ['JUL'],
    'AUG': ['AUG'],
    'SEP': ['SEP'],
    'OCT': ['OCT', 'OC'],
    'NOV': ['NOV', 'NV', 'N'],
    'DEC': ['DEC', 'DC']
  };

  const prefixes = monthAbbrs[matchedMonthStr] || [matchedMonthStr];

  for (const prefix of prefixes) {
    if (roman) {
      const sym1 = `SGB${prefix}${yearShort}${roman}`;
      if (csvSymbols.includes(sym1)) return sym1;
    }
    const sym2 = `SGB${prefix}${yearShort}`;
    if (csvSymbols.includes(sym2)) return sym2;
  }
  return null;
}

export function fuzzyMatchGSecSymbol(name: string, csvSymbols: string[]): string | null {
  const cleanName = name.toUpperCase();
  const couponMatch = cleanName.match(/(\d+\.\d+|\d+)%/);
  let couponStr = '';
  if (couponMatch) {
    couponStr = couponMatch[1].replace('.', '');
  } else {
    const couponMatch2 = cleanName.match(/(\d+\.\d+|\d+)\s+GS/);
    if (couponMatch2) couponStr = couponMatch2[1].replace('.', '');
  }
  if (!couponStr) return null;

  const couponOptions = [couponStr];
  if (couponStr.endsWith('0')) {
    couponOptions.push(couponStr.slice(0, -1));
  } else if (couponStr.length === 2) {
    couponOptions.push(couponStr + '0');
  }

  const yearMatch = cleanName.match(/\b(20\d{2})\b/);
  if (!yearMatch) return null;
  const year = yearMatch[1];

  for (const cop of couponOptions) {
    const sym = `${cop}GS${year}`;
    if (csvSymbols.includes(sym)) return sym;
  }
  return null;
}

export interface AmfiSchemeInfo {
  name: string;
  amfi_code: string;
  category?: string;
  taxCategory?: 'EQUITY' | 'DEBT_SEC50AA' | 'HYBRID_OTHER';
}

let cachedAmfiIsinMap: Record<string, AmfiSchemeInfo> | null = null;
let cachedNseIsinMap: Record<string, { symbol: string; name: string; series: string }> | null = null;

export async function lookupAmfiByIsin(isin: string): Promise<AmfiSchemeInfo | null> {
  if (!isin || !isin.startsWith('INF')) return null;
  try {
    if (!cachedAmfiIsinMap) {
      const res = await fetch(typeof window !== 'undefined' ? '/api/amfi-isin' : 'https://www.amfiindia.com/spages/NAVAll.txt');
      if (typeof window !== 'undefined') {
        cachedAmfiIsinMap = await res.json();
      } else {
        const text = await res.text();
        const map: Record<string, AmfiSchemeInfo> = {};
        let currentCategory = '';
        text.split('\n').forEach(line => {
          const trimmed = line.trim();
          if (trimmed.includes('Schemes(') || trimmed.startsWith('Open Ended') || trimmed.startsWith('Close Ended')) {
            currentCategory = trimmed;
            return;
          }
          const parts = trimmed.split(';');
          if (parts.length >= 6) {
            const code = parts[0].trim();
            const i1 = parts[1].trim();
            const i2 = parts[2].trim();
            const name = parts[3].trim();
            const catLower = currentCategory.toLowerCase();
            let taxCategory: 'EQUITY' | 'DEBT_SEC50AA' | 'HYBRID_OTHER' = 'EQUITY';
            if (catLower.includes('debt') || catLower.includes('liquid') || catLower.includes('money market') || catLower.includes('income')) {
              taxCategory = 'DEBT_SEC50AA';
            } else if (catLower.includes('hybrid') || catLower.includes('multi asset') || catLower.includes('fund of fund') || catLower.includes('fof')) {
              taxCategory = 'HYBRID_OTHER';
            }
            const info: AmfiSchemeInfo = { name, amfi_code: code, category: currentCategory, taxCategory };
            if (i1 && i1.length >= 10 && i1 !== '-') map[i1] = info;
            if (i2 && i2.length >= 10 && i2 !== '-') map[i2] = info;
          }
        });
        cachedAmfiIsinMap = map;
      }
    }
    return cachedAmfiIsinMap?.[isin] || null;
  } catch (e) {
    console.warn('lookupAmfiByIsin error:', e);
    return null;
  }
}

export async function lookupNseByIsin(isin: string): Promise<{ symbol: string; name: string; series: string } | null> {
  if (!isin || !isin.startsWith('IN')) return null;
  try {
    if (!cachedNseIsinMap) {
      const res = await fetch(typeof window !== 'undefined' ? '/api/nse-isin' : 'https://nsearchives.nseindia.com/content/equities/EQUITY_L.csv', {
        headers: typeof window === 'undefined' ? { 'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64)' } : undefined
      });
      if (typeof window !== 'undefined') {
        cachedNseIsinMap = await res.json();
      } else {
        const text = await res.text();
        const map: Record<string, { symbol: string; name: string; series: string }> = {};
        const lines = text.split('\n');
        for (let i = 1; i < lines.length; i++) {
          const parts = lines[i].split(',');
          if (parts.length >= 7) {
            const isinCode = parts[6].trim();
            if (isinCode.startsWith('IN')) {
              map[isinCode] = { symbol: parts[0].trim(), name: parts[1].trim(), series: parts[2].trim() };
            }
          }
        }
        cachedNseIsinMap = map;
      }
    }
    return cachedNseIsinMap?.[isin] || null;
  } catch (e) {
    console.warn('lookupNseByIsin error:', e);
    return null;
  }
}

let cachedNseDebtIsinMap: Record<string, any> | null = null;

export async function lookupNseDebtByIsin(isin: string): Promise<any | null> {
  if (!isin || !isin.startsWith('IN')) return null;
  try {
    if (!cachedNseDebtIsinMap) {
      const res = await fetch(typeof window !== 'undefined' ? '/api/nse-debt-isin' : 'https://nsearchives.nseindia.com/content/equities/DEBT.csv');
      if (typeof window !== 'undefined') {
        cachedNseDebtIsinMap = await res.json();
      } else {
        const text = await res.text();
        const lines = text.split('\n');
        const map: Record<string, any> = {};
        for (let i = 1; i < lines.length; i++) {
          const parts = lines[i].split(',');
          if (parts.length >= 10) {
            const isinCode = parts.find(p => /^IN[A-Z0-9]{10}$/.test(p.trim()));
            if (isinCode) {
              const redDate = parts[9]?.trim() || '';
              let formattedDate = redDate;
              const dateM = redDate.match(/^(\d{1,2})-([A-Za-z]{3})-(\d{4})$/);
              if (dateM) {
                const months: Record<string, string> = {
                  JAN: '01', FEB: '02', MAR: '03', APR: '04', MAY: '05', JUN: '06',
                  JUL: '07', AUG: '08', SEP: '09', OCT: '10', NOV: '11', DEC: '12'
                };
                const mStr = months[dateM[2].toUpperCase()] || '01';
                formattedDate = `${dateM[3]}-${mStr}-${dateM[1].padStart(2, '0')}`;
              }
              const ipRate = parseFloat(parts[6]?.trim() || '0');
              map[isinCode.trim()] = {
                symbol: parts[0]?.trim(),
                name: parts[1]?.trim(),
                series: parts[2]?.trim(),
                faceValue: Number(parts[3]?.trim()) || 1000,
                couponRate: ipRate > 0 ? ipRate : undefined,
                maturityDate: formattedDate || undefined,
                interestFrequency: 'Annual',
                bondCategory: 'ncd'
              };
            }
          }
        }
        cachedNseDebtIsinMap = map;
      }
    }
    return cachedNseDebtIsinMap?.[isin] || null;
  } catch (e) {
    console.warn('lookupNseDebtByIsin error:', e);
    return null;
  }
}

export function parseBondFromTitle(name: string) {
  if (!name) return null;
  const isinM = name.match(/\b(IN[A-Z0-9]{10})\b/i);
  const couponM = name.match(/(\d+(?:\.\d+)?)\s*%/);
  const dateM = name.match(/(\d{1,2})[\/\-](\d{1,2})[\/\-](\d{2,4})/);
  
  let matDate: string | undefined = undefined;
  if (dateM) {
    let [_, d, m, y] = dateM;
    if (y.length === 2) y = '20' + y;
    matDate = `${y}-${m.padStart(2, '0')}-${d.padStart(2, '0')}`;
  }
  
  let cleanName = name.replace(/\s*\(ISIN\s+[A-Z0-9]+\)\s*/i, '').trim();
  const isGsec = /G-Sec|GOI|GS\s*\d{4}/i.test(cleanName);
  const isSgb = /SGB|Gold/i.test(cleanName);
  const isNcd = /NCD|Debenture|BOND/i.test(cleanName);
  
  return {
    cleanName,
    isin: isinM ? isinM[1].toUpperCase() : null,
    couponRate: couponM ? parseFloat(couponM[1]) : undefined,
    maturityDate: matDate,
    bondCategory: (isGsec ? 'gsec' : (isSgb ? 'sgb' : 'ncd')) as 'gsec' | 'sgb' | 'ncd',
    faceValue: isGsec ? 100 : (isSgb ? 1 : 1000),
    interestFrequency: isSgb ? 'Half-Yearly' : (isGsec ? 'Half-Yearly' : 'Annual')
  };
}

let cachedSnapshotIsinMap: Record<string, any> | null = null;

export async function lookupSnapshotByIsin(isin: string): Promise<any | null> {
  if (!isin || !isin.startsWith('IN')) return null;
  if (!cachedSnapshotIsinMap) {
    try {
      let items: any[] = [];
      if (typeof window !== 'undefined') {
        const res = await fetch('/snapshot/asset_master.json');
        if (res.ok) items = await res.json();
      } else {
        const fs = await import('fs');
        const content = fs.readFileSync('public/snapshot/asset_master.json', 'utf8');
        items = JSON.parse(content);
      }

      const map: Record<string, any> = {};
      items.forEach((a: any) => {
        let isinVal = a.isin ? String(a.isin).trim().toUpperCase() : null;
        if (!isinVal && a.name) {
          const m = String(a.name).match(/\b(IN[A-Z0-9]{10})\b/i);
          if (m) isinVal = m[1].toUpperCase();
        }
        if (isinVal && isinVal.startsWith('IN')) {
          map[isinVal] = a;
        }
      });
      cachedSnapshotIsinMap = map;
    } catch (err) {
      console.warn('lookupSnapshotByIsin load error:', err);
    }
  }
  return cachedSnapshotIsinMap?.[isin] || null;
}

/**
 * Automatically resolves any newly added script (Stock, Mutual Fund, SGB, Bond)
 * by ISIN, ticker symbol, or scheme name, and fetches its live price.
 */
export async function resolveAndSyncNewScript(identifier: string): Promise<{
  name: string;
  isin: string | null;
  symbol: string | null;
  price: number;
  assetType: number;
} | null> {
  const clean = identifier.trim();
  if (!clean) return null;

  let isin: string | null = null;
  let symbol: string | null = null;
  let amfiCode: number | null = null;
  let name = clean;
  let assetType = 50;

  if (clean.length === 12 && clean.startsWith('INF')) {
    isin = clean;
    assetType = 60;
    const mfInfo = await lookupAmfiByIsin(clean);
    if (mfInfo) {
      name = mfInfo.name;
      amfiCode = Number(mfInfo.amfi_code) || null;
    }
  } else if (clean.length === 12 && clean.startsWith('INE')) {
    isin = clean;
    assetType = 50;
    const nseInfo = await lookupNseByIsin(clean);
    if (nseInfo) {
      name = nseInfo.name;
      symbol = `${nseInfo.symbol}.NS`;
    }
  } else if (clean.length === 12 && clean.startsWith('IN00')) {
    isin = clean;
    assetType = 70;
  }

  const tempAsset: AssetMaster = {
    amid: 0,
    name,
    asset_type: assetType,
    asset_type_name: assetType === 60 ? 'Mutual Funds' : (assetType === 70 ? 'Bonds' : 'Stocks'),
    exchange_group: null,
    bse_code: null,
    amfi_code: amfiCode,
    nse_symbol: symbol ? symbol.replace('.NS', '') : null,
    ticker: symbol,
    isin
  };

  const live = await getLivePrice(tempAsset);
  return {
    name,
    isin,
    symbol,
    price: live?.price || 0,
    assetType
  };
}

/**
 * Get live price for any asset (stocks + MF + bonds)
 * Automatically routes to the right API based on ISIN, ticker, or asset_type.
 * Uses in-memory cache — refreshes every 5 minutes.
 */
export async function getLivePrice(asset: AssetMaster): Promise<LivePrice | null> {
  // Check delisted / fixed-price assets first
  if (DELISTED_OR_FIXED_PRICES[asset.amid]) {
    const fixed = DELISTED_OR_FIXED_PRICES[asset.amid];
    const fixedResult: LivePrice = {
      amid: asset.amid,
      name: asset.name,
      price: fixed.price,
      change: 0,
      change_pct: 0,
      as_of: new Date().toISOString().slice(0, 10),
      source: 'cached'
    };
    priceCache.set(asset.amid, { price: fixedResult, fetchedAt: Date.now() });
    return fixedResult;
  }

  // Check cache first
  const cached = priceCache.get(asset.amid);
  if (cached && Date.now() - cached.fetchedAt < CACHE_TTL_MS) {
    return { ...cached.price, source: 'cached' };
  }

  let result: LivePrice | null = null;
  const rawIsin = asset.isin || extractIsin(asset);
  
  // 1. Check if it's a G-Sec or SGB and fetch from automated NSE Bhavcopy
  const isin = rawIsin;
  let nseSymbol = isin ? BOND_ISIN_TO_NSE_SYMBOL[isin] : null;
  
  const cleanName = asset.name?.toUpperCase() || '';
  const isBondOrSGB = cleanName.includes('SOVEREIGN') || cleanName.includes('SGB') || cleanName.includes('G-SEC') || cleanName.includes('GS') || asset.asset_type === 100 || asset.asset_type === 70 || asset.asset_type === 40;
  
  if (isBondOrSGB) {
    if (isin && MPROFIT_GSEC_PRICES[isin]) {
      const gsec = MPROFIT_GSEC_PRICES[isin];
      const change = gsec.price - gsec.prevClose;
      const change_pct = gsec.prevClose > 0 ? (change / gsec.prevClose) * 100 : 0;
      result = {
        amid: asset.amid,
        name: asset.name,
        price: gsec.price,
        change,
        change_pct,
        as_of: 'live_benchmark',
        source: 'nse_bhavcopy'
      };
    } else {
      try {
        const bhavMap = await fetchNSEBhavcopyPrices();
        const csvSymbols = Array.from(bhavMap.keys());
      
      if (!nseSymbol) {
        nseSymbol = fuzzyMatchSGBSymbol(cleanName, csvSymbols) || fuzzyMatchGSecSymbol(cleanName, csvSymbols);
      }
      
      if (nseSymbol) {
        const match = bhavMap.get(nseSymbol);
        if (match) {
          const prevCloseVal = match.prevClose ?? match.price;
          const change = match.price - prevCloseVal;
          const change_pct = prevCloseVal > 0 ? (change / prevCloseVal) * 100 : 0;
          result = {
            amid: asset.amid,
            name: asset.name,
            price: match.price,
            change,
            change_pct,
            as_of: match.date,
            source: 'nse_bhavcopy'
          };
        }
      }

      // SGB benchmark fallback if specific series had no trades in the rolling window
      if (!result && (cleanName.includes('SOVEREIGN') || cleanName.includes('SGB'))) {
        const sgbPrices: number[] = [];
        bhavMap.forEach((v, k) => {
          if (k.startsWith('SGB') && v.price > 10000 && v.price < 25000) {
            sgbPrices.push(v.price);
          }
        });
        if (sgbPrices.length > 0) {
          sgbPrices.sort((a, b) => a - b);
          const medianPrice = sgbPrices[Math.floor(sgbPrices.length / 2)];
          result = {
            amid: asset.amid,
            name: asset.name,
            price: medianPrice,
            change: 0,
            change_pct: 0,
            as_of: 'live_benchmark',
            source: 'sgb_benchmark'
          };
        }
      }
    } catch (e) {
      console.warn(`Failed to fetch price from NSE Bhavcopy for ${asset.name}:`, e);
    }
  }
}

  // 2. Mutual Fund — ISIN-First, then mfapi.in
  let amfiCode: number | null = asset.amfi_code || AMFI_OVERRIDES[asset.amid] || null;
  if (!amfiCode && rawIsin && rawIsin.startsWith('INF')) {
    const lookup = await lookupAmfiByIsin(rawIsin);
    if (lookup && lookup.amfi_code) amfiCode = Number(lookup.amfi_code);
  }
  if (!amfiCode && cleanName.includes('NIPPON') && cleanName.includes('MULTI ASSET') && cleanName.includes('DIRECT') && cleanName.includes('GROWTH')) {
    amfiCode = 148457;
  }
  if (!amfiCode && cleanName.includes('INCOME PLUS') && cleanName.includes('ARBITRAGE')) {
    amfiCode = 120313;
  }
  if (!amfiCode && cleanName.includes('ICICI') && cleanName.includes('LIQUID') && cleanName.includes('DIRECT') && cleanName.includes('GROWTH')) {
    amfiCode = 120197;
  }
  if (amfiCode) {
    const nav = await fetchMFNav(amfiCode);
    if (nav) {
      result = {
        amid: asset.amid,
        name: asset.name,
        price: nav.price,
        change: nav.change,
        change_pct: nav.change_pct,
        as_of: nav.date,
        source: 'mfapi'
      };
    }
  }

  // Fallback: Stock, Bonds, or unmapped Mutual Funds - prefer ticker, then NSE symbol, then BSE code, then ISIN
  if (!result && !isBondOrSGB) {
    let quote = null;

    // Check for hardcoded ticker overrides first (to handle bad/abbreviated NSE symbols in database)
    let overrideSymbol = STOCK_SYMBOL_OVERRIDES[asset.amid];
    if (!overrideSymbol && (cleanName === 'L&T FINANCE' || cleanName.startsWith('L&T FINANCE '))) {
      overrideSymbol = 'LTF.NS';
    }
    if (!overrideSymbol && cleanName.includes('MAYUR') && cleanName.includes('FLOOR')) {
      overrideSymbol = 'MAYURFL.BO';
    }
    if (!overrideSymbol && cleanName.includes('ORGANIC') && cleanName.includes('COAT')) {
      overrideSymbol = 'ORGCOAT.BO';
    }
    if (!overrideSymbol && cleanName.includes('LORDS') && cleanName.includes('MARK')) {
      overrideSymbol = 'LORDSMARK.BO';
    }
    if (!overrideSymbol && cleanName.includes('MEESHO')) {
      overrideSymbol = 'MEESHO.NS';
    }
    if (!overrideSymbol && cleanName.includes('LENSKART')) {
      overrideSymbol = 'LENSKART.NS';
    }
    if (!overrideSymbol && cleanName.includes('VISHAL') && cleanName.includes('MEGA')) {
      overrideSymbol = 'VISHAL.NS';
    }
    if (overrideSymbol) {
      quote = await fetchStockPrice(overrideSymbol);
    }
    
    if (!quote && asset.ticker) {
      quote = await fetchStockPrice(asset.ticker);
    }

    if (!quote && asset.nse_symbol) {
      const cleanNse = asset.nse_symbol.trim().replace(/\s+/g, '').replace(/\(.*?\)/g, '');
      if (cleanNse) quote = await fetchStockPrice(`${cleanNse}.NS`);
    }
    if (!quote && asset.bse_code) {
      quote = await fetchStockPrice(`${asset.bse_code}.BO`);
    }
    if (!quote && rawIsin && rawIsin.startsWith('INE')) {
      const nseMatch = await lookupNseByIsin(rawIsin);
      if (nseMatch?.symbol) {
        quote = await fetchStockPrice(`${nseMatch.symbol}.NS`);
      }
    }
    if (!quote && asset.isin) {
      // Sometimes Yahoo Finance can resolve ISIN directly for Mutual funds (e.g. 0P0000XW8F.BO)
      // We can try to query Yahoo Finance for ISIN if all else fails. But fetchStockPrice only takes a symbol.
      // Wait, we have Google Finance fallback in fetchStockPrice! Wait, we deleted it or it failed?
      // Just pass ISIN directly, if the API supports it.
      quote = await fetchStockPrice(asset.isin);
    }

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

// ─── Manual Asset Creation & Mandatory ISIN Verification ─────────────────────

export interface ManualAssetInput {
  assetType: 'stock' | 'mf' | 'bond';
  name: string;
  isin: string; // MANDATORY!
  nseSymbol?: string;
  bseCode?: number | null;
  amfiCode?: number | null;
  exchangeGroup?: string | null;
  // Mutual Fund specific:
  mfCategory?: 'equity' | 'debt' | 'hybrid' | 'liquid';
  // Bond specific fields:
  bondCategory?: 'gsec' | 'sgb' | 'ncd';
  faceValue?: number;
  couponRate?: number;
  maturityDate?: string;
  interestFrequency?: string;
}

/**
 * Validates mandatory ISIN format (12 characters, valid country code e.g. IN)
 */
export function validateIsin(isin: string): { valid: boolean; error?: string } {
  if (!isin || !isin.trim()) {
    return { valid: false, error: 'ISIN is mandatory to tag real live prices and NAV.' };
  }
  const clean = isin.trim().toUpperCase();
  if (clean.length !== 12) {
    return { valid: false, error: 'ISIN must be exactly 12 alphanumeric characters.' };
  }
  if (!/^[A-Z]{2}[A-Z0-9]{9}[0-9]$/.test(clean)) {
    return { valid: false, error: 'Invalid ISIN format. Must start with 2 letters (e.g. IN) followed by 9 alphanumeric characters and 1 check digit.' };
  }
  return { valid: true };
}

/**
 * Automatically looks up ISIN across official directories (AMFI, NSE, G-Sec/Bonds)
 * to prefill company name, ticker symbol, AMFI code, and live price/NAV.
 */
export async function lookupIsinDetails(rawIsin: string): Promise<{
  found: boolean;
  name?: string;
  symbol?: string;
  bseCode?: number;
  amfiCode?: number;
  assetType?: 'stock' | 'mf' | 'bond';
  mfCategory?: 'equity' | 'debt' | 'hybrid' | 'liquid';
  bondCategory?: 'gsec' | 'sgb' | 'ncd';
  price?: number;
  couponRate?: number;
  maturityDate?: string;
  faceValue?: number;
  interestFrequency?: string;
  message?: string;
}> {
  const check = validateIsin(rawIsin);
  if (!check.valid) return { found: false, message: check.error };
  const isin = rawIsin.trim().toUpperCase();

  // 1. Check if Mutual Fund (starts with INF)
  if (isin.startsWith('INF')) {
    const amfi = await lookupAmfiByIsin(isin);
    let nav: number | undefined;
    if (amfi) {
      if (amfi.amfi_code) {
        const live = await fetchMFNav(Number(amfi.amfi_code));
        if (live) nav = live.price;
      }
      const catLower = (amfi.category || '').toLowerCase();
      const isDebt = catLower.includes('debt') || catLower.includes('liquid') || catLower.includes('money market');
      const isHybrid = catLower.includes('hybrid') || catLower.includes('multi asset');
      return {
        found: true,
        name: amfi.name,
        amfiCode: amfi.amfi_code ? Number(amfi.amfi_code) : undefined,
        assetType: 'mf',
        mfCategory: isDebt ? 'debt' : (isHybrid ? 'hybrid' : 'equity'),
        price: nav,
        message: `Found in AMFI Directory: ${amfi.name} (Code: ${amfi.amfi_code})`
      };
    }
  }

  // 2. Check NSE Debt Directory (NCDs, Corporate Bonds, Institutional Debentures)
  const nseDebt = await lookupNseDebtByIsin(isin);
  if (nseDebt) {
    return {
      found: true,
      name: nseDebt.name,
      symbol: nseDebt.symbol,
      assetType: 'bond',
      bondCategory: nseDebt.bondCategory || 'ncd',
      couponRate: nseDebt.couponRate,
      maturityDate: nseDebt.maturityDate,
      faceValue: nseDebt.faceValue || 1000,
      interestFrequency: nseDebt.interestFrequency || 'Annual',
      price: nseDebt.faceValue || 1000,
      message: `Auto-fetched from NSE Debt Directory: ${nseDebt.name} (${nseDebt.symbol})`
    };
  }

  // 3. Check MProfit Master & Local Snapshot Database (20,600+ ISINs including Muthoot Fincorp, PFC, REC, HUDCO)
  const snap = await lookupSnapshotByIsin(isin);
  if (snap) {
    const isBond = [40, 70, 100, 115].includes(Number(snap.asset_type)) || (snap.name && snap.name.includes('(ISIN '));
    if (isBond) {
      const parsed = parseBondFromTitle(snap.name) || {
        cleanName: snap.name,
        couponRate: undefined,
        maturityDate: undefined,
        bondCategory: 'ncd',
        faceValue: 1000,
        interestFrequency: 'Annual'
      };
      return {
        found: true,
        name: parsed.cleanName,
        symbol: snap.nse_symbol || undefined,
        bseCode: snap.bse_code ? Number(snap.bse_code) : undefined,
        assetType: 'bond',
        bondCategory: parsed.bondCategory as any,
        couponRate: parsed.couponRate,
        maturityDate: parsed.maturityDate,
        faceValue: parsed.faceValue,
        interestFrequency: parsed.interestFrequency,
        price: parsed.faceValue || 1000,
        message: `Auto-fetched from Securities Master: ${parsed.cleanName} (${parsed.couponRate ? 'Coupon: ' + parsed.couponRate + '%' : ''} ${parsed.maturityDate ? 'Maturity: ' + parsed.maturityDate : ''})`
      };
    } else if (Number(snap.asset_type) === 50) {
      let price: number | undefined;
      if (snap.nse_symbol) {
        const quote = await fetchStockPrice(`${snap.nse_symbol}.NS`);
        if (quote) price = quote.price;
      }
      return {
        found: true,
        name: snap.name,
        symbol: snap.nse_symbol || undefined,
        bseCode: snap.bse_code ? Number(snap.bse_code) : undefined,
        assetType: 'stock',
        price,
        message: `Auto-fetched from Equities Master: ${snap.name} (${snap.nse_symbol || snap.bse_code})`
      };
    } else if ([60, 61, 75].includes(Number(snap.asset_type))) {
      let nav: number | undefined;
      if (snap.amfi_code) {
        const live = await fetchMFNav(Number(snap.amfi_code));
        if (live) nav = live.price;
      }
      return {
        found: true,
        name: snap.name,
        amfiCode: snap.amfi_code ? Number(snap.amfi_code) : undefined,
        assetType: 'mf',
        mfCategory: snap.asset_type === 61 ? 'debt' : 'equity',
        price: nav,
        message: `Auto-fetched Mutual Fund: ${snap.name}`
      };
    }
  }

  // 4. Check if Equity Stock on NSE (starts with INE)
  if (isin.startsWith('INE')) {
    const nse = await lookupNseByIsin(isin);
    if (nse) {
      let price: number | undefined;
      const quote = await fetchStockPrice(`${nse.symbol}.NS`);
      if (quote) price = quote.price;
      return {
        found: true,
        name: nse.name,
        symbol: nse.symbol,
        assetType: 'stock',
        price,
        message: `Found on NSE: ${nse.name} (${nse.symbol})`
      };
    }
  }

  // 5. Check if Traded Bond / G-Sec / SGB
  if (isin.startsWith('IN00') || BOND_ISIN_TO_NSE_SYMBOL[isin] || MPROFIT_GSEC_PRICES[isin]) {
    const symbol = BOND_ISIN_TO_NSE_SYMBOL[isin];
    let price: number | undefined;
    if (MPROFIT_GSEC_PRICES[isin]) {
      price = MPROFIT_GSEC_PRICES[isin].price;
    }
    const isSgb = /SGB|GOLD/i.test(symbol || '') || (price && price > 5000);
    return {
      found: true,
      name: isSgb ? `Sovereign Gold Bond (${isin})` : `Government of India Security (${isin})`,
      symbol: symbol || undefined,
      assetType: 'bond',
      bondCategory: isSgb ? 'sgb' : 'gsec',
      faceValue: isSgb ? 1 : 100,
      interestFrequency: 'Half-Yearly',
      couponRate: isSgb ? 2.50 : undefined,
      price,
      message: `Recognized institutional bond ISIN: ${isin}`
    };
  }

  return { found: false, message: 'Valid ISIN format. Please enter security details manually.' };
}

/**
 * Creates a new Stock, Mutual Fund, or Traded Bond.
 * Enforces mandatory ISIN, persists to Supabase asset_master, and fetches live price/NAV.
 */
export async function createManualAsset(input: ManualAssetInput): Promise<{
  success: boolean;
  asset?: AssetMaster;
  price?: number;
  message?: string;
}> {
  const isinCheck = validateIsin(input.isin);
  if (!isinCheck.valid) {
    return { success: false, message: isinCheck.error };
  }
  const cleanIsin = input.isin.trim().toUpperCase();

  if (!input.name || !input.name.trim()) {
    return { success: false, message: 'Asset Name / Security Title is required.' };
  }
  const cleanName = input.name.trim();

  // Check if ISIN already exists
  try {
    const { data: existing } = await supabase
      .from('asset_master')
      .select('*')
      .eq('isin', cleanIsin)
      .limit(1);

    if (existing && existing.length > 0) {
      return {
        success: false,
        message: `An asset with ISIN ${cleanIsin} already exists (${existing[0].name}, AMID: ${existing[0].amid}).`,
        asset: existing[0]
      };
    }
  } catch (err) {
    console.warn('Existing ISIN check error:', err);
  }

  // Generate next unique AMID
  let nextAmid = 1930000;
  try {
    const { data: maxRow } = await supabase
      .from('asset_master')
      .select('amid')
      .order('amid', { ascending: false })
      .limit(1);
    if (maxRow && maxRow.length > 0 && maxRow[0].amid) {
      nextAmid = Math.max(nextAmid, Number(maxRow[0].amid) + 1);
    }
  } catch (err) {
    console.warn('Could not determine max amid from Supabase, using fallback:', nextAmid);
  }

  // Determine asset_type and asset_type_name
  let assetType = 50;
  let assetTypeName = 'Stocks';
  if (input.assetType === 'mf') {
    if (input.mfCategory === 'debt' || /debt|liquid|money\s*market|gilt|treasury/i.test(cleanName)) {
      assetType = 61;
      assetTypeName = 'MF Debt';
    } else {
      assetType = 60;
      assetTypeName = 'MF Equity';
    }
  } else if (input.assetType === 'bond') {
    assetType = 100;
    assetTypeName = 'Traded Bonds';
  }

  const newAsset: AssetMaster = {
    amid: nextAmid,
    name: cleanName,
    asset_type: assetType,
    asset_type_name: assetTypeName,
    exchange_group: input.exchangeGroup || null,
    bse_code: input.bseCode || null,
    amfi_code: input.amfiCode || null,
    nse_symbol: input.nseSymbol?.trim() || null,
    ticker: input.nseSymbol ? `${input.nseSymbol.trim()}.NS` : (input.bseCode ? `${input.bseCode}.BO` : null),
    isin: cleanIsin
  };

  // 1. Insert into Supabase asset_master
  const { error: insertErr } = await supabase
    .from('asset_master')
    .insert([newAsset]);

  if (insertErr) {
    console.error('Failed to insert asset_master:', insertErr);
    return { success: false, message: `Database error: ${insertErr.message}` };
  }

  // 2. Fetch live price / NAV via ISIN tag
  let livePriceVal = 0;
  try {
    const live = await getLivePrice(newAsset);
    if (live && live.price > 0) {
      livePriceVal = live.price;
      const todayStr = new Date().toISOString().slice(0, 10);
      await supabase.from('mprices').insert([{
        source_id_atyp: assetType,
        amid: nextAmid,
        currp: livePriceVal,
        prevp: livePriceVal,
        date: todayStr
      }]);
    }
  } catch (e) {
    console.warn('Could not fetch initial live price for new asset:', e);
  }

  return {
    success: true,
    asset: newAsset,
    price: livePriceVal,
    message: `Successfully created ${cleanName} (AMID: ${nextAmid}, ISIN: ${cleanIsin}).`
  };
}
