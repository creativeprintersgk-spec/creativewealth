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
  const maid = 32;
  console.log(`Checking transactions in transc1 for maid=${maid}...`);
  const { data: transc1, error: err1 } = await supabase
    .from('transc1')
    .select('*')
    .eq('maid', maid);

  console.log(`transc1 entries (${transc1?.length || 0}):`, transc1);

  console.log(`Checking transactions in trans1 for maid=${maid}...`);
  const { data: trans1, error: err2 } = await supabase
    .from('trans1')
    .select('*')
    .eq('maid', maid);

  console.log(`trans1 entries (${trans1?.length || 0}):`, trans1);
}

run().catch(console.error);
