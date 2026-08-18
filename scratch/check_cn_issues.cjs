const { createClient } = require('@supabase/supabase-js');
const supabase = createClient(
  'https://ajjeoijjsklgkioxqkrb.supabase.co',
  'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImFqamVvaWpqc2tsZ2tpb3hxa3JiIiwicm9sZSI6ImFub24iLCJpYXQiOjE3Nzg0OTgyODMsImV4cCI6MjA5NDA3NDI4M30.3OM0q7_9Eiz_fqt3N4c08sxYtsofb3v50v1vLxKEgvI'
);

async function check() {
  // 1. Find all Aurobindo records in asset_master
  const { data: auro } = await supabase
    .from('asset_master')
    .select('amid, name, nse_symbol, isin, asset_type, currp')
    .ilike('name', '%aurobindo%');
  console.log('Aurobindo in asset_master:');
  (auro || []).forEach(a => console.log(`  amid=${a.amid} name="${a.name}" nse="${a.nse_symbol}" isin=${a.isin} currp=${a.currp}`));

  // 2. Find BS1 entries on 2026-08-11 (the contract note date)
  const { data: bs } = await supabase
    .from('bs1')
    .select('trid, amid, qn, purpr, amt, dt, narr, pfid')
    .eq('dt', '2026-08-11')
    .order('trid', { ascending: false })
    .limit(40);
  console.log('\nBS1 on 2026-08-11:');
  (bs || []).forEach(b => console.log(`  trid=${b.trid} pfid=${b.pfid} amid=${b.amid} qn=${b.qn} purpr=${b.purpr} amt=${b.amt}`));

  // 3. Check which amids have no currp (no live price)
  const amids = [...new Set((bs || []).map(b => b.amid))];
  const { data: noPrices } = await supabase
    .from('asset_master')
    .select('amid, name, nse_symbol, currp')
    .in('amid', amids)
    .is('currp', null);
  console.log('\nAssets with no currp (no live price):');
  (noPrices || []).forEach(a => console.log(`  amid=${a.amid} name="${a.name}" nse="${a.nse_symbol}"`));
}

check().catch(console.error);
