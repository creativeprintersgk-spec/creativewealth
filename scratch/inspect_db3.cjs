const { createClient } = require('@supabase/supabase-js');
const url = 'https://ajjeoijjsklgkioxqkrb.supabase.co';
const key = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImFqamVvaWpqc2tsZ2tpb3hxa3JiIiwicm9sZSI6ImFub24iLCJpYXQiOjE3Nzg0OTgyODMsImV4cCI6MjA5NDA3NDI4M30.3OM0q7_9Eiz_fqt3N4c08sxYtsofb3v50v1vLxKEgvI';
const sb = createClient(url, key);

async function main() {
  // Get all portfolios
  const { data: ports } = await sb.from('portfolios').select('*');
  console.log('\n=== ALL PORTFOLIOS (id + name) ===');
  ports.forEach(p => console.log(`  pfid:${p.id} | ${p.investor_name} | pfolio_id:${p.pfolio_id || 'N/A'}`));

  // Find Bhandari portfolio
  const bhandari = ports.filter(p => JSON.stringify(p).toLowerCase().includes('bhandari') || JSON.stringify(p).toLowerCase().includes('sahil'));
  console.log('\n=== Bhandari/Saahil portfolio matches ===', JSON.stringify(bhandari, null, 2));
  
  // Look for the split entries (trty that includes splits)
  // MProfit split trty values are typically 36 (split close) and 35 (split open)
  const { data: splits } = await sb.from('bs1').select('trid,pfid,amid,dt,trty,qn,amt,trstr').in('trty', [35, 36]);
  console.log('\n=== BS1: All Split Close/Open entries (trty 35,36) ===');
  (splits || []).forEach(t => console.log(JSON.stringify(t)));
  
  // Also show sum_table entries for pfid 2 with Parag Parikh amid (215613) 
  // since the data shows pfid=2 has Parag Parikh transactions
  const { data: st2 } = await sb.from('sum_table').select('*').eq('pfolio_id', 2).in('amid', [215613, 215614]);
  console.log('\n=== sum_table: pfid=2, Parag Parikh ===');
  (st2 || []).forEach(s => console.log(JSON.stringify(s)));

  // Let's also see asset_master for amid 215613 to confirm it's Parag Parikh
  const { data: am } = await sb.from('asset_master').select('amid,name,asset_type').in('amid', [215613, 215614]);
  console.log('\n=== asset_master for Parag Parikh amid ===');
  (am || []).forEach(a => console.log(JSON.stringify(a)));

  // Now check: what is the Bhandari stock amid?
  // Search in sam first
  const { data: samBh } = await sb.from('sam').select('*').ilike('anm', '%bhandari%');
  console.log('\n=== SAM: Bhandari entries ===');
  (samBh || []).forEach(s => console.log(JSON.stringify(s)));
  
  // And in asset_master
  const { data: amBh } = await sb.from('asset_master').select('amid,name,asset_type').ilike('name', '%bhandari%');
  console.log('\n=== asset_master: Bhandari entries ===');
  (amBh || []).forEach(a => console.log(JSON.stringify(a)));
  
  // Look for split transactions in bs1 for pfid=2 specifically (which seems to be Saahil's/Bhandari's portfolio)
  const { data: bs1pf2 } = await sb.from('bs1').select('*').eq('pfid', 2).lte('dt', '2017-12-31');
  console.log('\n=== BS1 pfid=2 before 2018 (Bhandari area) ===');
  (bs1pf2 || []).forEach(t => console.log(JSON.stringify(t)));
}
main().catch(e => console.error('ERROR:', e.message));
