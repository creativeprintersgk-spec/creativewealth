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
  const { data: transc1 } = await supabase.from('transc1').select('*').limit(1);
  console.log('transc1 row:', transc1);

  const { data: bs1 } = await supabase.from('bs1').select('*').limit(1);
  console.log('bs1 row:', bs1);

  const { data: sum_table } = await supabase.from('sum_table').select('*').limit(1);
  console.log('sum_table row:', sum_table);
}

run().catch(console.error);
