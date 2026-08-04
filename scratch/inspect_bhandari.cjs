const { createClient } = require('@supabase/supabase-js');
const url = 'https://ajjeoijjsklgkioxqkrb.supabase.co';
const key = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImFqamVvaWpqc2tsZ2tpb3hxa3JiIiwicm9sZSI6ImFub24iLCJpYXQiOjE3Nzg0OTgyODMsImV4cCI6MjA5NDA3NDI4M30.3OM0q7_9Eiz_fqt3N4c08sxYtsofb3v50v1vLxKEgvI';
const sb = createClient(url, key);

async function main() {
  const BHANDARI_AMID = 101556;
  
  // All bs1 entries for Bhandari across ALL portfolios
  const { data: bh } = await sb.from('bs1').select('*').in('amid', [101556, 254067, 122734, 123119]);
  console.log('\n=== ALL BS1 entries for Bhandari Hosiery (all amids, all portfolios) ===');
  (bh || []).forEach(t => console.log(`pfid:${t.pfid} | trid:${t.trid} | dt:${t.dt} | trty:${t.trty} | trstr:${t.trstr} | qn:${t.qn} | amt:${t.amt} | acvch:${t.acvch} | atyid:${t.atyid}`));
  
  // Sum table for bhandari
  const { data: stBh } = await sb.from('sum_table').select('*').in('amid', [101556, 254067]);
  console.log('\n=== sum_table for Bhandari Hosiery ===');
  (stBh || []).forEach(s => console.log(JSON.stringify(s)));
  
  // Now find the Parag Parikh entry in pfid=2
  // amid=215613 has pfid=2 entries (found above). Let's check sum_table for it
  const { data: stPP } = await sb.from('sum_table').select('*').eq('amid', 215613).eq('pfolio_id', 2);
  console.log('\n=== sum_table: Parag Parikh (215613) in pfid=2 ===');
  (stPP || []).forEach(s => console.log(JSON.stringify(s)));
  
  // Check what "11603480" means - search accinfo field in sum_table
  const { data: folioSearch } = await sb.from('sum_table').select('*').like('accinfo', '%11603480%').limit(5);
  console.log('\n=== sum_table: accinfo contains 11603480 ===');
  (folioSearch || []).forEach(s => console.log(JSON.stringify(s)));
  
  // Search refno field too
  const { data: refSearch } = await sb.from('sum_table').select('*').eq('refno', '11603480').limit(5);
  console.log('\n=== sum_table: refno=11603480 ===');
  (refSearch || []).forEach(s => console.log(JSON.stringify(s)));

  // The user says split close in 25-2-16. Let's look for trty=35 or 36 near that date for pfid=2
  const { data: split2016 } = await sb.from('bs1').select('*').eq('pfid', 2).gte('dt', '2016-02-01').lte('dt', '2016-03-01');
  console.log('\n=== BS1 pfid=2 around Feb 2016 ===');
  (split2016 || []).forEach(t => console.log(`trid:${t.trid} | dt:${t.dt} | trty:${t.trty} | trstr:${t.trstr} | amid:${t.amid} | qn:${t.qn}`));
  
  // Specifically for Bhandari amid=101556 - all transactions
  const { data: bhAll } = await sb.from('bs1').select('*').eq('pfid', 2).eq('amid', 101556);
  console.log('\n=== BS1 pfid=2, amid=101556 (Bhandari) ALL ===');
  (bhAll || []).forEach(t => console.log(`trid:${t.trid} | dt:${t.dt} | trty:${t.trty} | trstr:${t.trstr} | qn:${t.qn} | amt:${t.amt}`));
}
main().catch(e => console.error('ERROR:', e.message));
