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
  console.log('=== DIAGNOSTIC: Capital Gains Data ===\n');

  // 1. Check bs1 sell transactions
  const { data: sells, error: sellErr } = await s.from('bs1')
    .select('trid, pfid, amid, atyid, trty, dt, qn, amt, brkg')
    .in('trty', [99, 101])
    .order('dt', { ascending: false })
    .limit(20);
  
  console.log('SELL transactions (trty 99/101):', sells?.length, 'found');
  if (sells && sells.length > 0) {
    console.log('Sample sell:', JSON.stringify(sells[0], null, 2));
    // Show unique atyid values in sells
    const atyids = [...new Set(sells.map((s: any) => s.atyid))];
    console.log('Unique atyid in sells:', atyids);
    const pfids = [...new Set(sells.map((s: any) => s.pfid))];
    console.log('Unique pfid in sells:', pfids);
  }
  
  // 2. Check bs1 buy transactions  
  const { data: buys } = await s.from('bs1')
    .select('trid, pfid, amid, atyid, trty, dt, qn, amt')
    .in('trty', [19, 20, 12, 25, 30, 35, 40])
    .limit(5);
  console.log('\nBUY transactions found:', buys?.length);
  if (buys && buys.length > 0) {
    console.log('Sample buy:', JSON.stringify(buys[0], null, 2));
  }

  // 3. Check portfolios
  const { data: portfolios } = await s.from('acmac1')
    .select('id, acid, name, is_group')
    .eq('is_group', false)
    .limit(5);
  console.log('\nPortfolios (acmac1 non-group):', portfolios?.length);
  if (portfolios && portfolios.length > 0) {
    console.log('Sample portfolios:', JSON.stringify(portfolios.slice(0, 3), null, 2));
  }

  // 4. Check accPflink (portfolio-account link)
  const { data: pflinks } = await s.from('accPflink')
    .select('pfid, acid')
    .limit(5);
  console.log('\naccPflink found:', pflinks?.length);
  if (pflinks && pflinks.length > 0) {
    console.log('Sample pflink:', JSON.stringify(pflinks.slice(0, 3), null, 2));
  }

  // 5. Check actual table names available
  const tableNames = ['bs1', 'acmac1', 'accPflink', 'acc_pflink', 'mprices', 'sam', 'portfolios', 'acvch'];
  for (const tbl of tableNames) {
    const { data, error } = await s.from(tbl).select('*').limit(1);
    if (error) {
      console.log(`Table '${tbl}': ERROR - ${error.message}`);
    } else {
      console.log(`Table '${tbl}': OK (${data?.length} rows sample)`);
    }
  }

  // 6. Check what pfid values exist in bs1 sells and if they match portfolios
  if (sells && sells.length > 0) {
    const pfIds = [...new Set(sells.map((s: any) => s.pfid))];
    console.log('\n=== Portfolio ID analysis ===');
    console.log('pfids in sells:', pfIds);
    
    // Check if these pfids exist in some portfolio table
    const { data: pfData } = await s.from('acmac1')
      .select('id, acid, name, is_group')
      .in('id', pfIds as any[]);
    console.log('Matching acmac1 records:', pfData?.length, JSON.stringify(pfData, null, 2));
  }

  // 7. Sample sell with date range typical for a report
  const { data: recentSells } = await s.from('bs1')
    .select('trid, pfid, amid, atyid, trty, dt, qn, amt')
    .in('trty', [99, 101])
    .gte('dt', '2024-04-01')
    .lte('dt', '2025-03-31')
    .limit(5);
  console.log('\nSells in FY 2024-25:', recentSells?.length);
  
  const { data: allSells } = await s.from('bs1')
    .select('trid, pfid, amid, atyid, trty, dt, qn, amt')
    .in('trty', [99, 101]);
  console.log('Total sells (all time):', allSells?.length);
  if (allSells && allSells.length > 0) {
    const dates = allSells.map((s: any) => s.dt).sort();
    console.log('Date range:', dates[0], 'to', dates[dates.length - 1]);
  }
}

run().catch(console.error);
