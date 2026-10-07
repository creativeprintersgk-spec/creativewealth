const fs = require('fs');

async function testAll189() {
  const st = JSON.parse(fs.readFileSync('public/snapshot/sum_table.json', 'utf8'));
  const am = JSON.parse(fs.readFileSync('public/snapshot/asset_master.json', 'utf8'));
  const sam = JSON.parse(fs.readFileSync('public/snapshot/sam.json', 'utf8'));
  const amMap = new Map(am.map(a => [a.amid, a]));
  const samMap = new Map(sam.map(s => [s.amid, s]));

  const uniqueAmids = Array.from(new Set(st.filter(s => s.qnt > 0.0001 || s.currv > 0.01).map(s => s.amid)));

  const assets = uniqueAmids.map(id => {
    const a = amMap.get(id);
    if (a) return a;
    const s = samMap.get(id);
    if (s) return { amid: s.amid, name: s.anm, asset_type: s.atyp, nse_symbol: s.alias, bse_code: s.exint1, amfi_code: s.exint2, isin: s.extstr };
    return { amid: id, name: `Asset ${id}` };
  });

  console.log(`Auditing live price fetch for all ${assets.length} assets...`);

  // Let's import getLivePrice from src/services/assetMasterService via tsx or test using direct HTTP requests through Vite proxy
  // Let's test by hitting Vite proxy directly so we know exactly what Yahoo and MFAPI return!
  const bhavRes = await fetch('http://localhost:5173/api/nse-bhavcopy/sec_bhavdata_full_29092026.csv');
  const bhavText = await bhavRes.text();
  const bhavLines = bhavText.split('\n');
  const bhavMap = new Map();
  for (const line of bhavLines) {
    const parts = line.split(',');
    if (parts.length >= 9) {
      const sym = parts[0].trim();
      const closePrice = parseFloat(parts[8].trim());
      if (sym && !isNaN(closePrice)) bhavMap.set(sym, closePrice);
    }
  }

  const results = {
    liveQuote: [],
    bhavcopyQuote: [],
    mfapiQuote: [],
    costFallback: []
  };

  for (let i = 0; i < assets.length; i++) {
    const asset = assets[i];
    // Check if override exists or test ticker
    let quote = null;
    let source = '';

    // Check MF
    if (asset.asset_type === 60 || asset.asset_type === 61 || asset.asset_type === 62 || asset.amfi_code) {
      const amfi = asset.amfi_code || (asset.name.includes('NIPPON') && asset.name.includes('MULTI ASSET') ? 148457 : null);
      if (amfi) {
        try {
          const res = await fetch(`http://localhost:5173/api/mfapi/mf/${amfi}`);
          const d = await res.json();
          if (d?.data?.[0]?.nav) {
            quote = parseFloat(d.data[0].nav);
            source = 'mfapi';
          }
        } catch (e) {}
      }
    }

    // Check Bhavcopy
    if (!quote) {
      // Check if bond / SGB / GSec
      const nse = bhavMap.get(asset.nse_symbol);
      if (nse) {
        quote = nse;
        source = 'nse_bhavcopy';
      }
    }

    // Check Yahoo
    if (!quote) {
      const candidates = [];
      if (asset.ticker) candidates.push(asset.ticker);
      if (asset.nse_symbol) candidates.push(`${asset.nse_symbol.trim().replace(/\s+/g, '')}.NS`);
      if (asset.bse_code) candidates.push(`${asset.bse_code}.BO`);

      for (const sym of candidates) {
        try {
          const res = await fetch(`http://localhost:5173/api/yahoo/v8/finance/chart/${encodeURIComponent(sym)}?interval=1d&range=5d`);
          const d = await res.json();
          const p = d?.chart?.result?.[0]?.meta?.regularMarketPrice;
          if (p && p > 0) {
            quote = p;
            source = `yahoo (${sym})`;
            break;
          }
        } catch (e) {}
      }
    }

    if (quote) {
      results.liveQuote.push({ amid: asset.amid, name: asset.name, price: quote, source });
    } else {
      results.costFallback.push({
        amid: asset.amid,
        name: asset.name,
        type: asset.asset_type,
        nse: asset.nse_symbol,
        bse: asset.bse_code,
        ticker: asset.ticker
      });
    }
  }

  console.log(`\n=== SUMMARY ===`);
  console.log(`Got live quotes: ${results.liveQuote.length}`);
  console.log(`Missing quotes (fallback to cost): ${results.costFallback.length}\n`);

  console.log(`=== ASSETS FALLING BACK TO COST (${results.costFallback.length}) ===`);
  results.costFallback.forEach((c, idx) => {
    console.log(`${idx + 1}. [AMID: ${c.amid}] [Type: ${c.type}] "${c.name}" | NSE: ${c.nse} | BSE: ${c.bse} | Ticker: ${c.ticker}`);
  });
}

testAll189().catch(console.error);
