const { createClient } = require('@supabase/supabase-js');
const url = 'https://ajjeoijjsklgkioxqkrb.supabase.co';
const key = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImFqamVvaWpqc2tsZ2tpb3hxa3JiIiwicm9sZSI6ImFub24iLCJpYXQiOjE3Nzg0OTgyODMsImV4cCI6MjA5NDA3NDI4M30.3OM0q7_9Eiz_fqt3N4c08sxYtsofb3v50v1vLxKEgvI';
const sb = createClient(url, key);

async function main() {
  // Get all portfolios - first see what columns exist
  const { data: ports, error: pe } = await sb.from('portfolios').select('*').limit(30);
  if (pe) { console.error('Portfolio error:', pe.message); return; }
  console.log('\n=== ALL PORTFOLIOS ===');
  ports.forEach(p => console.log(JSON.stringify(p)));

  // Find Saahil's portfolio ID
  const saahil = ports.find(p => {
    const name = JSON.stringify(p).toLowerCase();
    return name.includes('sahil') || name.includes('saahil') || name.includes('bhandari');
  });
  
  if (!saahil) {
    console.log('\n⚠️  Could not auto-find Saahil/Bhandari. Check portfolio list above.');
    return;
  }
  
  console.log('\n=== FOUND PORTFOLIO ===', JSON.stringify(saahil));
  const pfid = saahil.id || saahil.pfolio_id;

  // Get bs1 entries for this portfolio - look for AMID that might be Parag Parikh
  const { data: bs1, error: be } = await sb.from('bs1').select('trid,pfid,amid,dt,trty,qn,amt,acvch,trstr,atyid').eq('pfid', pfid).order('dt', { ascending: true });
  if (be) { console.error('bs1 error:', be.message); return; }
  console.log(`\n=== BS1 for pfid=${pfid} (${saahil.investor_name || saahil.name}) === (${bs1.length} rows)`);
  bs1.forEach(t => console.log(`  trid:${t.trid} | dt:${t.dt} | trty:${t.trty} | atyid:${t.atyid} | amid:${t.amid} | qn:${t.qn} | amt:${t.amt} | acvch:${t.acvch} | trstr:${t.trstr}`));

  // Look up SAM for bhandari-related amid  
  const amids = [...new Set(bs1.map(t => t.amid).filter(Boolean))];
  console.log('\n=== Unique AMIDs in this portfolio:', amids);
  if (amids.length > 0) {
    const { data: sam } = await sb.from('sam').select('*').in('amid', amids.slice(0, 20));
    console.log('\n=== SAM assets for those amids ===');
    (sam || []).forEach(s => console.log(JSON.stringify(s)));
  }
  
  // Also check asset_master for the Parag Parikh amid to see which portfolio it belongs to
  const ppAmid = 11603480;
  const { data: ppBs1 } = await sb.from('bs1').select('trid,pfid,amid,dt,trty,qn,trstr').eq('amid', ppAmid);
  console.log(`\n=== BS1 entries for amid=${ppAmid} (Parag Parikh) ===`);
  (ppBs1 || []).forEach(t => console.log(JSON.stringify(t)));
}
main().catch(e => console.error('ERROR:', e.message));
