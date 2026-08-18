const { createClient } = require('@supabase/supabase-js');
const supabase = createClient(
  'https://ajjeoijjsklgkioxqkrb.supabase.co',
  'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImFqamVvaWpqc2tsZ2tpb3hxa3JiIiwicm9sZSI6ImFub24iLCJpYXQiOjE3Nzg0OTgyODMsImV4cCI6MjA5NDA3NDI4M30.3OM0q7_9Eiz_fqt3N4c08sxYtsofb3v50v1vLxKEgvI'
);

async function diagnoseAll() {
  // 1. Check bs1 for amid=102791 (Aurobindo) in pfid=1 (Saahil Inv)
  const { data: bsAuro } = await supabase
    .from('bs1')
    .select('trid, pfid, amid, qn, purpr, amt, dt, trty, narr')
    .eq('amid', 102791)
    .eq('pfid', 1)
    .order('dt', { ascending: true });
  console.log('BS1 for Aurobindo (amid=102791) in pfid=1 (Saahil Inv):');
  (bsAuro || []).forEach(b => console.log(`  trid=${b.trid} qn=${b.qn} purpr=${b.purpr} amt=${b.amt} dt=${b.dt} trty=${b.trty}`));
  const totalQty = (bsAuro || []).reduce((s, b) => s + (b.qn || 0), 0);
  console.log(`  TOTAL QTY in bs1: ${totalQty}`);

  // 2. Check sum_table for amid=102791 pfid=1
  const { data: sumAuro } = await supabase
    .from('sum_table')
    .select('*')
    .eq('amid', 102791);
  console.log('\nsum_table for Aurobindo (amid=102791):');
  console.log(JSON.stringify(sumAuro, null, 2));

  // 3. Check ALL CN stocks sum_table for pfid=1
  const cnAmids = [253791, 253886, 102791, 254030, 254076, 254119, 254140, 254204,
                   254501, 254634, 254647, 254741, 254761, 255147, 255214, 255274,
                   255475, 255530, 256104, 605726];
  const { data: sumAll } = await supabase
    .from('sum_table')
    .select('sid, pfid, amid, holdingqn, avgprice, totcost')
    .in('amid', cnAmids);
  console.log('\nsum_table for all CN stocks:');
  console.log(JSON.stringify(sumAll, null, 2));

  // 4. Check mprices for CN stocks (live prices)
  const { data: prices } = await supabase
    .from('mprices')
    .select('amid, closing_price, dt')
    .in('amid', cnAmids)
    .order('dt', { ascending: false })
    .limit(30);
  console.log('\nmprices for CN stocks:', JSON.stringify(prices, null, 2));

  // 5. How does syncLivePrices work — what table/column stores the current price?
  const { data: amRow } = await supabase
    .from('asset_master')
    .select('*')
    .eq('amid', 102791)
    .limit(1);
  console.log('\nasset_master for Aurobindo:', JSON.stringify(amRow, null, 2));
}

diagnoseAll().catch(console.error);
