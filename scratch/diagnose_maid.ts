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
  const { data: acmac1Rows } = await s.from('acmac1').select('id, name, acid').eq('id', 501487);
  console.log('acmac1 id=501487:', acmac1Rows);

  const { data: maid48 } = await s.from('acmac1').select('id, name, acid').eq('id', 48);
  console.log('acmac1 id=48:', maid48);

  const { data: transc1Rows } = await s.from('transc1').select('transid, maid, acid').eq('maid', 501487);
  console.log('transc1 maid=501487:', transc1Rows);
  
  // also let's look at the actual transc1 entries for acid=29 (Unnati Shah A/c)
  const { data: unnatiTrans } = await s.from('transc1').select('transid, maid, acid, dt').eq('acid', 29).limit(5);
  console.log('\ntransc1 for acid=29:', unnatiTrans);
  
  // and trans1 entries for acid=29
  const { data: unnatiTrans1 } = await s.from('trans1').select('transid, maid, acid, dt').eq('acid', 29).limit(5);
  console.log('\ntrans1 for acid=29:', unnatiTrans1);

  // and check how many transactions Unnati has in transc1 vs trans1
  const { count: c1 } = await s.from('transc1').select('*', { count: 'exact', head: true }).eq('acid', 29);
  const { count: t1 } = await s.from('trans1').select('*', { count: 'exact', head: true }).eq('acid', 29);
  console.log(`\nUnnati trans count - transc1: ${c1}, trans1: ${t1}`);
}
run();
