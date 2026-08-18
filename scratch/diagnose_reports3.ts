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
  console.log('=== DIAGNOSTIC: Portfolio Filter & Data Issues ===\n');

  // 1. Get all portfolios with pfolio_type
  const { data: portfolios } = await s.from('portfolios').select('id, investor_name, full_name, is_group, pfolio_type, client_id').order('id');
  console.log('All portfolios:');
  portfolios?.forEach((p: any) => {
    console.log(`  id=${p.id}, type=${p.pfolio_type}, is_group=${p.is_group}, client_id=${p.client_id}, name=${p.investor_name}`);
  });

  // 2. What pfids have sells?
  const { data: sellsWithPfid } = await s.from('bs1')
    .select('pfid, dt')
    .in('trty', [99, 101])
    .order('dt', { ascending: true });
  
  const pfidSellMap: Record<number, {count: number, min: string, max: string}> = {};
  sellsWithPfid?.forEach((r: any) => {
    if (!pfidSellMap[r.pfid]) pfidSellMap[r.pfid] = { count: 0, min: r.dt, max: r.dt };
    pfidSellMap[r.pfid].count++;
    if (r.dt < pfidSellMap[r.pfid].min) pfidSellMap[r.pfid].min = r.dt;
    if (r.dt > pfidSellMap[r.pfid].max) pfidSellMap[r.pfid].max = r.dt;
  });
  
  console.log('\nPortfolios with SELL transactions:');
  for (const [pfid, stats] of Object.entries(pfidSellMap)) {
    const port = portfolios?.find((p: any) => String(p.id) === pfid);
    console.log(`  pfid=${pfid} (${port?.investor_name || 'UNKNOWN'}): ${stats.count} sells from ${stats.min} to ${stats.max}, pfolio_type=${port?.pfolio_type}`);
  }

  // 3. What pfolio_types exist?
  const typeSet = new Set(portfolios?.map((p: any) => p.pfolio_type));
  console.log('\nAll pfolio_types:', [...typeSet]);

  // 4. What client_ids exist?
  const clientSet = new Set(portfolios?.map((p: any) => p.client_id));
  console.log('All client_ids:', [...clientSet]);
  
  // 5. acc_pflink
  const { data: pflinks } = await s.from('acc_pflink').select('pfid, acid').limit(20);
  console.log('\nacc_pflink (first 20):');
  pflinks?.forEach((l: any) => {
    const port = portfolios?.find((p: any) => p.id === l.pfid);
    console.log(`  pfid=${l.pfid} (${port?.investor_name || 'UNKNOWN'}) -> acid=${l.acid}`);
  });

  // 6. What FYs have sell data?
  const fySellMap: Record<string, number> = {};
  sellsWithPfid?.forEach((r: any) => {
    if (r.dt) {
      const yr = parseInt(r.dt.substring(0, 4));
      const mo = parseInt(r.dt.substring(5, 7));
      const fy = mo >= 4 ? `${yr}-${yr+1}` : `${yr-1}-${yr}`;
      fySellMap[fy] = (fySellMap[fy] || 0) + 1;
    }
  });
  console.log('\nSells by Financial Year:');
  Object.entries(fySellMap).sort().forEach(([fy, count]) => {
    console.log(`  FY ${fy}: ${count} sells`);
  });
  
  // 7. Summary: what to show in reports for "All Portfolios" & "All FYs"
  console.log('\n=== SUMMARY ===');
  const investPorts = portfolios?.filter((p: any) => !p.is_group && p.pfolio_type !== 5) || [];
  console.log(`Investment portfolios (non-group, non-type-5): ${investPorts.length}`);
  investPorts.forEach((p: any) => {
    const sells = pfidSellMap[p.id];
    console.log(`  ${p.investor_name} (id=${p.id}, type=${p.pfolio_type}): ${sells ? `${sells.count} sells` : 'No sells'}`);
  });
}

run().catch(console.error);
