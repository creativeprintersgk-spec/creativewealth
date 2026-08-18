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
  const targetIds = [502942, 503032, 503024, 503052, 502677, 500242, 502621];

  const { data: t1 } = await s.from('transc1').select('*').in('maid', targetIds);
  console.log(`transc1 in maid targetIds count:`, t1?.length);
  if (t1 && t1.length > 0) {
    t1.forEach(row => console.log(`transid: ${row.transid} | vid: ${row.vid} | dt: ${row.dt} | maid: ${row.maid} | cramt: ${row.cramt} | dramt: ${row.dramt} | acid: ${row.acid}`));
  }
}

run().catch(console.error);
