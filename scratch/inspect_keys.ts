import dotenv from 'dotenv';
dotenv.config();
import { createClient } from '@supabase/supabase-js';

const supabase = createClient(
  process.env.VITE_SUPABASE_URL!,
  process.env.VITE_SUPABASE_ANON_KEY!
);

async function run() {
  const { data: vchSample } = await supabase.from('vouchersc1').select('*').limit(1);
  console.log("vouchersc1 keys:", Object.keys(vchSample?.[0] || {}));

  const { data: bsSample } = await supabase.from('bs1').select('*').limit(1);
  console.log("bs1 keys:", Object.keys(bsSample?.[0] || {}));
}

run().catch(console.error);
