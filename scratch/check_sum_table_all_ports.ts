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
  console.log("=== CHECK SAAHIL SHAH A/C (acid=31) HOLDINGS ===");

  const linkedPortIds = [1, 13, 11, 12, 38];

  // Fetch sum_table for these portfolios
  const { data: sumRows } = await supabase
    .from('sum_table')
    .select('sid, qnt, currv, amtinv, amid, pfolio_id, atty')
    .in('pfolio_id', linkedPortIds);

  const activeRows = sumRows?.filter((r: any) => 
    Number(r.qnt) > 0.0001 || Number(r.currv) > 0.01 || Number(r.amtinv) > 0.01
  ) || [];

  console.log(`Active rows: ${activeRows.length}`);
  
  // Sum by pfolio_id
  const portSums: Record<number, { count: number, invested: number, currv: number }> = {};
  activeRows.forEach(r => {
    if (!portSums[r.pfolio_id]) portSums[r.pfolio_id] = { count: 0, invested: 0, currv: 0 };
    portSums[r.pfolio_id].count++;
    portSums[r.pfolio_id].invested += Number(r.amtinv) || 0;
    portSums[r.pfolio_id].currv += Number(r.currv) || 0;
  });

  console.log("Summary by Portfolio:");
  Object.entries(portSums).forEach(([pid, s]) => {
    console.log(`  Portfolio ID ${pid}: active_assets_count=${s.count} invested=${s.invested.toFixed(2)} currv=${s.currv.toFixed(2)}`);
  });

  // Now, let's look up SAM names to see what is in portfolio 13 or 38!
  const activeAmids = activeRows.map((h: any) => h.amid);
  let allSamRows: any[] = [];
  for (let i = 0; i < activeAmids.length; i += 100) {
    const chunk = activeAmids.slice(i, i + 100);
    const { data } = await supabase.from('sam').select('amid, anm').in('amid', chunk);
    if (data) allSamRows = allSamRows.concat(data);
  }
  const samMap = new Map(allSamRows.map((r: any) => [r.amid, r.anm]));

  console.log("\nHoldings for Portfolio 13 (xSaahil Shah MF):");
  activeRows.filter(r => r.pfolio_id === 13).forEach(r => {
    console.log(`  - name="${samMap.get(r.amid)}" qty=${r.qnt} invested=${r.amtinv} currv=${r.currv}`);
  });

  console.log("\nHoldings for Portfolio 38 (x30-3-21PSU-SPS):");
  activeRows.filter(r => r.pfolio_id === 38).forEach(r => {
    console.log(`  - name="${samMap.get(r.amid)}" qty=${r.qnt} invested=${r.amtinv} currv=${r.currv}`);
  });

  // Calculate overall total for acid=31
  const totalInvested = activeRows.reduce((sum, r) => sum + (Number(r.amtinv) || 0), 0);
  const totalCurrv = activeRows.reduce((sum, r) => sum + (Number(r.currv) || 0), 0);
  console.log(`\nOverall Total for Saahil Shah A/c (acid=31) - Sum of all linked portfolios:`);
  console.log(`  Invested: ${totalInvested.toFixed(2)}`);
  console.log(`  Current Value: ${totalCurrv.toFixed(2)}`);
}
run();
