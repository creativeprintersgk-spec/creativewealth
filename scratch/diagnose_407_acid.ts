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
  const { data: trans } = await s.from('trans1').select('transid, dt, dramt, cramt, vid, acid').eq('maid', 407).gte('dt', '2025-04-01');
  console.log('Transactions for maid 407 in 25-26:');
  const grouped: Record<number, number> = {};
  trans?.forEach(t => {
    grouped[t.acid] = (grouped[t.acid] || 0) + t.cramt - t.dramt;
  });
  console.log(grouped);
}
run();
