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
  console.log('1. Inserting missing NTPC ledger 503134 for acid 31 in acmac1...');
  const newLedgerRow = {
    id: 503134,
    ext_id: -1,
    parent_id: 200050, // Stocks group
    parent_ext_id: -1,
    is_group: false,
    name: 'NTPC Limited',
    disp_seqno: 100,
    flags: 65536,
    acid: 31, // Saahil
    special_type_id: 150
  };

  const { error: ledgerErr } = await supabase.from('acmac1').insert(newLedgerRow);
  if (ledgerErr) {
    console.error('Failed to insert ledger:', ledgerErr);
  } else {
    console.log('Successfully created ledger 503134 (NTPC Limited)');
  }

  console.log('\n2. Updating transc1 entry 22946 (MCX) to point to Trans. Charges (665)...');
  const { error: transErr } = await supabase
    .from('transc1')
    .update({ maid: 665 })
    .eq('transid', 22946);

  if (transErr) {
    console.error('Failed to update transc1 entry:', transErr);
  } else {
    console.log('Successfully updated transaction charges to ledger 665');
  }
}

run().catch(console.error);
