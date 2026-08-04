import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
dotenv.config({ path: path.resolve(__dirname, '../.env') });

const supabase = createClient(
  process.env.VITE_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.VITE_SUPABASE_ANON_KEY
);

async function run() {
  const vids = [10043, 10426, 10427];
  
  const { data: trans } = await supabase
      .from('trans1')
      .select('transid, vid, vtyp, dt, cramt, dramt, maid, acid, narr')
      .in('vid', vids);
      
  console.log('trans1 entries for these vouchers:');
  trans?.forEach(t => console.log(t));
  
  const { data: acvch } = await supabase
      .from('acvch1') // Might be acvch1 or acvch
      .select('*')
      .in('vid', vids);
      
  console.log('\nacvch1 entries:', acvch);

  // Search Pramesh for similar dates or similar amounts?
  // Let's just pull Pramesh ledger (maid 30) for 2019-04-01 and 2019-04-21
  const { data: pTrans } = await supabase
      .from('trans1')
      .select('transid, vid, vtyp, dt, cramt, dramt, maid, acid, narr')
      .eq('maid', 30)
      .in('dt', ['2019-04-01', '2019-04-21']);
      
  console.log('\nPramesh maid=30 entries for 2019-04-01 / 21:');
  pTrans?.forEach(t => console.log(t));
}

run().catch(console.error);
