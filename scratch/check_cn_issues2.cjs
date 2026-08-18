const { createClient } = require('@supabase/supabase-js');
const supabase = createClient(
  'https://ajjeoijjsklgkioxqkrb.supabase.co',
  'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImFqamVvaWpqc2tsZ2tpb3hxa3JiIiwicm9sZSI6ImFub24iLCJpYXQiOjE3Nzg0OTgyODMsImV4cCI6MjA5NDA3NDI4M30.3OM0q7_9Eiz_fqt3N4c08sxYtsofb3v50v1vLxKEgvI'
);

async function check() {
  // The amids imported from the CN
  const cnAmids = [256104, 255530, 255475, 255274, 605726, 255214, 255147, 254761, 254741,
                   254647, 254634, 254501, 254204, 254140, 254119, 254076, 254030, 253975, 253886, 253791];

  const { data: assets } = await supabase
    .from('asset_master')
    .select('amid, name, nse_symbol, isin, currp, asset_type')
    .in('amid', cnAmids);
  
  console.log('Assets imported from CN (with prices):');
  (assets || []).forEach(a => console.log(`  amid=${a.amid} name="${a.name}" nse="${a.nse_symbol}" isin=${a.isin} currp=${a.currp}`));

  // Also find what amid 605726 is (NXST - possibly the auto-created one)
  const { data: nxst } = await supabase.from('asset_master').select('*').eq('amid', 605726);
  console.log('\namid=605726:', JSON.stringify(nxst, null, 2));

  // Now find Aurobindo - the existing one
  const { data: existingAuro } = await supabase.from('asset_master').select('amid, name, nse_symbol, isin, currp').ilike('name', '%auro%');
  console.log('\nAll Auro* in asset_master:', JSON.stringify(existingAuro, null, 2));
  
  // Check what pfid=3 (Saahil Inv) shows in bs1 for AUROPHARMA
  const { data: auroBs } = await supabase.from('bs1').select('*').in('amid', (existingAuro||[]).map(a=>a.amid));
  console.log('\nAurobindo bs1 rows:', JSON.stringify(auroBs, null, 2));
}

check().catch(console.error);
