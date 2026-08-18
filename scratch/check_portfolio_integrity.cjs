const { createClient } = require('@supabase/supabase-js');
const supabase = createClient(
  'https://ajjeoijjsklgkioxqkrb.supabase.co',
  'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImFqamVvaWpqc2tsZ2tpb3hxa3JiIiwicm9sZSI6ImFub24iLCJpYXQiOjE3Nzg0OTgyODMsImV4cCI6MjA5NDA3NDI4M30.3OM0q7_9Eiz_fqt3N4c08sxYtsofb3v50v1vLxKEgvI'
);

async function check() {
  const { data: pfs } = await supabase.from('portfolio').select('*');
  console.log('Portfolios:', pfs);

  const { data: sums } = await supabase.from('sum_table').select('sid, pfolio_id, amid, qnt, amtinv').eq('pfolio_id', 1);
  const { data: bs1Rows } = await supabase.from('bs1').select('trid, pfid, amid, qn, purpr, amt, dt, trty, narr').eq('pfid', 1);

  console.log('Total BS1 rows for pfid=1:', bs1Rows?.length);
  
  const bs1Map = {};
  bs1Rows?.forEach(b => {
    if (!bs1Map[b.amid]) bs1Map[b.amid] = { qn: 0, amt: 0, count: 0, rows: [] };
    bs1Map[b.amid].qn += Number(b.qn || 0);
    bs1Map[b.amid].amt += Number(b.amt || (b.qn * b.purpr) || 0);
    bs1Map[b.amid].count++;
    bs1Map[b.amid].rows.push(b);
  });

  const { data: assets } = await supabase.from('asset_master').select('amid, name, nse_symbol, isin');
  const assetMap = {};
  assets?.forEach(a => assetMap[a.amid] = a);

  console.log('\n--- Comparing BS1 vs sum_table for pfid=1 ---');
  sums?.forEach(s => {
    const b = bs1Map[s.amid];
    const a = assetMap[s.amid];
    const bQty = b ? b.qn : 0;
    const bAmt = b ? b.amt : 0;
    if (s.qnt !== bQty || Math.abs(s.amtinv - bAmt) > 1) {
      console.log(`Mismatch amid=${s.amid} (${a?.name || a?.nse_symbol || 'unknown'}): sum_table[qnt=${s.qnt}, amt=${s.amtinv}] vs bs1[qn=${bQty}, amt=${bAmt.toFixed(2)}]`);
    }
  });

  const auroBs1 = bs1Rows?.filter(b => b.amid === 102791);
  const auroSum = sums?.find(s => s.amid === 102791);
  console.log('\nAurobindo (102791) in BS1:', auroBs1);
  console.log('Aurobindo (102791) in sum_table:', auroSum);
}

check().catch(console.error);
