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
  const { data: sumtable } = await supabase.from('sum_table').select('*').eq('pfid', 1).eq('tdt', '2026-06-05');
  console.log("Sum Table (Trades on 2026-06-05):");
  console.table(sumtable);

  const { data: scnote } = await supabase.from('scnote1').select('*').eq('dt', '2026-06-05');
  console.log("Contract Notes on 2026-06-05:");
  console.table(scnote);
}

run().catch(console.error);
