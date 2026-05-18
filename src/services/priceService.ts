import { supabase } from '../supabase';
import { getLivePrice, type AssetMaster, type LivePrice } from './assetMasterService';

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
  const results = await fetchPrices([
    { id: 'index_nifty', type: 'index', code: '^NSEI' },
    { id: 'index_sensex', type: 'index', code: '^BSESN' },
  ])
  
  console.log('getIndices raw results from Edge:', results);
  
  const map = Object.fromEntries(results.map((r: any) => [r.id, r]))
  
  const nifty = map['index_nifty']
  const sensex = map['index_sensex']

  console.log('getIndices mapped objects:', { nifty, sensex });

  const arr = []
  if (nifty && nifty.price > 0) arr.push({ name: 'NIFTY 50', price: nifty.price, change: nifty.change || 0, change_pct: nifty.change_pct || 0 })
  if (sensex && sensex.price > 0) arr.push({ name: 'SENSEX', price: sensex.price, change: sensex.change || 0, change_pct: sensex.change_pct || 0 })
  return arr
}

export async function getPortfolioPrices(holdings: any[]): Promise<Map<number, LivePrice>> {
  const amids = [...new Set(holdings.map(h => h.amid).filter(id => !!id))];
  if (amids.length === 0) return new Map();

  // Lookup codes from asset_master since holdings (ledgers) only store amid
  const { data: assets, error } = await supabase
    .from('asset_master')
    .select('amid, name, asset_type, bse_code, amfi_code, ticker')
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
