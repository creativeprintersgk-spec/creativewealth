const { createClient } = require('@supabase/supabase-js');
require('dotenv').config();
const supabase = createClient(process.env.VITE_SUPABASE_URL, process.env.VITE_SUPABASE_ANON_KEY);

async function run() {
  // Check all transc1 entries for maid=255486 (Krisha RLINFRA) across all acid
  const { data: all } = await supabase.from('transc1')
    .select('transid,vid,maid,dramt,cramt,acid,dt')
    .eq('maid', 255486)
    .order('transid');
  
  console.log('All transc1 for maid=255486 (Krisha RLINFRA):');
  let totDr = 0, totCr = 0;
  for (const l of all || []) {
    console.log('  transid=' + l.transid + ' vid=' + l.vid + ' acid=' + l.acid + ' dt=' + l.dt + ' Dr=' + l.dramt + ' Cr=' + l.cramt);
    totDr += Number(l.dramt);
    totCr += Number(l.cramt);
  }
  console.log('  NET: Dr=' + totDr.toFixed(2) + ' Cr=' + totCr.toFixed(2) + ' Balance(Dr-Cr)=' + (totDr - totCr).toFixed(2));

  // Check what the old maid=255486 balance represents per acid
  const byAcid = {};
  for (const l of all || []) {
    if (!byAcid[l.acid]) byAcid[l.acid] = {dr:0, cr:0};
    byAcid[l.acid].dr += Number(l.dramt);
    byAcid[l.acid].cr += Number(l.cramt);
  }
  for (const [acid, b] of Object.entries(byAcid)) {
    console.log('  acid=' + acid + ': Dr=' + b.dr.toFixed(2) + ' Cr=' + b.cr.toFixed(2) + ' NET=' + (b.dr - b.cr).toFixed(2));
  }
}

run().catch(console.error);
