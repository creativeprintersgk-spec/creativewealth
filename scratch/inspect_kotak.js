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
  console.log('Inspecting Kotak Bank ledgers...');
  
  const { data: ledgers, error } = await supabase
    .from('acmac1')
    .select('*')
    .ilike('name', '%kotak%');

  if (error) {
    console.error('Error fetching acmac1:', error);
  } else {
    console.log('Kotak Bank accounts in acmac1:', ledgers);
  }

  // Let's also check all vouchers and entries for these ledger IDs
  if (ledgers && ledgers.length > 0) {
    const ids = ledgers.map(l => l.id);
    const { data: trans } = await supabase
      .from('transc1')
      .select('*')
      .in('maid', ids)
      .limit(10);
    console.log('Recent transactions for Kotak Bank in transc1:', trans);
  }
}

run().catch(console.error);
