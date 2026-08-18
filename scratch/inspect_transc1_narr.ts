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
  const targetMaids = [502942, 503032, 503024, 503052, 502677, 500242, 502621];

  const { data: t1 } = await s.from('transc1').select('*').in('maid', targetMaids);
  const { data: acmac1Rows } = await s.from('acmac1').select('id, name');
  const nameMap = new Map(acmac1Rows?.map(r => [r.id, r.name]));

  console.log(`--- transc1 rows for target stock ledgers ---`);
  t1?.forEach(r => {
    const scripName = nameMap.get(r.maid) || `ID ${r.maid}`;
    console.log(`vid: ${r.vid} | dt: ${r.dt} | acid: ${r.acid} | scrip: ${scripName.padEnd(25)} | dramt: ${r.dramt.toString().padStart(8)} | cramt: ${r.cramt.toString().padStart(8)} | narr: ${r.narr}`);
  });
}

run().catch(console.error);
