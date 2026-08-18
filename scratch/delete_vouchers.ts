import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';
dotenv.config({ path: '.env' });
const s = createClient(process.env.VITE_SUPABASE_URL!, process.env.VITE_SUPABASE_ANON_KEY!);

async function run() {
  const { data: t1 } = await s.from('trans1').select('transid').eq('vid', 0);
  console.log('Remaining vid=0:', t1?.length);
}
run();
