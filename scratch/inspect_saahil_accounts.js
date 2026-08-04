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
  const ACID = 31;
  console.log(`=== Inspecting records for acid=${ACID} (Saahil Shah A/c) ===`);

  // 1. Get acmac1 entries for this acid
  const { data: accounts } = await supabase.from('acmac1').select('*').eq('acid', ACID);
  console.log(`Acmac1 contains ${accounts?.length} rows for acid=${ACID}`);
  console.log('Root groups (parent_id = 0):', accounts?.filter(a => a.is_group && a.parent_id === 0));
  console.log('Sub groups (is_group = true):', accounts?.filter(a => a.is_group && a.parent_id !== 0));
  
  // Let's print the top-level groups and ledgers
  console.log('Sample ledgers (is_group = false):', accounts?.filter(a => !a.is_group).slice(0, 10));

  // 2. Count vouchers for this acid
  const { count: vchC1Count } = await supabase.from('vouchersc1').select('*', { count: 'exact', head: true }).eq('acid', ACID);
  const { count: vch1Count } = await supabase.from('vouchers1').select('*', { count: 'exact', head: true }).eq('acid', ACID);
  console.log(`Vouchers count: vouchersc1=${vchC1Count}, vouchers1=${vch1Count}`);

  // 3. Count transaction lines for this acid
  const { count: tc1Count } = await supabase.from('transc1').select('*', { count: 'exact', head: head => {} }).eq('acid', ACID);
  const { count: t1Count } = await supabase.from('trans1').select('*', { count: 'exact', head: head => {} }).eq('acid', ACID);
  console.log(`Transactions count: transc1=${tc1Count}, trans1=${t1Count}`);
}

run().catch(console.error);
