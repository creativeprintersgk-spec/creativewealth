/**
 * Debug: Check what data is in sum_table and bs1 for the reports
 */
process.env.VITE_SUPABASE_URL = 'https://ajjeoijjsklgkioxqkrb.supabase.co';
process.env.VITE_SUPABASE_ANON_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImFqamVvaWpqc2tsZ2tpb3hxa3JiIiwicm9sZSI6ImFub24iLCJpYXQiOjE3Nzg0OTgyODMsImV4cCI6MjA5NDA3NDI4M30.3OM0q7_9Eiz_fqt3N4c08sxYtsofb3v50v1vLxKEgvI';

import { createClient } from '@supabase/supabase-js';

const supabase = createClient(
  'https://ajjeoijjsklgkioxqkrb.supabase.co',
  'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImFqamVvaWpqc2tsZ2tpb3hxa3JiIiwicm9sZSI6ImFub24iLCJpYXQiOjE3Nzg0OTgyODMsImV4cCI6MjA5NDA3NDI4M30.3OM0q7_9Eiz_fqt3N4c08sxYtsofb3v50v1vLxKEgvI'
);

async function debugReports() {
  // 1. Get portfolios
  const { data: portfolios, error: pErr } = await supabase.from('portfolios').select('id, investor_name, client_id').limit(10);
  if (pErr) { console.error('portfolios error:', pErr.message); return; }
  console.log('Portfolios:', portfolios?.map(p => `${p.id}: ${p.investor_name}`));

  if (!portfolios?.length) return;
  
  const pfIds = portfolios.map(p => p.id);
  console.log('\nPortfolio IDs:', pfIds);

  // 2. Check sum_table
  const { data: sumRows, count: sumCount } = await supabase
    .from('sum_table')
    .select('pfolio_id, amid, qnt, currv, amtinv, atty', { count: 'estimated' })
    .in('pfolio_id', pfIds.slice(0, 3))
    .limit(5);
  console.log(`\nsum_table rows (sample): ${sumCount} total`);
  sumRows?.forEach(s => console.log(`  pfid=${s.pfolio_id}, amid=${s.amid}, qnt=${s.qnt}, currv=${s.currv}, atty=${s.atty}`));

  // 3. Check bs1 sells in FY 2024-25
  const { data: sells, count: sellCount } = await supabase
    .from('bs1')
    .select('trid, dt, amid, qn, amt, atyid, trty, pfid', { count: 'estimated' })
    .in('pfid', pfIds.slice(0, 3))
    .in('trty', [99, 101])
    .gte('dt', '2024-04-01')
    .lte('dt', '2025-03-31')
    .limit(5);
  console.log(`\nbs1 sells in FY2024-25: ${sellCount} total`);
  sells?.forEach(s => console.log(`  pfid=${s.pfid}, trid=${s.trid}, dt=${s.dt}, amid=${s.amid}, atyid=${s.atyid}`));

  // 4. Check bs1 sells across ALL portfolios  
  const { count: totalSells } = await supabase
    .from('bs1')
    .select('*', { count: 'exact', head: true })
    .in('trty', [99, 101])
    .gte('dt', '2024-04-01')
    .lte('dt', '2025-03-31');
  console.log(`\nTotal sells across all portfolios in FY2024-25: ${totalSells}`);

  // 5. Check unique atyid values
  const { data: atyids } = await supabase.from('bs1').select('atyid').in('trty', [99, 101]).limit(1000);
  const uniqueAtyids = [...new Set(atyids?.map(a => a.atyid))].sort((a,b) => a-b);
  console.log('\nUnique atyid in sells:', uniqueAtyids);
}

debugReports().catch(console.error);
