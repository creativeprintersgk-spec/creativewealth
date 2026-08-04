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
  const { data: ledger } = await supabase.from('acmac1').select('*').eq('id', 101556);
  console.log('Ledger 101556:', ledger);

  const { data: allLedgers } = await supabase.from('acmac1').select('*').ilike('name', '%Bhandari%');
  console.log('Bhandari ledgers:', allLedgers);
}

run().catch(console.error);
