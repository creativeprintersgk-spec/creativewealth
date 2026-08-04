const { createClient } = require('@supabase/supabase-js');
const url = 'https://ajjeoijjsklgkioxqkrb.supabase.co';
const key = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImFqamVvaWpqc2tsZ2tpb3hxa3JiIiwicm9sZSI6ImFub24iLCJpYXQiOjE3Nzg0OTgyODMsImV4cCI6MjA5NDA3NDI4M30.3OM0q7_9Eiz_fqt3N4c08sxYtsofb3v50v1vLxKEgvI';
const sb = createClient(url, key);

async function main() {
  // Get all portfolios to see structure
  const { data: ports } = await sb.from('portfolios').select('*').limit(30);
  console.log('\n=== ALL PORTFOLIOS ===');
  ports.forEach(p => console.log(JSON.stringify(p)));

  // Get acc_pflink to understand account-portfolio mapping
  const { data: pflink } = await sb.from('acc_pflink').select('*').limit(30);
  console.log('\n=== ACC_PFLINK (account-portfolio link) ===');
  (pflink || []).forEach(p => console.log(JSON.stringify(p)));

  // Look for Parag Parikh in asset_master
  const { data: ppAssets } = await sb.from('asset_master').select('amid,name,asset_type').ilike('name', '%parag%').limit(10);
  console.log('\n=== asset_master: Parag Parikh ===');
  (ppAssets || []).forEach(a => console.log(JSON.stringify(a)));
  
  // Also search sum_table for any portfolio that has Parag Parikh amid
  if (ppAssets && ppAssets.length > 0) {
    const ppAmids = ppAssets.map(a => a.amid);
    console.log('\nParag Parikh AMIDs found:', ppAmids);
    const { data: sumPP } = await sb.from('sum_table').select('*').in('amid', ppAmids);
    console.log('\n=== sum_table: Parag Parikh holdings ===');
    (sumPP || []).forEach(s => console.log(JSON.stringify(s)));
    const { data: bsPP } = await sb.from('bs1').select('trid,pfid,amid,dt,trty,qn,trstr').in('amid', ppAmids);
    console.log('\n=== bs1: Parag Parikh transactions (all portfolios) ===');
    (bsPP || []).forEach(t => console.log(JSON.stringify(t)));
  }
  
  // Look for Stock Split entries (trty typically 36 or similar for split)
  const { data: splits } = await sb.from('bs1').select('trid,pfid,amid,dt,trty,qn,amt,trstr').in('trty', [36, 37, 38, 39, 47, 48, 49, 50, 51, 52]).limit(50);
  console.log('\n=== BS1: All Stock Split entries (trty 36-52) ===');
  (splits || []).forEach(t => console.log(JSON.stringify(t)));
}
main().catch(e => console.error('ERROR:', e.message));
