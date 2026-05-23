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
  const { data: trans } = await s.from('trans1').select('*').eq('cramt', 37325.15);
  const { data: transc } = await s.from('transc1').select('*').eq('cramt', 37325.15);
  console.log('trans1:', trans);
  console.log('transc1:', transc);
}
run();
