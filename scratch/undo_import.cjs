const { createClient } = require('@supabase/supabase-js');
require('dotenv').config();

const supabase = createClient(
  process.env.VITE_SUPABASE_URL,
  process.env.VITE_SUPABASE_ANON_KEY
);

async function run() {
  console.log('Fetching top 600 vouchers to find the batch...');

  const { data: recentVouchers, error: fetchErr } = await supabase
    .from('vouchersc1')
    .select('vid')
    .order('vid', { ascending: false })
    .limit(502);

  if (fetchErr) {
    console.error('Error fetching vouchers:', fetchErr.message);
    return;
  }

  const toDelete = recentVouchers;
  const vids = toDelete.map(v => v.vid);
  console.log(`Will delete top ${vids.length} vouchers with vids from ${vids[vids.length-1]} to ${vids[0]}`);

  // Delete transc1 first
  await supabase.from('transc1').delete().in('vid', vids);
  // Delete scnote1
  await supabase.from('scnote1').delete().in('vid', vids);
  
  // Delete vouchersc1
  const { error: delErr } = await supabase
    .from('vouchersc1')
    .delete()
    .in('vid', vids);

  if (delErr) {
    console.error('Error deleting vouchers:', delErr.message);
  } else {
    console.log(`Successfully reversed/deleted ${vids.length} vouchers!`);
  }
}

run();
