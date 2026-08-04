require('dotenv').config({path: '.env'});
const { createClient } = require('@supabase/supabase-js');
const supabase = createClient(process.env.VITE_SUPABASE_URL, process.env.VITE_SUPABASE_ANON_KEY);

async function run() {
  const {data: vc1} = await supabase.from('vouchersc1').select('vid').ilike('narr', '%CNT-26/27-31957379%');
  const vids = vc1.map(v => v.vid);
  if(vids.length){
    for (const id of vids) {
      await supabase.from('bs1').delete().or(`acvch.eq.${id},trid.eq.${id}`);
    }
    await supabase.from('transc1').delete().in('vid', vids);
    await supabase.from('vouchersc1').delete().in('vid', vids);
    console.log('Wiped orphaned vouchers:', vids);
  } else {
    console.log('No orphaned vouchers found.');
  }
}
run();
