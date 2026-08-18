import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
dotenv.config({ path: path.resolve(__dirname, '../.env') });

const s = createClient(
  process.env.VITE_SUPABASE_URL!,
  process.env.VITE_SUPABASE_ANON_KEY!
);

async function run() {
  console.log('=== Recent Sells (last 30 by date) ===\n');
  
  // Get sells ordered by date DESC
  const { data: recentSells } = await s.from('bs1')
    .select('trid, pfid, amid, atyid, trty, dt, qn, amt')
    .in('trty', [99, 101])
    .order('dt', { ascending: false })
    .limit(30);
  
  console.log('Most recent 30 sells:');
  recentSells?.forEach((r: any) => {
    console.log(`  dt=${r.dt}, pfid=${r.pfid}, amid=${r.amid}, atyid=${r.atyid}, trty=${r.trty}, qty=${r.qn}, amt=${r.amt}`);
  });
  
  // Get all sells with counts by year
  const { data: allSells } = await s.from('bs1')
    .select('dt, pfid, atyid, trty')
    .in('trty', [99, 101]);
  
  const yearMap: Record<number, number> = {};
  allSells?.forEach((r: any) => {
    const yr = parseInt(r.dt?.substring(0, 4) || '0');
    yearMap[yr] = (yearMap[yr] || 0) + 1;
  });
  
  console.log('\nSells by calendar year:');
  Object.entries(yearMap).sort().forEach(([yr, cnt]) => {
    console.log(`  ${yr}: ${cnt}`);
  });

  // Get all buys with counts by year 
  const { data: allBuys } = await s.from('bs1')
    .select('dt, pfid, atyid, trty')
    .in('trty', [19, 20, 12, 25, 30, 35, 40]);
  
  const buyYearMap: Record<number, number> = {};
  allBuys?.forEach((r: any) => {
    const yr = parseInt(r.dt?.substring(0, 4) || '0');
    buyYearMap[yr] = (buyYearMap[yr] || 0) + 1;
  });
  
  console.log('\nBuys by calendar year:');
  Object.entries(buyYearMap).sort().forEach(([yr, cnt]) => {
    console.log(`  ${yr}: ${cnt}`);
  });
  
  // Check sum_table for recent data
  const { data: sumData } = await s.from('sum_table').select('pfid, amid, qty, mktval, dt').order('dt', { ascending: false }).limit(5);
  console.log('\nsum_table most recent:');
  sumData?.forEach((r: any) => {
    console.log(`  pfid=${r.pfid}, amid=${r.amid}, qty=${r.qty}, mktval=${r.mktval}, dt=${r.dt}`);
  });
  
  // What's in bs1 with recent dates?
  const { data: recentBs1 } = await s.from('bs1')
    .select('trid, pfid, amid, atyid, trty, dt, qn, amt')
    .gte('dt', '2020-01-01')
    .order('dt', { ascending: false })
    .limit(20);
  
  console.log('\nAll bs1 records since 2020:');
  recentBs1?.forEach((r: any) => {
    console.log(`  dt=${r.dt}, pfid=${r.pfid}, atyid=${r.atyid}, trty=${r.trty}, qn=${r.qn}, amt=${r.amt}`);
  });
}

run().catch(console.error);
