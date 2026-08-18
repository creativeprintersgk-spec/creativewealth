import { supabase } from '../src/supabase';
import { extractIsin, fuzzyMatchSGBSymbol, fuzzyMatchGSecSymbol } from '../src/services/assetMasterService';

const BOND_ISIN_TO_NSE_SYMBOL: Record<string, string> = {
  // G-Secs
  'IN0020210095': '610GS2031',
  'IN0020210152': '667GS2035',
  'IN0020200252': '667GS2050',
  'IN0020210194': '699GS2051',
  'IN0020230051': '73GS2053',
  'IN0020240035': '734GS2064',
  'IN0020220085': '736GS2052',
  'IN0020220086': '736GS2052',
  'IN0020220020': '754GS2036',
  'IN0020220029': '754GS2036',

  // SGBs
  'IN0020190552': 'SGBMAR28X',
  'IN0020200161': 'SGBAUG28V',
  'IN0020210220': 'SGBD29VIII',
  'IN0020210228': 'SGBD29VIII',
  'IN0020190537': 'SGBJ28VIII',
  'IN0020200377': 'SGBJAN29IX',
  'IN0020200385': 'SGBJAN29X',
  'IN0020200146': 'SGBJUL28IV',
  'IN0020210111': 'SGBJUL29IV',
  'IN0020200104': 'SGBJUN28',
  'IN0020210061': 'SGBJUN29II',
  'IN0020210087': 'SGBJU29III',
  'IN0020220045': 'SGBJUN30',
  'IN0020210145': 'SGBSEP29VI',
  'IN0020200195': 'SGBSEP28VI',
  'IN0020170166': 'SGBJAN26XIV',
  'IN0020180314': 'SGBNOV26',
};

async function safeFetch(table: string): Promise<any[]> {
  let all: any[] = [];
  let page = 0;
  const size = 1000;
  const pkMap: Record<string, string> = {
    sum_table: 'sid',
    asset_master: 'amid'
  };
  while (true) {
    const { data, error } = await supabase
      .from(table)
      .select('*')
      .order(pkMap[table] || 'id')
      .range(page * size, (page + 1) * size - 1);
    if (error) {
      console.warn(`Error fetching ${table}:`, error.message);
      break;
    }
    if (!data || data.length === 0) break;
    all = all.concat(data);
    if (data.length < size) break;
    page++;
  }
  return all;
}

async function run() {
  console.log("Loading all records from DB...");
  const sumRows = await safeFetch('sum_table');
  const assets = await safeFetch('asset_master');
  
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
  const uniqueBonds: any[] = [];
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
  const csvMap = new Map<string, number>();
  lines.forEach(l => {
    const parts = l.split(',');
    if (parts.length >= 9) {
      csvMap.set(parts[0].trim(), parseFloat(parts[8].trim()));
    }
  });
  const csvSymbols = Array.from(csvMap.keys());

  // Get current DB prices for today
  const { data: dbPrices } = await supabase.from('mprices').select('*').eq('date', '2026-08-06');
  const dbPriceMap = new Map(dbPrices?.map(p => [p.amid, p.currp]) || []);

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
    
    // We only verify if the symbol was matched in the CSV
    const status = (csvPrice === dbPrice) ? 'MATCH' : 'MISMATCH';
    if (status === 'MATCH') matchCount++; else mismatchCount++;
    
    console.log(`Asset: ${b.name.trim()} (amid: ${b.amid})`);
    console.log(`  -> ISIN: ${b.isin || 'N/A'}, Symbol: ${sym || 'N/A'}`);
    console.log(`  -> CSV Price: ${csvPrice || 'N/A'}, DB Price: ${dbPrice || 'N/A'} [${status}]`);
  });

  console.log(`\nAudit Summary: Total=${uniqueBonds.length}, Matches=${matchCount}, Mismatches=${mismatchCount}`);
}
run().catch(e => console.error(e));
