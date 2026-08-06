require('dotenv').config();
const { createClient } = require('@supabase/supabase-js');
const s = createClient(process.env.VITE_SUPABASE_URL, process.env.VITE_SUPABASE_ANON_KEY);
const { BOND_ISIN_TO_NSE_SYMBOL, extractIsin, fuzzyMatchSGBSymbol, fuzzyMatchGSecSymbol } = require('../src/services/assetMasterService');

async function run() {
  const { data: sumRows } = await s.from('sum_table').select('*');
  const { data: assets } = await s.from('asset_master').select('*');
  
  // Filter for SGBs and G-Secs with active holdings
  const activeBonds = sumRows
    .filter(r => Number(r.qnt) > 0.0001 && (r.atty === 40 || r.atty === 70))
    .map(r => {
      const asset = assets.find(a => a.amid === r.amid);
      return {
        amid: r.amid,
        name: asset ? asset.name : 'Unknown',
        qnt: r.qnt,
        asset_type: asset ? asset.asset_type : 0,
        isin: asset ? extractIsin(asset) : null
      };
    });

  // Unique active bonds
  const uniqueBonds = [];
  const seen = new Set();
  activeBonds.forEach(b => {
    if (!seen.has(b.amid)) {
      seen.add(b.amid);
      uniqueBonds.push(b);
    }
  });

  // Download bhavcopy
  const url = 'https://nsearchives.nseindia.com/products/content/sec_bhavdata_full_06082026.csv';
  const res = await fetch(url);
  const text = await res.text();
  const lines = text.split('\n');
  const csvMap = new Map();
  lines.forEach(l => {
    const parts = l.split(',');
    if (parts.length >= 9) {
      csvMap.set(parts[0].trim(), parseFloat(parts[8].trim()));
    }
  });
  const csvSymbols = Array.from(csvMap.keys());

  // Get current DB prices for today
  const { data: dbPrices } = await s.from('mprices').select('*').eq('date', '2026-08-06');
  const dbPriceMap = new Map(dbPrices.map(p => [p.amid, p.currp]));

  console.log('--- COMPREHENSIVE G-SEC & SGB PRICE AUDIT ---');
  let matchCount = 0;
  let mismatchCount = 0;
  
  uniqueBonds.forEach(b => {
    const cleanName = b.name.toUpperCase();
    let sym = b.isin ? BOND_ISIN_TO_NSE_SYMBOL[b.isin] : null;
    if (!sym) {
      sym = fuzzyMatchSGBSymbol(cleanName, csvSymbols) || fuzzyMatchGSecSymbol(cleanName, csvSymbols);
    }
    
    const csvPrice = sym ? csvMap.get(sym) : null;
    const dbPrice = dbPriceMap.get(b.amid);
    
    const status = (csvPrice === dbPrice) ? 'MATCH' : 'MISMATCH';
    if (status === 'MATCH') matchCount++; else mismatchCount++;
    
    console.log(`Asset: ${b.name.trim()} (amid: ${b.amid})`);
    console.log(`  -> ISIN: ${b.isin || 'N/A'}, Symbol: ${sym || 'N/A'}`);
    console.log(`  -> CSV Price: ${csvPrice || 'N/A'}, DB Price: ${dbPrice || 'N/A'} [${status}]`);
  });

  console.log(`\nAudit Summary: Total=${uniqueBonds.length}, Matches=${matchCount}, Mismatches=${mismatchCount}`);
}
run().catch(e => console.error(e));
