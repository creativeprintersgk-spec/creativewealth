const { createClient } = require('@supabase/supabase-js');
const url = 'https://ajjeoijjsklgkioxqkrb.supabase.co';
const key = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImFqamVvaWpqc2tsZ2tpb3hxa3JiIiwicm9sZSI6ImFub24iLCJpYXQiOjE3Nzg0OTgyODMsImV4cCI6MjA5NDA3NDI4M30.3OM0q7_9Eiz_fqt3N4c08sxYtsofb3v50v1vLxKEgvI';
const sb = createClient(url, key);

async function run() {
  const { data: am1 } = await sb.from('asset_master').select('*').ilike('asset_name', '%Rail Vikas%');
  console.log('Rail Vikas:', am1);

  const { data: am2 } = await sb.from('asset_master').select('*').ilike('asset_name', '%Tata Inves%');
  console.log('Tata Investment:', am2);

  if (am1 && am1.length) {
    const { data: st1 } = await sb.from('sum_table').select('*').in('amid', am1.map(a => a.amid));
    console.log('sum_table Rail Vikas:', st1);
    const { data: bs1 } = await sb.from('bs1').select('trid, dt, qn, amt, trstr').in('amid', am1.map(a => a.amid)).order('dt');
    console.log('bs1 Rail Vikas:', bs1);
  }

  if (am2 && am2.length) {
    const { data: st2 } = await sb.from('sum_table').select('*').in('amid', am2.map(a => a.amid));
    console.log('sum_table Tata Investment:', st2);
    const { data: bs2 } = await sb.from('bs1').select('trid, dt, qn, amt, trstr').in('amid', am2.map(a => a.amid)).order('dt');
    console.log('bs1 Tata Investment:', bs2);
  }
}
run().catch(console.error);
