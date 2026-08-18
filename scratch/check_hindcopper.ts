import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
dotenv.config({ path: path.resolve(__dirname, '../.env') });

const s = createClient(
  process.env.VITE_SUPABASE_URL!,
  process.env.VITE_SUPABASE_ANON_KEY!
);

async function run() {
  // Find all transactions for Hindustan Copper across all tables
  const { data: sam } = await s.from('sam').select('amid, anm').ilike('anm', '%Hindustan Copper%');
  console.log('SAM Hindustan Copper:', sam);

  const amid = sam?.[0]?.amid || 101684;

  const { data: bs1 } = await s.from('bs1').select('*').eq('amid', amid);
  console.log('bs1 transactions for Hindustan Copper:', bs1);

  const { data: sumTable } = await s.from('sum_table').select('*').eq('amid', amid);
  console.log('sum_table for Hindustan Copper:', sumTable);
}
run();
