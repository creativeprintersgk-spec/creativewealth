const zlib = require('zlib');
const { createClient } = require('@supabase/supabase-js');
require('dotenv').config();

const supabase = createClient(process.env.VITE_SUPABASE_URL, process.env.VITE_SUPABASE_ANON_KEY);

async function fix() {
  console.log('Fetching...');
  const r = await fetch('https://assets.upstox.com/market-quote/instruments/exchange/complete.csv.gz');
  const b = await r.arrayBuffer();
  const csv = zlib.gunzipSync(b).toString('utf-8');
  const lines = csv.split('\n');
  
  for(let i=1; i<lines.length; i++) {
    const parts = lines[i].split('","').map(p=>p.replace(/^"|"$/g,''));
    if(parts.length >= 12 && parts[0].includes('|IN')) {
      const isin = parts[0].split('|')[1];
      if(isin.startsWith('IN0020')) {
        const symbol = parts[2];
        const exchange = parts[11];
        const t = `${symbol}.${exchange === 'BSE_EQ' ? 'BO' : 'NS'}`;
        await supabase.from('asset_master').update({ticker: t}).eq('isin', isin);
      }
    }
  }
  console.log('Done fixing tickers!');
}
fix();
