import { supabase } from '../supabase';
import { getLivePrice, type AssetMaster, type LivePrice } from './assetMasterService';

export async function getIndices() {
  const indices = [
    { name: 'NIFTY 50', symbol: '^NSEI' },
    { name: 'SENSEX', symbol: '^BSESN' }
  ];

  const results = await Promise.all(indices.map(async (idx) => {
    try {
      // Use Yahoo Finance for indices
      const url = `https://query1.finance.yahoo.com/v8/finance/chart/${idx.symbol}?interval=1d&range=1d`;
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
        name: idx.name,
        price: parseFloat(price.toFixed(2)),
        change_pct: parseFloat(change_pct.toFixed(2))
      };
    } catch (e) {
      console.error(`Error fetching index ${idx.name}:`, e);
      return null;
    }
  }));

  return results.filter(r => r !== null) as { name: string; price: number; change_pct: number }[];
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
