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

  // 1. Fetch transc1 rows
  const { data: t1 } = await s.from('transc1').select('*').in('maid', targetMaids);
  console.log(`Found ${t1?.length} transc1 rows for target maids.`);

  const vids = Array.from(new Set(t1?.map(x => x.vid) || []));
  console.log(`VIDs involved:`, vids);

  // 2. Fetch bs1 rows for these acvch (vids)
  const { data: b1 } = await s.from('bs1').select('*').in('acvch', vids);
  console.log(`Found ${b1?.length} bs1 rows matching acvch VIDs.`);
  if (b1 && b1.length > 0) {
    b1.forEach(r => console.log(`trid: ${r.trid} | acvch: ${r.acvch} | dt: ${r.dt} | amid: ${r.amid} | trty: ${r.trty} | qn: ${r.qn} | amt: ${r.amt} | pfid: ${r.pfid}`));
  }
}

run().catch(console.error);
