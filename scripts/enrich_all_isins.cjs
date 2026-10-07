const { createClient } = require('@supabase/supabase-js');
const fs = require('fs');

const envFile = fs.readFileSync('.env', 'utf-8');
let supabaseUrl = '', supabaseKey = '';
envFile.split('\n').forEach(line => {
  if (line.startsWith('VITE_SUPABASE_URL=')) supabaseUrl = line.split('=')[1].trim();
  if (line.startsWith('VITE_SUPABASE_ANON_KEY=')) supabaseKey = line.split('=')[1].trim();
});

const supabase = createClient(supabaseUrl, supabaseKey);

async function runEnrichment() {
  console.log('🚀 Starting Universal ISIN Mapping & Enrichment...');

  // 1. Fetch AMFI master
  console.log('📥 Fetching AMFI master (NAVAll.txt)...');
  const amfiRes = await fetch('https://www.amfiindia.com/spages/NAVAll.txt');
  const amfiText = await amfiRes.text();
  const amfiLines = amfiText.split('\n');

  const amfiCodeToIsin = new Map();
  const amfiIsinToNav = new Map();
  const amfiNameToInfo = [];

  for (const line of amfiLines) {
    const parts = line.split(';');
    if (parts.length >= 6) {
      const code = parts[0].trim();
      const isin = parts[1].trim();
      const isinReinv = parts[2].trim();
      const name = parts[3].trim();
      const nav = parseFloat(parts[4].trim());
      const date = parts[5].trim();

      if (code && isin && isin.length >= 10 && isin !== '-') {
        amfiCodeToIsin.set(code, isin);
        if (!isNaN(nav)) {
          amfiIsinToNav.set(isin, { nav, date, code, name });
        }
      }
      if (code && isinReinv && isinReinv.length >= 10 && isinReinv !== '-') {
        if (!isNaN(nav)) {
          amfiIsinToNav.set(isinReinv, { nav, date, code, name });
        }
      }
      if (name && code) {
        amfiNameToInfo.push({ name: name.toUpperCase(), code, isin: isin !== '-' ? isin : null });
      }
    }
  }
  console.log(`✅ Loaded ${amfiCodeToIsin.size} AMFI Scheme-to-ISIN mappings.`);

  // 2. Fetch NSE equity master
  console.log('📥 Fetching NSE Equity master (EQUITY_L.csv)...');
  const nseRes = await fetch('https://nsearchives.nseindia.com/content/equities/EQUITY_L.csv', {
    headers: { 'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64)' }
  });
  const nseText = await nseRes.text();
  const nseLines = nseText.split('\n');
  const nseList = [];

  for (let i = 1; i < nseLines.length; i++) {
    const parts = nseLines[i].split(',');
    if (parts.length >= 7) {
      nseList.push({
        symbol: parts[0].trim(),
        name: parts[1].trim(),
        series: parts[2].trim(),
        isin: parts[6].trim()
      });
    }
  }
  console.log(`✅ Loaded ${nseList.length} NSE listed equities with official ISINs.`);

  // 3. Known BSE-only and fixed ISIN mappings
  const MANUAL_ISIN_MAP = {
    // BSE Only Stocks
    101434: { isin: 'INE496B01017', symbol: '512215.BO', name: 'Stephanotis Finance' },
    100183: { isin: 'INE253B01016', symbol: '500254.BO', name: 'Uttam Value Steels (Evonith)' },
    103605: { isin: 'INE465E01015', symbol: 'MAYURFL.BO', name: 'Mayur Floorings' },
    103561: { isin: 'INE791C01016', symbol: 'ORGCOAT.BO', name: 'Organic Coatings' },
    100402: { isin: 'INE869H01014', symbol: 'LORDSMARK.BO', name: 'Lords Mark Industries' },
    100263: { isin: 'INE414D01019', symbol: 'RAMAPETRO.BO', name: 'Rama Petrochemicals' },
    102024: { isin: 'INE912C01016', symbol: 'NHCFOODS.BO', name: 'NHC Foods' },
    105055: { isin: 'INE245B01019', symbol: 'PREMIER.BO', name: 'Premier Energy and Infrastructure' }
  };

  // 4. Query all active AMIDs from sum_table
  const { data: sumRows } = await supabase.from('sum_table').select('amid, qnt, currv');
  const activeAmids = new Set();
  sumRows?.forEach(r => {
    if (Number(r.qnt) > 0.0001 || Number(r.currv) > 0.01) {
      activeAmids.add(Number(r.amid));
    }
  });
  console.log(`🔍 Found ${activeAmids.size} active AMIDs across portfolios.`);

  // Query details for all active assets
  const amidList = Array.from(activeAmids);
  const { data: assets } = await supabase
    .from('asset_master')
    .select('*')
    .in('amid', amidList);

  const { data: samRows } = await supabase
    .from('sam')
    .select('*')
    .in('amid', amidList);

  const assetMap = new Map();
  assets?.forEach(a => assetMap.set(Number(a.amid), a));

  const samMap = new Map();
  samRows?.forEach(s => samMap.set(Number(s.amid), s));

  console.log('\n--- RESOLVING AND UPDATING ISINs ---');
  let updatedCount = 0;

  for (const amid of amidList) {
    const am = assetMap.get(amid) || {};
    const sam = samMap.get(amid) || {};
    const name = am.name || sam.anm || '';
    const currentIsin = am.isin || sam.extstr;
    const atyp = am.asset_type || sam.atyp || 50;
    const amfiCode = am.amfi_code || sam.exint2;

    let resolvedIsin = currentIsin;
    let resolvedSymbol = am.nse_symbol || am.ticker;

    // Check manual map
    if (MANUAL_ISIN_MAP[amid]) {
      resolvedIsin = MANUAL_ISIN_MAP[amid].isin;
      resolvedSymbol = MANUAL_ISIN_MAP[amid].symbol;
    }

    // Check if name contains ISIN (common in bonds/NCDs)
    if (!resolvedIsin || resolvedIsin === '-') {
      const match = name.match(/(?:ISIN\s+|IN\s*)?(IN[A-Z0-9]{10})/i);
      if (match) resolvedIsin = match[1].toUpperCase();
    }

    // Mutual fund resolution via AMFI
    if ((atyp === 60 || atyp === 61 || atyp === 62 || amfiCode) && amfiCode) {
      const isinFromAmfi = amfiCodeToIsin.get(String(amfiCode));
      if (isinFromAmfi) resolvedIsin = isinFromAmfi;
    }

    // Stock resolution via NSE master
    if (!resolvedIsin && (atyp === 50 || atyp === 51)) {
      const clean = name.toUpperCase();
      const nseMatch = nseList.find(n => 
        (am.ticker && n.symbol.toUpperCase() === am.ticker.toUpperCase()) ||
        n.name.toUpperCase() === clean ||
        clean.includes(n.name.toUpperCase()) ||
        n.name.toUpperCase().includes(clean)
      );
      if (nseMatch) {
        resolvedIsin = nseMatch.isin;
        resolvedSymbol = nseMatch.symbol;
      }
    }

    console.log(`AMID: ${amid} | Name: ${name.slice(0, 35).padEnd(35)} | ISIN: ${resolvedIsin || 'PENDING'} | Symbol: ${resolvedSymbol || 'N/A'}`);

    if (resolvedIsin && resolvedIsin !== currentIsin) {
      // Update asset_master
      await supabase
        .from('asset_master')
        .update({ isin: resolvedIsin, nse_symbol: resolvedSymbol || am.nse_symbol })
        .eq('amid', amid);

      // Update sam
      await supabase
        .from('sam')
        .update({ extstr: resolvedIsin, alias: resolvedSymbol || sam.alias })
        .eq('amid', amid);

      updatedCount++;
    }
  }

  console.log(`\n✨ Universal ISIN Mapping Complete! Successfully updated ${updatedCount} assets.`);
}

runEnrichment().catch(err => {
  console.error('Fatal error during ISIN enrichment:', err);
  process.exit(1);
});
