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
  const { data: trans1 } = await s.from('trans1').select('*').eq('maid', 56).eq('acid', 30).eq('vid', 0);
  const { data: transc1 } = await s.from('transc1').select('*').eq('maid', 56).eq('acid', 30).eq('vid', 0);
  console.log('trans1 vid 0:', trans1);
  console.log('transc1 vid 0:', transc1);
}
run();
