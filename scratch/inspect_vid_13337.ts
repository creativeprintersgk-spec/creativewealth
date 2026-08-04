import dotenv from 'dotenv';
dotenv.config();
import { createClient } from '@supabase/supabase-js';

const supabase = createClient(
  process.env.VITE_SUPABASE_URL!,
  process.env.VITE_SUPABASE_ANON_KEY!
);

async function run() {
  const { data: vch } = await supabase.from('vouchersc1').select('*').eq('vid', 13337).single();
  console.log("Voucher:", vch);

  const { data: trans } = await supabase.from('transc1').select('*').eq('vid', 13337);
  console.log("Transactions:", trans);

  const { data: bs } = await supabase.from('bs1').select('*').eq('acvch', 13337);
  console.log("BS1 rows (acvch):", bs);

  const { data: bs2 } = await supabase.from('bs1').select('*').eq('trid', 13337);
  console.log("BS1 rows (trid):", bs2);
}

run().catch(console.error);
