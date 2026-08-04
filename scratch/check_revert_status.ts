import { supabase } from '../src/supabase';

async function main() {
  const { count: vchCount, error: vchErr } = await supabase
    .from('vouchersc1')
    .select('*', { count: 'exact', head: true })
    .ilike('narr', 'Mutual Fund CAS%');

  const { count: bsCount, error: bsErr } = await supabase
    .from('bs1')
    .select('*', { count: 'exact', head: true })
    .ilike('narr', 'Mutual Fund CAS%');

  if (vchErr) console.error("Error vouchersc1:", vchErr.message);
  else console.log(`vouchersc1 matching: ${vchCount}`);

  if (bsErr) console.error("Error bs1:", bsErr.message);
  else console.log(`bs1 matching: ${bsCount}`);
}

main().catch(console.error);
