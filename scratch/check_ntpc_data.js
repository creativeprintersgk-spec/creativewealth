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
  console.log('--- Querying ACMAC1 (Ledger) for NTPC ---');
  const { data: ledgers } = await supabase.from('acmac1').select('*').or('id.eq.104519,name.ilike.%ntpc%');
  console.log('Ledger Matches:', ledgers);

  console.log('\n--- Querying sum_table (Holdings) for NTPC ---');
  const { data: sumRows } = await supabase.from('sum_table').select('*').eq('amid', 104519);
  console.log('SumTable Matches:', sumRows);

  console.log('\n--- Querying bs1 (Holdings Transactions) for NTPC ---');
  const { data: bs1Rows } = await supabase.from('bs1').select('*').eq('amid', 104519);
  console.log('BS1 Matches count:', bs1Rows?.length || 0);
  console.log('BS1 Matches:', bs1Rows);

  console.log('\n--- Querying trans1 for NTPC Ledger ---');
  const { data: trans1Rows } = await supabase.from('trans1').select('*').eq('maid', 104519);
  console.log('Trans1 Matches count:', trans1Rows?.length || 0);
  
  console.log('\n--- Querying transc1 for NTPC Ledger ---');
  const { data: transc1Rows } = await supabase.from('transc1').select('*').eq('maid', 104519);
  console.log('TransC1 Matches count:', transc1Rows?.length || 0);

  // If there are transactions, let's log the details of the first few
  if (transc1Rows && transc1Rows.length > 0) {
    console.log('Sample TransC1 Rows:', transc1Rows.slice(0, 5));
    const vids = transc1Rows.map(t => t.vid);
    const { data: vouchers } = await supabase.from('vouchersc1').select('*').in('vid', vids.slice(0, 5));
    console.log('Sample VouchersC1:', vouchers);
  }
  if (trans1Rows && trans1Rows.length > 0) {
    console.log('Sample Trans1 Rows:', trans1Rows.slice(0, 5));
    const vids = trans1Rows.map(t => t.vid);
    const { data: vouchers } = await supabase.from('vouchers1').select('*').in('vid', vids.slice(0, 5));
    console.log('Sample Vouchers1:', vouchers);
  }
}

run().catch(console.error);
