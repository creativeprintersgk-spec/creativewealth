import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
dotenv.config({ path: path.resolve(__dirname, '../.env') });

const supabase = createClient(
  process.env.VITE_SUPABASE_URL!,
  process.env.VITE_SUPABASE_ANON_KEY!
);

async function run() {
  console.log("Fetching transactions bought before 2018-01-31...");
  // Buy transactions have trty in [19, 20, 12, 25, 30, 35, 40]
  const buyTrty = [19, 20, 12, 25, 30, 35, 40];
  
  const { data: txs, error } = await supabase
    .from('bs1')
    .select('pfid, amid, atyid, dt, qn, amt, purpr')
    .in('trty', buyTrty)
    .lt('dt', '2018-01-31');
    
  if (error) {
    console.error("Error:", error);
    return;
  }
  
  console.log(`Found ${txs.length} transactions before Jan 31, 2018.`);
  
  // Let's resolve their names
  const amids = Array.from(new Set(txs.map(t => t.amid)));
  console.log(`Unique amids: ${amids.length}`);
  
  // Fetch asset master details for these amids
  const { data: assets } = await supabase
    .from('asset_master')
    .select('amid, name, asset_type, nse_symbol, bse_code')
    .in('amid', amids);
    
  const assetMap: Record<number, any> = {};
  assets?.forEach(a => {
    assetMap[a.amid] = a;
  });
  
  // Group by asset and count
  const grouped: Record<number, { name: string; symbol: string; count: number; minDate: string }> = {};
  txs.forEach(t => {
    const asset = assetMap[t.amid];
    const name = asset ? asset.name : `Asset ${t.amid}`;
    const symbol = asset ? (asset.nse_symbol || asset.bse_code || '') : '';
    if (!grouped[t.amid]) {
      grouped[t.amid] = { name, symbol, count: 0, minDate: t.dt };
    }
    grouped[t.amid].count++;
    if (t.dt < grouped[t.amid].minDate) {
      grouped[t.amid].minDate = t.dt;
    }
  });
  
  console.log("\nAssets bought before Jan 31, 2018:");
  Object.entries(grouped)
    .sort((a, b) => b[1].count - a[1].count)
    .slice(0, 30)
    .forEach(([amid, info]) => {
      console.log(`  amid: ${amid} | name: "${info.name}" | symbol: "${info.symbol}" | txCount: ${info.count} | firstBuy: ${info.minDate}`);
    });
}

run().catch(console.error);
