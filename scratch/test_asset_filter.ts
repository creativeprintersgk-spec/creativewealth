import 'dotenv/config';
import { createClient } from '@supabase/supabase-js';
import { state, rebuildAllIndexes } from '../src/logic';
import { generateCapitalGainsDetailed } from '../src/services/capitalGainsEngine';

const supabase = createClient(
  process.env.VITE_SUPABASE_URL!,
  process.env.VITE_SUPABASE_ANON_KEY!
);

async function run() {
  console.log('Loading state from Supabase...');
  const { data: sam } = await supabase.from('sam').select('*');
  const { data: bs1 } = await supabase.from('bs1').select('*');
  const { data: portfolios } = await supabase.from('portfolios').select('*');

  state.sam = sam || [];
  state.bs1 = bs1 || [];
  state.portfolios = portfolios || [];
  state.initialized = true;
  rebuildAllIndexes();

  const pfIds = (portfolios || []).map(p => String(p.id));

  // Test 1: All Assets
  const reportAll = generateCapitalGainsDetailed(pfIds, ['All Assets']);
  console.log(`\n--- ALL ASSETS REPORT ---`);
  console.log(`Total Asset Classes: ${reportAll.length}`);
  reportAll.forEach(g => console.log(`Class: "${g.assetClass}" | Scrips Count: ${g.assets.length} | STCG: ₹${g.totalSTCG.toFixed(2)} | LTCG: ₹${g.totalLTCG.toFixed(2)}`));

  // Test 2: Stocks & ETFs ONLY
  const reportStocks = generateCapitalGainsDetailed(pfIds, ['Stocks & ETFs']);
  console.log(`\n--- STOCKS & ETFS ONLY REPORT ---`);
  console.log(`Total Asset Classes: ${reportStocks.length}`);
  reportStocks.forEach(g => console.log(`Class: "${g.assetClass}" | Scrips Count: ${g.assets.length} | STCG: ₹${g.totalSTCG.toFixed(2)} | LTCG: ₹${g.totalLTCG.toFixed(2)}`));
}

run().catch(console.error);
