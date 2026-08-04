import { supabase } from '../src/supabase';

async function main() {
  console.log('Querying vouchersc1 sample:');
  const { data: vch, error: vchErr } = await supabase.from('vouchersc1').select('*').limit(1);
  if (vchErr) console.error('vouchersc1 error:', vchErr);
  else console.log('vouchersc1 columns:', Object.keys(vch[0] || {}));

  console.log('Querying transc1 sample:');
  const { data: trans, error: transErr } = await supabase.from('transc1').select('*').limit(1);
  if (transErr) console.error('transc1 error:', transErr);
  else console.log('transc1 columns:', Object.keys(trans[0] || {}));

  console.log('Querying bs1 sample:');
  const { data: bs1, error: bs1Err } = await supabase.from('bs1').select('*').limit(1);
  if (bs1Err) console.error('bs1 error:', bs1Err);
  else console.log('bs1 columns:', Object.keys(bs1[0] || {}));
}

main().catch(console.error);
