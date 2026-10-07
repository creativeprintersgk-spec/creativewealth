const { createClient } = require('@supabase/supabase-js');
const url = 'https://ajjeoijjsklgkioxqkrb.supabase.co';
const key = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImFqamVvaWpqc2tsZ2tpb3hxa3JiIiwicm9sZSI6ImFub24iLCJpYXQiOjE3Nzg0OTgyODMsImV4cCI6MjA5NDA3NDI4M30.3OM0q7_9Eiz_fqt3N4c08sxYtsofb3v50v1vLxKEgvI';
const supabase = createClient(url, key);

async function test() {
  const amids = [212667, 212947, 213291, 213314, 214155, 214252, 229587, 231285, 233212, 233931, 234227, 234701, 234799];
  const { data: priceRows } = await supabase
    .from('mprices')
    .select('amid, currp, prevp, date, row_id')
    .in('amid', amids)
    .order('date', { ascending: false })
    .order('row_id', { ascending: false });

  const buggyMap = new Map();
  priceRows.forEach(p => {
    if (p.currp && Number(p.currp) > 0) {
      buggyMap.set(Number(p.amid), { curr: Number(p.currp), date: p.date });
    }
  });

  const correctMap = new Map();
  priceRows.forEach(p => {
    if (!correctMap.has(Number(p.amid)) && p.currp && Number(p.currp) > 0) {
      correctMap.set(Number(p.amid), { curr: Number(p.currp), date: p.date });
    }
  });

  console.log('BUGGY MAP (What was displayed on screen):');
  for (let [amid, v] of buggyMap.entries()) {
    console.log(`AMID ${amid}: ${v.curr} (OVERWRITTEN FROM ${v.date})`);
  }
  console.log('\nCORRECT MAP (Latest in mprices):');
  for (let [amid, v] of correctMap.entries()) {
    console.log(`AMID ${amid}: ${v.curr} (from ${v.date})`);
  }
}
test();
