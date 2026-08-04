const { createClient } = require('@supabase/supabase-js');
require('dotenv').config();
const supabase = createClient(process.env.VITE_SUPABASE_URL, process.env.VITE_SUPABASE_ANON_KEY);

async function run() {
  const { data } = await supabase.from('transc1').select('maid,dramt,cramt').eq('vid', 13370).order('transid');
  console.log('Repaired voucher lines:');
  let dr=0, cr=0;
  for (const l of data || []) {
    console.log('  maid=' + l.maid + ' Dr=' + l.dramt + ' Cr=' + l.cramt);
    dr += Number(l.dramt);
    cr += Number(l.cramt);
  }
  console.log('TOTAL Dr=' + dr.toFixed(2) + ' Cr=' + cr.toFixed(2) + ' BALANCED=' + (Math.abs(dr-cr)<0.01 ? 'YES' : 'NO'));

  const { data: r } = await supabase.from('acmac1').select('id,name,acid').eq('id', 503140);
  console.log('New RLINFRA ledger for acid=30:', JSON.stringify(r));

  const { data: ltcg } = await supabase.from('transc1').select('maid,dramt,cramt,vid').eq('maid', 465).eq('acid', 30).order('transid', {ascending: false}).limit(5);
  console.log('LTCG entries (maid=465, acid=30):', JSON.stringify(ltcg));
}

run().catch(console.error);
