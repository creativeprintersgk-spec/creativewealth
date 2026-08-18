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
  console.log('=== DIAGNOSTIC PART 2: Portfolios & Tables ===\n');

  // 1. Check portfolios table structure
  const { data: portfolios } = await s.from('portfolios').select('*').limit(10);
  console.log('portfolios table sample:', JSON.stringify(portfolios, null, 2));

  // 2. Check acc_pflink
  const { data: pflinks } = await s.from('acc_pflink').select('*').limit(10);
  console.log('\nacc_pflink sample:', JSON.stringify(pflinks, null, 2));
  
  // 3. Check all sells by pfid
  const { data: sellsByPfid } = await s.from('bs1')
    .select('pfid')
    .in('trty', [99, 101]);
  const pfidCounts: Record<number, number> = {};
  sellsByPfid?.forEach((r: any) => {
    pfidCounts[r.pfid] = (pfidCounts[r.pfid] || 0) + 1;
  });
  console.log('\nSell counts by pfid:', pfidCounts);

  // 4. Check all sells date range by pfid
  const { data: sellStats } = await s.from('bs1')
    .select('pfid, dt')
    .in('trty', [99, 101])
    .order('dt', { ascending: true });
  if (sellStats && sellStats.length > 0) {
    const byPfid: Record<number, string[]> = {};
    sellStats.forEach((r: any) => {
      if (!byPfid[r.pfid]) byPfid[r.pfid] = [];
      byPfid[r.pfid].push(r.dt);
    });
    for (const [pfid, dates] of Object.entries(byPfid)) {
      console.log(`pfid ${pfid}: ${dates.length} sells from ${dates[0]} to ${dates[dates.length-1]}`);
    }
  }
  
  // 5. Check getStoredPortfolios equivalent - what does the app use?
  // Look for portfolio data in acmac1 or portfolios table
  const { data: acmac1Portfolios } = await s.from('acmac1')
    .select('id, acid, name, is_group, atyid')
    .eq('is_group', false)
    .limit(20);
  console.log('\nacmac1 non-group items (first 20):');
  acmac1Portfolios?.forEach((p: any) => {
    console.log(`  id=${p.id}, acid=${p.acid}, name=${p.name}, atyid=${p.atyid}`);
  });
  
  // 6. Check bs1 columns (full sample)
  const { data: bs1Sample } = await s.from('bs1').select('*').limit(1);
  if (bs1Sample && bs1Sample.length > 0) {
    console.log('\nbs1 columns:', Object.keys(bs1Sample[0]));
    console.log('bs1 sample:', JSON.stringify(bs1Sample[0], null, 2));
  }
  
  // 7. What unique pfid values exist in bs1?
  const { data: allPfids } = await s.from('bs1').select('pfid');
  const uniquePfids = [...new Set(allPfids?.map((r: any) => r.pfid) || [])].sort();
  console.log('\nAll unique pfids in bs1:', uniquePfids);
  
  // 8. What are in portfolios table?
  const { data: portTable } = await s.from('portfolios').select('*');
  console.log('\nAll portfolios:', JSON.stringify(portTable, null, 2));
}

run().catch(console.error);
