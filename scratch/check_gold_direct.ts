import { createClient } from '@supabase/supabase-js';

const supabaseUrl = 'https://ajjeoijjsklgkioxqkrb.supabase.co';
const supabaseKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImFqamVvaWpqc2tsZ2tpb3hxa3JiIiwicm9sZSI6ImFub24iLCJpYXQiOjE3Nzg0OTgyODMsImV4cCI6MjA5NDA3NDI4M30.3OM0q7_9Eiz_fqt3N4c08sxYtsofb3v50v1vLxKEgvI';

const supabase = createClient(supabaseUrl, supabaseKey);

async function check() {
  const { data: acmac } = await supabase.from('acmac1').select('*');
  const goldLedgers = acmac?.filter((l: any) => l.name && l.name.toLowerCase().includes('gold'));
  console.log('=== Gold in acmac1 ===');
  console.log(goldLedgers);

  const { data: asData } = await supabase.from('as1').select('*');
  const goldAs = asData?.filter((a: any) => (a.n && a.n.toLowerCase().includes('gold')) || (a.s && a.s.toLowerCase().includes('gold')));
  console.log('=== Gold in as1 ===');
  console.log(goldAs);

  const { data: sumRows } = await supabase.from('sum_table').select('*');
  const goldSum = sumRows?.filter((s: any) => {
    const l = acmac?.find((x: any) => Number(x.exint1 || x.amid || x.id) === Number(s.amid));
    return (l?.name && l.name.toLowerCase().includes('gold')) || (s.atty === 150 || s.atty === 75);
  });
  console.log('=== Gold in sum_table ===');
  console.log(goldSum?.map((s: any) => {
    const l = acmac?.find((x: any) => Number(x.exint1 || x.amid || x.id) === Number(s.amid));
    return { amid: s.amid, ledgerName: l?.name, parent_id: l?.parent_id, atty: s.atty, qnt: s.qnt, currv: s.currv };
  }));
}

check().catch(console.error);
