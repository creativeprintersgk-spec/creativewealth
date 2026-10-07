const { createClient } = require('@supabase/supabase-js');
const url = 'https://ajjeoijjsklgkioxqkrb.supabase.co';
const key = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImFqamVvaWpqc2tsZ2tpb3hxa3JiIiwicm9sZSI6ImFub24iLCJpYXQiOjE3Nzg0OTgyODMsImV4cCI6MjA5NDA3NDI4M30.3OM0q7_9Eiz_fqt3N4c08sxYtsofb3v50v1vLxKEgvI';
const supabase = createClient(url, key);

async function test() {
  const { data: ports } = await supabase.from('portfolios').select('*').ilike('investor_name', '%sps%huf%');
  const pfid = ports[0]?.id;
  const { data: sumRows } = await supabase.from('sum_table').select('*').eq('pfolio_id', pfid);
  const activeHoldings = sumRows.filter(r => Number(r.qnt) > 0);
  console.log('Active holdings in SPS HUF count:', activeHoldings.length);

  const amids = activeHoldings.map(r => Number(r.amid));
  const { data: assets } = await supabase.from('asset_master').select('*').in('amid', amids);
  const { data: sam } = await supabase.from('sam').select('*').in('amid', amids);

  for (const h of activeHoldings) {
    const amid = Number(h.amid);
    const a = assets.find(x => x.amid === amid);
    const s = sam.find(x => x.amid === amid);
    console.log(`AMID: ${amid} | Qty: ${h.qnt} | Type: ${h.atty}`);
    console.log(`  AssetMaster: name="${a?.name}" bse=${a?.bse_code} amfi=${a?.amfi_code} nse=${a?.nse_symbol} isin=${a?.isin}`);
    console.log(`  SAM: anm="${s?.anm}" ex1=${s?.exint1} ex2=${s?.exint2} isr=${s?.isr} isin=${s?.extstr}`);
  }
}
test();
