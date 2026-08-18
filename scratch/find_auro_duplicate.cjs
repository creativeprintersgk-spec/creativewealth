const { createClient } = require('@supabase/supabase-js');
const supabase = createClient(
  'https://ajjeoijjsklgkioxqkrb.supabase.co',
  'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImFqamVvaWpqc2tsZ2tpb3hxa3JiIiwicm9sZSI6ImFub24iLCJpYXQiOjE3Nzg0OTgyODMsImV4cCI6MjA5NDA3NDI4M30.3OM0q7_9Eiz_fqt3N4c08sxYtsofb3v50v1vLxKEgvI'
);

async function findDuplicateAurobindo() {
  // Find all assets with AUROPHARMA nse_symbol or similar name
  const { data: byNse } = await supabase
    .from('asset_master')
    .select('amid, name, nse_symbol, isin')
    .eq('nse_symbol', 'AUROPHARMA');
  console.log('By nse_symbol=AUROPHARMA:', JSON.stringify(byNse, null, 2));

  const { data: byName } = await supabase
    .from('asset_master')
    .select('amid, name, nse_symbol, isin')
    .ilike('name', '%aurobindo%');
  console.log('By name like aurobindo:', JSON.stringify(byName, null, 2));

  // Find the old Aurobindo holding in BS1 (pre-existing, not from this CN)
  const { data: bsAll } = await supabase
    .from('bs1')
    .select('trid, pfid, amid, qn, purpr, dt')
    .like('narr', '%urobindo%');  // narr containing "urobindo" - broader search
  console.log('bs1 with urobindo in narr:', JSON.stringify(bsAll, null, 2));

  // Look at pfid=3 (Saahil) - find amid where 30 qty Aurobindo came from
  const { data: saahilAuro } = await supabase
    .from('bs1')
    .select('trid, pfid, amid, qn, purpr, dt, narr')
    .eq('pfid', 3)
    .order('dt', {ascending: false})
    .limit(100);
  
  // Find any that have 30 qty (the pre-existing Aurobindo holding)
  const auro30 = (saahilAuro || []).filter(b => b.qn === 30);
  console.log('Pfid=3 rows with qn=30:', JSON.stringify(auro30, null, 2));

  // Also check sum_table for pfid=3 - look for aurobindo via asset_master
  const { data: sumSaahil } = await supabase
    .from('sum_table')
    .select('sid, pfid, amid, holdingqn, avgprice, totcost')
    .eq('pfid', 3)
    .order('amid', {ascending: true});
  console.log('\nsum_table pfid=3:', JSON.stringify(sumSaahil, null, 2));
}

findDuplicateAurobindo().catch(console.error);
