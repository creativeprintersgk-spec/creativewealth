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
  const vid = 13352;
  console.log(`Querying transc1 entries for vid = ${vid}...`);
  const { data: tc } = await supabase.from('transc1').select('*').eq('vid', vid);
  
  for (const row of tc || []) {
    // get ledger name
    const { data: ledger } = await supabase.from('acmac1').select('name').eq('id', row.maid);
    const ledgerName = ledger && ledger[0] ? ledger[0].name : 'Unknown';
    console.log(`transc1: transid=${row.transid}, maid=${row.maid} (${ledgerName}), cramt=${row.cramt}, dramt=${row.dramt}, qty=${row.quantity}, price=${row.price}`);
  }
}

run().catch(console.error);
