/**
 * mfCategoryService.ts
 * 
 * Fetches authentic MF scheme category data from MFAPI.in (which sources from AMFI).
 * Maps AMFI/SEBI scheme categories to WealthCore asset type numbers (atty).
 * Results are cached in localStorage to avoid repeat network calls.
 * 
 * SEBI MF Category → WealthCore atty mapping (SEBI circular SEBI/HO/IMD/DF3/CIR/P/2017/114):
 *   Equity schemes     → 60
 *   Hybrid schemes     → 60 (aggressive/multi-asset) or 61 (debt-oriented)
 *   Debt schemes       → 61
 *   Solution-oriented  → 60
 *   Other (ETF, FoF)   → depends on underlying
 */

const CACHE_KEY = 'wc_mf_category_cache_v2';
const CACHE_TTL_MS = 7 * 24 * 60 * 60 * 1000; // 7 days

export interface MFSchemeMeta {
  schemeCode: number;
  schemeName: string;
  schemeCategory: string;
  schemeType: string;
  fundHouse: string;
  atty: number; // WealthCore asset type
}

type CategoryCache = {
  fetchedAt: number;
  schemes: Record<number, MFSchemeMeta>; // keyed by schemeCode
};

/**
 * SEBI/AMFI scheme_category → WealthCore atty mapping.
 * Source: AMFI website categorisation as per SEBI circular.
 */
export const AMFI_CATEGORY_TO_ATTY: Record<string, number> = {
  // ── Equity Schemes (SEBI) → atty 60 ──────────────────────────────────────
  'Multi Cap Fund':                            60,
  'Large Cap Fund':                            60,
  'Large & Mid Cap Fund':                      60,
  'Mid Cap Fund':                              60,
  'Small Cap Fund':                            60,
  'Micro Cap Fund':                            60,
  'Dividend Yield Fund':                       60,
  'Value Fund':                                60,
  'Contra Fund':                               60,
  'Focused Fund':                              60,
  'Flexi Cap Fund':                            60,
  'ELSS':                                      60,
  'Sectoral/ Thematic Funds':                  60,
  'Sectoral/Thematic Funds':                   60,
  'Thematic Fund':                             60,
  'Index Funds':                               60,
  'Index Funds/ETFs':                          60,
  'FoFs (Overseas)':                           60,
  'FoFs Overseas':                             60,
  'FoFs (Domestic) - Equity':                  60,

  // ── Hybrid Schemes → atty 60 (equity-oriented) or 61 (debt-oriented) ────
  'Aggressive Hybrid Fund':                    60,
  'Multi Asset Allocation':                    60,  // ← THE KEY FIX: was going to 75/150
  'Multi Asset Allocation Fund':               60,
  'Arbitrage Fund':                            61,
  'Equity Savings Fund':                       60,
  'Balanced Advantage Fund':                   60,
  'Dynamic Asset Allocation or Balanced Advantage': 60,
  'Conservative Hybrid Fund':                  61,
  'Balanced Hybrid Fund':                      60,

  // ── Solution Oriented Schemes → atty 60 ─────────────────────────────────
  'Retirement Fund':                           60,
  'Childrens Fund':                            60,
  "Children's Fund":                           60,

  // ── Debt Schemes → atty 61 ───────────────────────────────────────────────
  'Overnight Fund':                            61,
  'Liquid Fund':                               61,
  'Ultra Short Duration Fund':                 61,
  'Low Duration Fund':                         61,
  'Money Market Fund':                         61,
  'Short Duration Fund':                       61,
  'Medium Duration Fund':                      61,
  'Medium to Long Duration Fund':              61,
  'Long Duration Fund':                        61,
  'Dynamic Bond Fund':                         61,
  'Dynamic Bond':                              61,
  'Corporate Bond Fund':                       61,
  'Credit Risk Fund':                          61,
  'Banking and PSU Fund':                      61,
  'Gilt Fund':                                 61,
  'Gilt Fund with 10 year constant duration':  61,
  'Floater Fund':                              61,
  'Target Maturity Fund':                      61,
  'Fixed Maturity Plans':                      61,
  'FMPs':                                      61,
  'Interval Fund':                             61,
  'FoFs (Domestic) - Debt':                    61,

  // ── Gold ETF / Gold Savings Fund → atty 150 ─────────────────────────────
  'Gold ETF':                                  150,
  'Gold Saving Fund':                          150,
  'Gold Savings Fund':                         150,
  'Silver ETF':                                151,
  'Silver Saving Fund':                        151,

  // ── Other ETFs → atty 51 (listed ETF = treated as Stocks) ───────────────
  'Other ETFs':                                51,
  'Exchange Traded Funds':                     51,

  // ── Fund of Funds (Domestic) ─────────────────────────────────────────────
  'Fund of Funds (Domestic)':                  60,
  'FoFs (Domestic)':                           60,
};

/**
 * Normalise a raw AMFI category string for lookup.
 * AMFI sometimes adds trailing/leading spaces, capitalisation varies.
 */
function normaliseCategory(raw: string): string {
  return raw.trim().replace(/\s+/g, ' ');
}

/**
 * Given an AMFI scheme_category string, return the WealthCore atty number.
 * Falls back to 60 (MF Equity) for unknown equity-like categories.
 */
export function attyFromAmfiCategory(rawCategory: string): number {
  const cat = normaliseCategory(rawCategory);
  if (AMFI_CATEGORY_TO_ATTY[cat] !== undefined) return AMFI_CATEGORY_TO_ATTY[cat];

  // Fuzzy fallbacks
  const lc = cat.toLowerCase();
  if (lc.includes('gold')) return 150;
  if (lc.includes('silver')) return 151;
  if (lc.includes('debt') || lc.includes('liquid') || lc.includes('gilt') || lc.includes('bond fund') || lc.includes('duration')) return 61;
  if (lc.includes('equity') || lc.includes('elss') || lc.includes('cap fund') || lc.includes('hybrid')) return 60;
  if (lc.includes('etf')) return 51;
  return 60; // safe default for unknown MF categories
}

// ── CACHE HELPERS ────────────────────────────────────────────────────────────

function loadCache(): CategoryCache | null {
  try {
    const raw = localStorage.getItem(CACHE_KEY);
    if (!raw) return null;
    const parsed: CategoryCache = JSON.parse(raw);
    if (Date.now() - parsed.fetchedAt > CACHE_TTL_MS) return null;
    return parsed;
  } catch {
    return null;
  }
}

function saveCache(cache: CategoryCache) {
  try {
    localStorage.setItem(CACHE_KEY, JSON.stringify(cache));
  } catch (e) {
    console.warn('mfCategoryService: failed to save cache', e);
  }
}

// In-memory store after first fetch
let _memoryCache: CategoryCache | null = null;

// ── PUBLIC API ────────────────────────────────────────────────────────────────

/**
 * Fetch all MF scheme categories from MFAPI.in (which sources from AMFI).
 * Caches for 7 days in localStorage + in-memory for the session.
 * 
 * Returns a map of schemeCode → MFSchemeMeta.
 */
export async function fetchAllMFCategories(): Promise<Record<number, MFSchemeMeta>> {
  if (_memoryCache) return _memoryCache.schemes;

  const cached = loadCache();
  if (cached) {
    _memoryCache = cached;
    return cached.schemes;
  }

  console.log('📡 mfCategoryService: Fetching all MF categories from MFAPI.in...');
  try {
    // Step 1: Get list of all scheme codes
    const listRes = await fetch('https://api.mfapi.in/mf', {
      signal: AbortSignal.timeout(10000),
    });
    if (!listRes.ok) throw new Error(`MFAPI list fetch failed: ${listRes.status}`);
    const allSchemes: Array<{ schemeCode: number; schemeName: string }> = await listRes.json();
    console.log(`📡 mfCategoryService: Got ${allSchemes.length} schemes from MFAPI.in`);

    // Step 2: For category data, use AMFI NAV text file (much faster — single request, has categories)
    const amfiRes = await fetch('https://api.mfapi.in/mf/category', {
      signal: AbortSignal.timeout(8000),
    });

    const schemes: Record<number, MFSchemeMeta> = {};

    if (amfiRes.ok) {
      const categories: Array<{
        schemeCode: number;
        schemeName: string;
        schemeCategory: string;
        schemeType: string;
        fundHouse: string;
      }> = await amfiRes.json();

      for (const item of categories) {
        const atty = attyFromAmfiCategory(item.schemeCategory || '');
        schemes[item.schemeCode] = {
          schemeCode: item.schemeCode,
          schemeName: item.schemeName,
          schemeCategory: item.schemeCategory || '',
          schemeType: item.schemeType || '',
          fundHouse: item.fundHouse || '',
          atty,
        };
      }
    } else {
      // Fallback: build from the list with name-based inference (no category API available)
      console.warn('mfCategoryService: category API unavailable, using name-based inference');
      for (const s of allSchemes) {
        schemes[s.schemeCode] = {
          schemeCode: s.schemeCode,
          schemeName: s.schemeName,
          schemeCategory: '',
          schemeType: '',
          fundHouse: '',
          atty: inferAttyFromName(s.schemeName),
        };
      }
    }

    const cache: CategoryCache = { fetchedAt: Date.now(), schemes };
    saveCache(cache);
    _memoryCache = cache;
    console.log(`✅ mfCategoryService: Cached ${Object.keys(schemes).length} MF scheme categories`);
    return schemes;
  } catch (e) {
    console.warn('mfCategoryService: fetch failed, using name-based inference only', e);
    return {};
  }
}

/**
 * Get atty for a specific AMFI scheme code.
 * Uses cached data if available; returns undefined if scheme not found.
 */
export async function getAttyForSchemeCode(schemeCode: number): Promise<number | undefined> {
  const all = await fetchAllMFCategories();
  return all[schemeCode]?.atty;
}

/**
 * Name-based atty inference (used as fallback when MFAPI.in is unavailable).
 * This is the FIXED version of the old resolveAssetType name logic.
 */
export function inferAttyFromName(name: string): number {
  const lc = name.toLowerCase();

  // Gold/Silver exact products
  if (/sovereign gold bond|sgb/i.test(lc)) return 100; // Traded Bond
  if (/\bgold\s+etf\b/i.test(lc) || /\bgold\s+bees\b/i.test(lc)) return 51; // ETF
  if (/\bsilver\s+etf\b/i.test(lc)) return 51;
  if (/\bgold\s+(saving|savings)\s+fund\b/i.test(lc)) return 150; // Gold Savings FoF
  if (/\bsilver\s+(saving|savings)\s+fund\b/i.test(lc)) return 151;

  // ── DEBT MFs ─────────────────────────────────────────────────────────────
  if (/(overnight|liquid|money market|gilt|ultra short|low duration|short duration|medium duration|long duration|corporate bond|credit risk|banking.*psu|dynamic bond|floater|floating rate|target maturity|fixed maturity|fmp|interval fund|debt hybrid|conservative hybrid|regular savings|monthly income|mip|bharat bond|sdl)/i.test(lc)) {
    return 61;
  }

  // ── EQUITY / HYBRID MFs → these should ALL be atty 60, NOT 75 ───────────
  // Multi Asset goes here — NOT to gold!
  if (/(multi.?asset|multi.?cap|large.?cap|mid.?cap|small.?cap|micro.?cap|flexi.?cap|elss|balanced.?advantage|equity.?savings|arbitrage|aggressive.?hybrid|dynamic.?asset|retirement|children|contra|focused|dividend.?yield|value fund|sectoral|thematic|index fund)/i.test(lc)) {
    return 60;
  }

  // Fund of Funds — distinguish gold/silver FoF from equity/overseas FoF
  if (/fund.?of.?fund|fof\b/i.test(lc)) {
    if (/gold|silver|commodity|precious.?metal/i.test(lc)) return 150;
    return 60; // overseas FoF, equity FoF → MF Equity
  }

  // ETFs (non-gold)
  if (/\betf\b|\bbees\b/i.test(lc)) return 51;

  return 60; // default: treat unknown MF as Equity
}

// ── SCHEME CODE LOOKUP BY NAME ───────────────────────────────────────────────

/**
 * Build a name→schemeCode reverse index from cached data.
 * Used to look up AMFI code when we only have the fund name from MProfit.
 */
let _nameIndex: Record<string, number> | null = null;

export async function getSchemeCodeByName(searchName: string): Promise<number | undefined> {
  const all = await fetchAllMFCategories();
  if (!_nameIndex) {
    _nameIndex = {};
    for (const [code, meta] of Object.entries(all)) {
      _nameIndex[meta.schemeName.toLowerCase().trim()] = Number(code);
    }
  }
  const lc = searchName.toLowerCase().trim();
  // Exact match first
  if (_nameIndex[lc] !== undefined) return _nameIndex[lc];
  // Partial match
  const partialKey = Object.keys(_nameIndex).find(k => k.includes(lc) || lc.includes(k));
  return partialKey ? _nameIndex[partialKey] : undefined;
}

/**
 * Invalidate the cached data (call when user requests a manual refresh).
 */
export function invalidateMFCache() {
  try { localStorage.removeItem(CACHE_KEY); } catch {}
  _memoryCache = null;
  _nameIndex = null;
}
