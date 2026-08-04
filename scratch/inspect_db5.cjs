const { createClient } = require('@supabase/supabase-js');
const url = 'https://ajjeoijjsklgkioxqkrb.supabase.co';
const key = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImFqamVvaWpqc2tsZ2tpb3hxa3JiIiwicm9sZSI6ImFub24iLCJpYXQiOjE3Nzg0OTgyODMsImV4cCI6MjA5NDA3NDI4M30.3OM0q7_9Eiz_fqt3N4c08sxYtsofb3v50v1vLxKEgvI';
const sb = createClient(url, key);

async function main() {
  // The user says Saahil Bhandari portfolio shows "Parag Parikh Flexi Cap Fund (11603480)" 
  // 11603480 looks like it might be a folio number, not an amid.
  // Let's search asset_master for "parag" or "flexi"
  const { data: am } = await sb.from('asset_master').select('amid,name,asset_type').or('name.ilike.%parag%,name.ilike.%flexi%').limit(10);
  console.log('\n=== asset_master: Parag/Flexi ===');
  (am || []).forEach(a => console.log(`  amid:${a.amid} | ${a.name}`));
  
  // The number 11603480 in the user's message - could be a folio ref or amid
  // Let's search bs1 for this amid
  const { data: bs11603 } = await sb.from('bs1').select('trid,pfid,amid,dt,trty,qn,trstr').eq('amid', 11603480).limit(20);
  console.log('\n=== bs1 for amid=11603480 ===');
  (bs11603 || []).forEach(t => console.log(JSON.stringify(t)));
  
  // Search sum_table for this amid
  const { data: st1603 } = await sb.from('sum_table').select('*').eq('amid', 11603480);
  console.log('\n=== sum_table for amid=11603480 ===');
  (st1603 || []).forEach(s => console.log(JSON.stringify(s)));
  
  // Now let's check what the sum_table for pfid=2 has with MF type assets (atty=60)
  const { data: stMF } = await sb.from('sum_table').select('sid,pfolio_id,amid,atty,qnt,amtinv').eq('pfolio_id', 2).in('atty', [60, 61, 62]);
  console.log('\n=== sum_table pfid=2 MF assets ===');
  (stMF || []).forEach(s => console.log(JSON.stringify(s)));
  
  // Get asset_master names for those MF amids
  if (stMF && stMF.length > 0) {
    const amids = stMF.map(s => s.amid);
    const { data: amN } = await sb.from('asset_master').select('amid,name').in('amid', amids);
    console.log('\n=== asset_master names for MF amids in pfid=2 ===');
    (amN || []).forEach(a => console.log(`  amid:${a.amid} | ${a.name}`));
  }
  
  // Find the 2016 split (trty=35 or 36) entries for pfid=2
  const { data: splits } = await sb.from('bs1').select('*').eq('pfid', 2).in('trty', [35, 36, 40, 41, 42, 43]);
  console.log('\n=== bs1 pfid=2 splits/bonus/corporate actions ===');
  (splits || []).forEach(t => console.log(JSON.stringify(t)));
  
  // Also check for duplicate trids for pfid=2 Bhandari Hosiery asset
  // First find Bhandari Hosiery in asset_master
  const { data: bhAsset } = await sb.from('asset_master').select('amid,name').ilike('name', '%bhandari%');
  console.log('\n=== asset_master: Bhandari ===');
  (bhAsset || []).forEach(a => console.log(`  amid:${a.amid} | ${a.name}`));
}
main().catch(e => console.error('ERROR:', e.message));
