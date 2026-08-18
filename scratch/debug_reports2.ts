process.env.VITE_SUPABASE_URL = 'https://ajjeoijjsklgkioxqkrb.supabase.co';
import { createClient } from '@supabase/supabase-js';
const supabase = createClient(
  'https://ajjeoijjsklgkioxqkrb.supabase.co',
  'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImFqamVvaWpqc2tsZ2tpb3hxa3JiIiwicm9sZSI6ImFub24iLCJpYXQiOjE3Nzg0OTgyODMsImV4cCI6MjA5NDA3NDI4M30.3OM0q7_9Eiz_fqt3N4c08sxYtsofb3v50v1vLxKEgvI'
);
async function run() {
  // sum_table with qnt > 0
  const { data: active } = await supabase
    .from('sum_table')
    .select('pfolio_id, amid, qnt, currv, amtinv, atty')
    .gt('qnt', 0)
    .limit(10);
  console.log('sum_table rows with qnt > 0:', active?.length);
  active?.forEach(s => console.log(`  pfid=${s.pfolio_id}, amid=${s.amid}, qnt=${s.qnt}, currv=${s.currv}, atty=${s.atty}`));

  // Check what atty values exist  
  const { data: attyRows } = await supabase.from('sum_table').select('atty').gt('qnt', 0).limit(2000);
  const uniqueAtty = [...new Set(attyRows?.map(a => a.atty))].sort((a,b) => a-b);
  console.log('\nUnique atty values in sum_table (qnt>0):', uniqueAtty);

  // Check sam table for asset names
  const { data: samSample } = await supabase.from('sam').select('amid, anm').limit(5);
  console.log('\nSAM sample:', samSample);

  // Check what pfids are in sum_table qnt>0
  const { data: pfids } = await supabase.from('sum_table').select('pfolio_id').gt('qnt', 0).limit(2000);
  const uniquePfids = [...new Set(pfids?.map(p => p.pfolio_id))].sort((a,b) => a-b);
  console.log('\nUnique pfolio_ids in sum_table (qnt>0):', uniquePfids);
}
run().catch(console.error);
