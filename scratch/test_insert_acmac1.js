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
  const newLedgerRow = {
    id: 999999,
    ext_id: -1,
    parent_id: 200050,
    parent_ext_id: -1,
    is_group: false,
    name: 'TEST DYNAMIC LEDGER',
    disp_seqno: 100,
    flags: 65536,
    acid: 30,
    special_type_id: 150
  };

  console.log('Testing insert with corrected fields...');
  const { error } = await supabase.from('acmac1').insert(newLedgerRow);
  if (error) {
    console.error('Insert failed with error:', error);
  } else {
    console.log('Insert succeeded! Cleaning up...');
    await supabase.from('acmac1').delete().eq('id', 999999);
  }
}

run().catch(console.error);
