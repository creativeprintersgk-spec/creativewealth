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
  console.log('=== Pramesh Inv (pfid=4) Capital Gains Data ===\n');

  // All sells for Pramesh Inv
  const { data: sells } = await s.from('bs1')
    .select('trid, pfid, amid, atyid, trty, dt, qn, amt')
    .eq('pfid', 4)
    .in('trty', [99, 101])
    .order('dt', { ascending: false });
  
  console.log(`Total sells for Pramesh Inv: ${sells?.length}`);
  
  // Group by FY
  const fyMap: Record<string, {count: number, amids: Set<number>}> = {};
  sells?.forEach((r: any) => {
    const yr = parseInt(r.dt.substring(0, 4));
    const mo = parseInt(r.dt.substring(5, 7));
    const fy = mo >= 4 ? `${yr}-${yr+1}` : `${yr-1}-${yr}`;
    if (!fyMap[fy]) fyMap[fy] = { count: 0, amids: new Set() };
    fyMap[fy].count++;
    fyMap[fy].amids.add(r.amid);
  });
  
  console.log('\nSells by FY:');
  Object.entries(fyMap).sort().forEach(([fy, stats]) => {
    console.log(`  FY ${fy}: ${stats.count} sells, assets: ${[...stats.amids].slice(0, 5).join(', ')}`);
  });

  // Check recent sells (2026)
  const recentSells = sells?.filter((r: any) => r.dt >= '2026-04-01') || [];
  console.log('\nFY 2026-27 sells for Pramesh Inv:');
  recentSells.forEach((r: any) => {
    console.log(`  dt=${r.dt}, amid=${r.amid}, atyid=${r.atyid}, qty=${r.qn}, amt=${r.amt}`);
  });
  
  // Find buys for these amids
  const recentAmids = [...new Set(recentSells.map((r: any) => r.amid))];
  console.log('\nLooking for buy lots for amids:', recentAmids);
  
  if (recentAmids.length > 0) {
    const { data: buys } = await s.from('bs1')
      .select('trid, pfid, amid, atyid, trty, dt, qn, amt')
      .eq('pfid', 4)
      .in('amid', recentAmids as any[])
      .in('trty', [19, 20, 12, 25, 30, 35, 40])
      .order('dt', { ascending: true });
    
    console.log('\nBuy lots for these assets (Pramesh Inv):');
    buys?.forEach((r: any) => {
      console.log(`  dt=${r.dt}, amid=${r.amid}, atyid=${r.atyid}, trty=${r.trty}, qty=${r.qn}, amt=${r.amt}, price=${r.qn > 0 ? (r.amt/r.qn).toFixed(4) : 'N/A'}`);
    });
    
    // Get asset names
    const { data: assetNames } = await s.from('sam')
      .select('amid, anm')
      .in('amid', recentAmids as any[]);
    console.log('\nAsset names:');
    assetNames?.forEach((r: any) => console.log(`  amid=${r.amid}: ${r.anm}`));
  }
  
  // Also check FY 2025-26 sells 
  const fy2526Sells = sells?.filter((r: any) => r.dt >= '2025-04-01' && r.dt <= '2026-03-31') || [];
  console.log(`\nFY 2025-26 sells for Pramesh Inv: ${fy2526Sells.length}`);
  fy2526Sells.forEach((r: any) => {
    console.log(`  dt=${r.dt}, amid=${r.amid}, qty=${r.qn}, amt=${r.amt}`);
  });
}

run().catch(console.error);
