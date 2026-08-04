const { createClient } = require('@supabase/supabase-js');
const supabase = createClient('https://ajjeoijjsklgkioxqkrb.supabase.co', 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImFqamVvaWpqc2tsZ2tpb3hxa3JiIiwicm9sZSI6ImFub24iLCJpYXQiOjE3Nzg0OTgyODMsImV4cCI6MjA5NDA3NDI4M30.3OM0q7_9Eiz_fqt3N4c08sxYtsofb3v50v1vLxKEgvI');

async function run() {
  const { data: sumTable } = await supabase.from('sum_table').select('*');
  console.log("Total sum_table:", sumTable.length);
  
  // Sort by qnt
  const topQnt = [...sumTable].sort((a, b) => b.qnt - a.qnt).slice(0, 5);
  console.log("Top Qnt:", topQnt.map(s => `${s.pfolio_id}-${s.amid}: ${s.qnt}`));

  // Sort by amtinv
  const topAmtinv = [...sumTable].sort((a, b) => b.amtinv - a.amtinv).slice(0, 5);
  console.log("Top Amtinv:", topAmtinv.map(s => `${s.pfolio_id}-${s.amid}: ${s.amtinv}`));
}
run();
