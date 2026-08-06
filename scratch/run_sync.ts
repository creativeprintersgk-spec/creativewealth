import dotenv from 'dotenv';
dotenv.config();

import { syncLivePrices, state } from '../src/logic';
import { supabase } from '../src/supabase';

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
  console.log("Fetching all assets and holdings using safeFetch...");
  const sumRows = await safeFetch('sum_table');
  const assets = await safeFetch('asset_master');
  state.sumTable = sumRows;
  state.assetMaster = assets;
  state.mprices = [];
  state.priceMap = {};
  
  console.log(`Loaded ${sumRows.length} sumTable rows, ${assets.length} assetMaster rows.`);
  
  const amids = Array.from(new Set(
    state.sumTable
      .filter((s: any) => Number(s.qnt) > 0.0001 || Number(s.currv) > 0.01)
      .map((s: any) => Number(s.amid))
  ));
  console.log(`Found ${amids.length} active AMIDs.`);
  
  console.log('Starting forced live sync for all active holdings...');
  await syncLivePrices(msg => console.log('Progress:', msg), true);
  console.log('Sync finished!');
  console.log('SGB 2.5% MAR 2028 (amid: 426647) priceMap:', state.priceMap[426647]);
  console.log('G-Sec 6.10% GS 2031 (amid: 440888) priceMap:', state.priceMap[440888]);
}

run().catch(e => console.error("Error during sync:", e));
