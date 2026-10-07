const fs = require('fs');
let text = fs.readFileSync('src/services/assetMasterService.ts', 'utf8');

const oldGetYahooUrl = unction getYahooUrl(symbol: string): string {
  const path = \/v8/finance/chart/\?interval=1d&range=5d\;
  if (typeof window !== 'undefined') {
    return \/api/yahoo\\;
  } else {
    return \https://query1.finance.yahoo.com\\;
  }
};

const newGetGrowwUrl = unction getGrowwUrl(symbol: string): string {
  let exchange = 'NSE';
  let cleanSymbol = symbol;
  
  if (symbol.endsWith('.NS')) {
    cleanSymbol = symbol.replace('.NS', '');
  } else if (symbol.endsWith('.BO')) {
    exchange = 'BSE';
    cleanSymbol = symbol.replace('.BO', '');
  }

  const path = \/exchange/\/segment/CASH/\/latest\;
  if (typeof window !== 'undefined') {
    return \/api/groww\\;
  } else {
    return \https://groww.in/v1/api/stocks_data/v1/tr_live_prices\\;
  }
};

text = text.replace(oldGetYahooUrl, newGetGrowwUrl);

const oldFetchStockPrice = export async function fetchStockPrice(symbol: string): Promise<{ price: number; change: number; change_pct: number; date: string } | null> {
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
};

const newFetchStockPrice = export async function fetchStockPrice(symbol: string): Promise<{ price: number; change: number; change_pct: number; date: string } | null> {
  try {
    const url = getGrowwUrl(symbol);
    const headers = typeof window === 'undefined'
      ? {
          'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
          'Accept': 'application/json',
        }
      : undefined;
    const res = await fetch(url, { headers });
    if (!res.ok) return null;
    const data = await res.json();
    
    const price = data.ltp;
    if (typeof price !== 'number' || price <= 0) return null;
    
    const change = data.dayChange || 0;
    const change_pct = data.dayChangePerc || 0;
    const d = new Date(data.tsInMillis || Date.now());
    const dateStr = d.toISOString().split('T')[0];
    
    return {
      price: parseFloat(price.toFixed(2)),
      change: parseFloat(change.toFixed(2)),
      change_pct: parseFloat(change_pct.toFixed(2)),
      date: dateStr
    };
  } catch {
    return null;
  }
};

text = text.replace(oldFetchStockPrice, newFetchStockPrice);
fs.writeFileSync('src/services/assetMasterService.ts', text);
