import zlib from 'zlib';

const UPSTOX_URL = 'https://assets.upstox.com/market-quote/instruments/exchange/complete.csv.gz';

async function fetchUpstoxData() {
  console.log('Fetching Upstox instruments from:', UPSTOX_URL);
  try {
    const response = await fetch(UPSTOX_URL);
    if (!response.ok) {
      throw new Error(`Failed to fetch Upstox data: ${response.status} ${response.statusText}`);
    }
    const arrayBuffer = await response.arrayBuffer();
    const csv = zlib.gunzipSync(arrayBuffer).toString('utf-8');
    const lines = csv.split('\n');
    
    const newAssets = [];
    let isinSet = new Set();
    
    for (let i = 1; i < lines.length; i++) {
      const line = lines[i];
      if (!line) continue;
      
      const parts = line.split('","').map(p => p.replace(/^"|"$/g, ''));
      if (parts.length >= 12) {
        const instrumentKey = parts[0];
        const symbol = parts[2];
        const name = parts[3];
        const exchange = parts[11];
        
        if (instrumentKey.includes('|IN')) {
          const isin = instrumentKey.split('|')[1];
          if (isin.startsWith('IN0020') && !isinSet.has(isin)) { 
            newAssets.push({ isin, name, asset_type: 70, symbol: `${symbol}.${exchange === 'BSE_EQ' ? 'BO' : 'NS'}` });
            isinSet.add(isin);
          }
        }
      }
    }
    
    console.log(`Parsed ${newAssets.length} IN0020 ISINs from Upstox.`);
    console.log(newAssets.filter(a => a.name.includes('SGB')).slice(0, 3));
    return newAssets;
  } catch (error) {
    console.error('Error fetching Upstox data:', error);
    return [];
  }
}

fetchUpstoxData();
