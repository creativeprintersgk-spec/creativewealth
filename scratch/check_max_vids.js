import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
dotenv.config({ path: path.resolve(__dirname, '../.env') });

const supabase = createClient(
  process.env.VITE_SUPABASE_URL,
  process.env.VITE_SUPABASE_ANON_KEY
);

async function run() {
  console.log("=== CHECKING MAX VIDS IN DATABASE ===");

  const { data: maxVc1 } = await supabase.from('vouchersc1').select('vid').order('vid', { ascending: false }).limit(1);
  const { data: countVc1 } = await supabase.from('vouchersc1').select('*', { count: 'exact', head: true });
  console.log('vouchersc1: max vid =', maxVc1?.[0]?.vid, 'count =', countVc1);

  const { data: maxV1 } = await supabase.from('vouchers1').select('vid').order('vid', { ascending: false }).limit(1);
  const { data: countV1 } = await supabase.from('vouchers1').select('*', { count: 'exact', head: true });
  console.log('vouchers1: max vid =', maxV1?.[0]?.vid, 'count =', countV1);

  // Check how nextVid() would calculate in memory if safeFetch fetched only 1000 items due to pagination limit
  const { data: sampleVc1 } = await supabase.from('vouchersc1').select('vid');
  console.log('Sample vouchersc1 length fetched without order/range limit:', sampleVc1?.length);
}

run().catch(console.error);
