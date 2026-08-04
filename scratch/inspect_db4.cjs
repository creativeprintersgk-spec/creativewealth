const { createClient } = require('@supabase/supabase-js');
const url = 'https://ajjeoijjsklgkioxqkrb.supabase.co';
const key = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImFqamVvaWpqc2tsZ2tpb3hxa3JiIiwicm9sZSI6ImFub24iLCJpYXQiOjE3Nzg0OTgyODMsImV4cCI6MjA5NDA3NDI4M30.3OM0q7_9Eiz_fqt3N4c08sxYtsofb3v50v1vLxKEgvI';
const sb = createClient(url, key);

async function main() {
  // The user says "in Bhandari" they see Parag Parikh (amid=215613).
  // From portfolio list above, pfid=2 is Saahil's portfolio (Bhandari).
  // Let's see what's in sum_table for pfid=2 and what amids map to.
  
  console.log('\n=== sum_table for pfid=2 (Saahil/Bhandari) ===');
  const { data: st } = await sb.from('sum_table').select('*').eq('pfolio_id', 2);
  (st || []).forEach(s => console.log(JSON.stringify(s)));
  
  // Now check which amids exist in sum_table for pfid=2 that are MF type (atty=60,61,62)
  const mfRows = (st || []).filter(s => s.atty === 60 || s.atty === 61 || s.atty === 62);
  const mfAmids = mfRows.map(s => s.amid);
  console.log('\n=== Mutual Fund amids in pfid=2 sum_table ===', mfAmids);
  
  if (mfAmids.length > 0) {
    const { data: amNames } = await sb.from('asset_master').select('amid,name').in('amid', mfAmids.slice(0, 20));
    console.log('\n=== asset_master names for those MF amids ===');
    (amNames || []).forEach(a => console.log(`  amid:${a.amid} | ${a.name}`));
  }
  
  // Find the 2016 split entries in bs1
  const { data: splits2016 } = await sb.from('bs1').select('*').gte('dt', '2016-01-01').lte('dt', '2016-12-31');
  console.log('\n=== BS1 splits in 2016 (all portfolios) ===');
  (splits2016 || []).forEach(t => console.log(JSON.stringify(t)));
  
  // Check the sam table for pfid=2
  const { data: sam2 } = await sb.from('sam').select('*').eq('pfid', 2).limit(30);
  console.log('\n=== SAM for pfid=2 ===');
  (sam2 || []).forEach(s => console.log(JSON.stringify(s)));
}
main().catch(e => console.error('ERROR:', e.message));
