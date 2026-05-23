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
  const { data: trans1 } = await s.from('trans1').select('*').eq('maid', 145); // Brokerage Income for acid 62
  const yearend = trans1?.filter(t => t.dt.endsWith('03-31') && t.dramt > 0);
  console.log('Year end transfers for Brokerage Income:', yearend);
}
run();
