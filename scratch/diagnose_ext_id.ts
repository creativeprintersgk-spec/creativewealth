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
  const { data: trans } = await s.from('trans1').select('transid, dt, dramt, cramt, vid, ext_id').eq('maid', 134).gte('dt', '2025-04-01');
  console.log('Kotak Bank transactions:');
  console.log(trans?.slice(0, 5));
  console.log('Number of trans with ext_id = -2:', trans?.filter(t => t.ext_id === -2).length);
  console.log('Number of trans with ext_id != -2:', trans?.filter(t => t.ext_id !== -2).length);
}
run();
