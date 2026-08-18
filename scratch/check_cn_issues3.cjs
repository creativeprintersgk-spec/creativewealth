const { createClient } = require('@supabase/supabase-js');
const supabase = createClient(
  'https://ajjeoijjsklgkioxqkrb.supabase.co',
  'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImFqamVvaWpqc2tsZ2tpb3hxa3JiIiwicm9sZSI6ImFub24iLCJpYXQiOjE3Nzg0OTgyODMsImV4cCI6MjA5NDA3NDI4M30.3OM0q7_9Eiz_fqt3N4c08sxYtsofb3v50v1vLxKEgvI'
);

const cnAmids = [256104, 255530, 255475, 255274, 605726, 255214, 255147, 254761, 254741,
                 254647, 254634, 254501, 254204, 254140, 254119, 254076, 254030, 253975, 253886, 253791];

async function check() {
  // Get all asset master for CN amids (no currp column)
  const { data: assets, error } = await supabase
    .from('asset_master')
    .select('amid, name, nse_symbol, isin, asset_type')
    .in('amid', cnAmids);
  
  if (error) { console.error('Error:', error); return; }
  console.log(`Found ${(assets||[]).length} assets in asset_master for CN amids:`);
  (assets || []).forEach(a => {
    console.log(`  amid=${a.amid} name="${a.name}" nse="${a.nse_symbol}" isin=${a.isin}`);
  });

  const foundAmids = new Set((assets||[]).map(a => a.amid));
  const missingAmids = cnAmids.filter(id => !foundAmids.has(id));
  console.log('\nAmids MISSING from asset_master:', missingAmids);

  // Check mprices for CN amids
  const { data: prices } = await supabase.from('mprices').select('amid, closing_price, dt').in('amid', cnAmids).order('dt', {ascending: false}).limit(30);
  console.log('\nmprices for CN amids:', JSON.stringify(prices, null, 2));
  
  // Sum table
  const { data: sums } = await supabase.from('sum_table').select('sid, pfid, amid, holdingqn, avgprice, totcost').in('amid', cnAmids);
  console.log('\nsum_table rows:', JSON.stringify(sums, null, 2));
}

check().catch(console.error);
