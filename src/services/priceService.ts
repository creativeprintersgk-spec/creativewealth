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

export async function getIndices() {
  return [
    { name: 'NIFTY 50', price: 24614.90, change: -159.40, change_pct: -0.64 },
    { name: 'SENSEX', price: 78428.95, change: -210.08, change_pct: -0.27 }
  ];
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
