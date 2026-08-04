require('dotenv').config({path: '.env'});
const { createClient } = require('@supabase/supabase-js');
const supabase = createClient(process.env.VITE_SUPABASE_URL, process.env.VITE_SUPABASE_ANON_KEY);
async function run() {
  const {data, error} = await supabase.from('vouchers1').select('*').eq('vchno', 'CNT-26/27-31957379');
  console.log('vouchers1:', data);
  const {data: c1} = await supabase.from('vouchersc1').select('*').eq('vchno', 'CNT-26/27-31957379');
  console.log('vouchersc1:', c1);
}
run();
