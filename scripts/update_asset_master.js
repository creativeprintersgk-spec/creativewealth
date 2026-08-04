import { createClient } from '@supabase/supabase-js';
import * as dotenv from 'dotenv';
import { resolve, dirname } from 'path';
import { fileURLToPath } from 'url';
import zlib from 'zlib';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

// Load environment variables from .env file
dotenv.config({ path: resolve(__dirname, '../.env') });

const SUPABASE_URL = process.env.VITE_SUPABASE_URL;
const SUPABASE_KEY = process.env.VITE_SUPABASE_ANON_KEY;

if (!SUPABASE_URL || !SUPABASE_KEY) {
  console.error('Missing VITE_SUPABASE_URL or VITE_SUPABASE_ANON_KEY in .env file.');
  process.exit(1);
}

const supabase = createClient(SUPABASE_URL, SUPABASE_KEY);

const AMFI_NAV_URL = 'https://www.amfiindia.com/spages/NAVAll.txt';
const NSE_BHAVCOPY_URL = 'https://archives.nseindia.com/content/equities/EQUITY_L.csv';

async function fetchAmfiData() {
  console.log('Fetching AMFI data from:', AMFI_NAV_URL);
  try {
    const response = await fetch(AMFI_NAV_URL);
    if (!response.ok) {
      throw new Error(`Failed to fetch AMFI data: ${response.status} ${response.statusText}`);
    }
    const text = await response.text();
    const lines = text.split('\n');
    
    const newAssets = [];
    let isinSet = new Set();
    
    for (const line of lines) {
      const parts = line.split(';');
      if (parts.length >= 6) {
        // Scheme Code;ISIN Div Payout/ISIN Growth;ISIN Div Reinvestment;Scheme Name;Net Asset Value;Date
        const isin = parts[1].trim();
        const isinReinv = parts[2].trim();
        const schemeName = parts[3].trim();
        
        if (isin && isin.length >= 10 && isin !== '-' && !isinSet.has(isin)) {
          newAssets.push({ isin, name: schemeName, asset_type: 60 });
          isinSet.add(isin);
        }
        if (isinReinv && isinReinv.length >= 10 && isinReinv !== '-' && !isinSet.has(isinReinv)) {
          newAssets.push({ isin: isinReinv, name: schemeName, asset_type: 60 });
          isinSet.add(isinReinv);
        }
      }
    }
    
    console.log(`Parsed ${newAssets.length} unique ISINs from AMFI.`);
    return newAssets;
  } catch (error) {
    console.error('Error fetching AMFI data:', error);
    return [];
  }
}

async function fetchNseData() {
  console.log('Fetching NSE Equity data from:', NSE_BHAVCOPY_URL);
  try {
    const response = await fetch(NSE_BHAVCOPY_URL);
    if (!response.ok) {
      throw new Error(`Failed to fetch NSE data: ${response.status} ${response.statusText}`);
    }
    const text = await response.text();
    const lines = text.split('\n');
    
    const newAssets = [];
    let isinSet = new Set();
    
    // Skip header line
    for (let i = 1; i < lines.length; i++) {
      const line = lines[i];
      const parts = line.split(',');
      if (parts.length >= 7) {
        // SYMBOL,NAME OF COMPANY, SERIES, DATE OF LISTING, PAID UP VALUE, MARKET LOT, ISIN NUMBER, FACE VALUE
        const symbol = parts[0].trim();
        const companyName = parts[1].trim();
        const isin = parts[6] ? parts[6].trim() : '';
        
        if (isin && isin.length >= 10 && !isinSet.has(isin)) {
          newAssets.push({ isin, name: companyName, asset_type: 10, symbol });
          isinSet.add(isin);
        }
      }
    }
    
    console.log(`Parsed ${newAssets.length} unique ISINs from NSE.`);
    return newAssets;
  } catch (error) {
    console.error('Error fetching NSE data:', error);
    return [];
  }
}

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
            const formattedTicker = `${symbol}.${exchange === 'BSE_EQ' ? 'BO' : 'NS'}`;
            newAssets.push({ isin, name, asset_type: 70, ticker: formattedTicker });
            isinSet.add(isin);
          }
        }
      }
    }
    
    console.log(`Parsed ${newAssets.length} IN0020 ISINs from Upstox.`);
    return newAssets;
  } catch (error) {
    console.error('Error fetching Upstox data:', error);
    return [];
  }
}

async function getNextAmid() {
  const { data, error } = await supabase
    .from('asset_master')
    .select('amid')
    .order('amid', { ascending: false })
    .limit(1);
    
  if (error || !data || data.length === 0) {
    return 100000; // Start high to avoid conflicts
  }
  return Number(data[0].amid) + 1;
}

async function syncData() {
  console.log('Starting asset sync process...');
  
  const amfiAssets = await fetchAmfiData();
  const nseAssets = await fetchNseData();
  const upstoxAssets = await fetchUpstoxData();
  
  const allAssets = [...amfiAssets, ...nseAssets, ...upstoxAssets];
  console.log(`Total assets to check: ${allAssets.length}`);
  
  if (allAssets.length === 0) {
    console.log('No assets fetched. Aborting.');
    return;
  }
  
  let nextAmid = await getNextAmid();
  console.log(`Starting AMID generation from: ${nextAmid}`);
  
  // To avoid pulling 80,000 records, we process in chunks
  const chunkSize = 1000;
  let insertedCount = 0;
  
  for (let i = 0; i < allAssets.length; i += chunkSize) {
    const chunk = allAssets.slice(i, i + chunkSize);
    const isinList = chunk.map(a => a.isin);
    
    // Find which ISINs already exist in asset_master
    const { data: existingData, error } = await supabase
      .from('asset_master')
      .select('isin')
      .in('isin', isinList);
      
    if (error) {
      console.error('Error querying existing ISINs:', error);
      continue;
    }
    
    const existingIsins = new Set(existingData.map(d => d.isin));
    
    const assetsToInsert = [];
    const samToInsert = [];
    
    for (const asset of chunk) {
      if (!existingIsins.has(asset.isin)) {
        const amid = nextAmid++;
        
        assetsToInsert.push({
          amid: amid,
          name: asset.name,
          asset_type: asset.asset_type,
          isin: asset.isin
        });
        
        samToInsert.push({
          amid: amid,
          anm: asset.name,
          atyp: asset.asset_type,
          extstr: asset.isin,
          alias: asset.symbol || null
        });
        
        existingIsins.add(asset.isin); // Prevent duplicates within the chunk if any
      }
    }
    
    if (assetsToInsert.length > 0) {
      console.log(`Inserting ${assetsToInsert.length} new assets from chunk ${Math.floor(i/chunkSize) + 1}...`);
      
      const { error: insertError } = await supabase
        .from('asset_master')
        .insert(assetsToInsert);
        
      if (insertError) {
        console.error('Error inserting into asset_master:', insertError);
      } else {
        const { error: samInsertError } = await supabase
          .from('sam')
          .insert(samToInsert);
          
        if (samInsertError) {
          console.error('Error inserting into sam:', samInsertError);
        } else {
          insertedCount += assetsToInsert.length;
        }
      }
    }
  }
  
  console.log(`Sync complete. Inserted ${insertedCount} new assets.`);
}

syncData().catch(console.error);
