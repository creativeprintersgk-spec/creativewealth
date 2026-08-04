import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';
dotenv.config();

// We will fetch direct Yahoo endpoint to test
const sb = createClient(process.env.VITE_SUPABASE_URL!, process.env.VITE_SUPABASE_ANON_KEY!);

async function fetchYahoo(symbol: string): Promise<boolean> {
  const url = `https://query1.finance.yahoo.com/v8/finance/chart/${symbol}?interval=1d&range=5d`;
  try {
    const res = await fetch(url, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
        'Accept': 'application/json',
      }
    });
    if (!res.ok) return false;
    const data: any = await res.json();
    return data?.chart?.result?.[0]?.meta?.regularMarketPrice > 0;
  } catch {
    return false;
  }
}

async function main() {
  console.log('Fetching active stocks from sum_table...');
  
  // 1. Get all active amids for stocks (atty = 50)
  const { data: sumRows, error: sumErr } = await sb
    .from('sum_table')
    .select('amid, qnt')
    .eq('atty', 50);

  if (sumErr || !sumRows) {
    console.error('Error fetching sum_table:', sumErr);
    return;
  }

  const activeAmids = Array.from(new Set(
    sumRows.filter((r: any) => Number(r.qnt) > 0.0001).map((r: any) => Number(r.amid))
  ));

  console.log(`Found ${activeAmids.length} active stock amids. Fetching details from asset_master...`);

  // 2. Fetch details from asset_master
  const { data: assets, error: assetErr } = await sb
    .from('asset_master')
    .select('*')
    .in('amid', activeAmids);

  if (assetErr || !assets) {
    console.error('Error fetching asset_master:', assetErr);
    return;
  }

  console.log('\n--- Testing Price Fetch for Active Stocks ---');
  for (const asset of assets) {
    const nseSym = asset.nse_symbol ? `${asset.nse_symbol}.NS` : null;
    const bseSym = asset.bse_code ? `${asset.bse_code}.BO` : null;

    let nseOk = false;
    let bseOk = false;

    if (nseSym) {
      nseOk = await fetchYahoo(nseSym);
    }
    if (bseSym) {
      bseOk = await fetchYahoo(bseSym);
    }

    console.log(`Stock: "${asset.name}" (amid: ${asset.amid})`);
    console.log(`  NSE: "${asset.nse_symbol}" -> Yahoo: ${nseSym} -> ${nseOk ? '✅ SUCCESS' : '❌ FAILED'}`);
    console.log(`  BSE: "${asset.bse_code}" -> Yahoo: ${bseSym} -> ${bseOk ? '✅ SUCCESS' : '❌ FAILED'}`);
    
    if (!nseOk && !bseOk) {
      console.log(`  ⚠️ CRITICAL: BOTH FAILED! This stock price will be OLD/WRONG!`);
    }
  }
}
main().catch(console.error);
