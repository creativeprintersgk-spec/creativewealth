import { supabase } from '../supabase';
import { getLivePrice, type AssetMaster, type LivePrice, fetchStockPrice } from './assetMasterService';

export async function fetchPrices(items: any[]) {
  try {
    const res = await fetch(
      `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/get-prices`,
      {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${import.meta.env.VITE_SUPABASE_ANON_KEY}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ items }),
      }
    )
    if (!res.ok) return []
    const data = await res.json()
    return data.results || []
  } catch {
    return []
  }
}


let _indexCache: { data: any[]; fetchedAt: number } | null = null;
const INDEX_CACHE_MS = 60 * 1000; // cache 60 seconds

export async function getIndices() {
  // Return cached result if fresh enough
  if (_indexCache && Date.now() - _indexCache.fetchedAt < INDEX_CACHE_MS) {
    return _indexCache.data;
  }

  const symbols = [
    { symbol: '^NSEI',  name: 'NIFTY 50' },
    { symbol: '^BSESN', name: 'SENSEX'   },
  ];

  const results: any[] = [];

  for (const idx of symbols) {
    try {
      // Use Vite proxy in browser (/api/yahoo/...) to avoid CORS
      const path = `/v8/finance/chart/${encodeURIComponent(idx.symbol)}?interval=1d&range=1d`;
      const url = typeof window !== 'undefined'
        ? `/api/yahoo${path}`
        : `https://query1.finance.yahoo.com${path}`;

      const res = await fetch(url, {
        headers: typeof window === 'undefined'
          ? { 'User-Agent': 'Mozilla/5.0', 'Accept': 'application/json' }
          : undefined,
      });
      if (!res.ok) continue;

      const json = await res.json();
      const meta = json?.chart?.result?.[0]?.meta;
      if (!meta) continue;

      const price = meta.regularMarketPrice ?? 0;
      const prev  = meta.previousClose ?? meta.chartPreviousClose ?? price;
      const change     = parseFloat((price - prev).toFixed(2));
      const change_pct = prev > 0 ? parseFloat(((change / prev) * 100).toFixed(2)) : 0;

      results.push({ name: idx.name, price, change, change_pct });
    } catch {
      // Silently skip — sidebar will show last cached value
    }
  }

  if (results.length > 0) {
    _indexCache = { data: results, fetchedAt: Date.now() };
  }

  // Fall back to last cached data if fetch failed
  return results.length > 0 ? results : (_indexCache?.data ?? []);
}


export async function getPortfolioPrices(holdings: any[]): Promise<Map<number, LivePrice>> {
  const amids = [...new Set(holdings.map(h => h.amid).filter(id => !!id))];
  if (amids.length === 0) return new Map();

  // Lookup codes from asset_master since holdings (ledgers) only store amid
  const { data: assets, error } = await supabase
    .from('asset_master')
    .select('amid, name, asset_type, bse_code, amfi_code, nse_symbol, ticker, isin')
    .in('amid', amids);

  if (error || !assets) {
    console.error('Error fetching asset details for pricing:', error?.message);
    return new Map();
  }

  const assetMap = new Map<number, AssetMaster>();
  assets.forEach(a => assetMap.set(a.amid, a as AssetMaster));

  const results = new Map<number, LivePrice>();
  const CHUNK = 10;

  for (let i = 0; i < amids.length; i += CHUNK) {
    const chunkIds = amids.slice(i, i + CHUNK);
    await Promise.all(chunkIds.map(async (amid) => {
      const asset = assetMap.get(amid);
      if (!asset) return;
      
      // getLivePrice handles caching and routing to Yahoo/MFAPI
      const priceData = await getLivePrice(asset);
      if (priceData) {
        results.set(amid, priceData);
      }
    }));
  }

  return results;
}
