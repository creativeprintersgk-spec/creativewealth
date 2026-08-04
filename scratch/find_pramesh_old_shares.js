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
  const { data: trans } = await supabase
      .from('trans1')
      .select('transid, vid, vtyp, dt, cramt, dramt, maid, acid, narr')
      .eq('acid', 30)
      .in('maid', [27, 66])
      .order('dt');
      
  console.log('OLD Shares entries for Pramesh (acid 30):');
  trans?.forEach(t => console.log(t));

  const { data: trans2 } = await supabase
      .from('trans1')
      .select('transid, vid, vtyp, dt, cramt, dramt, maid, acid, narr')
      .eq('acid', 29)
      .in('maid', [27, 66])
      .order('dt');
      
  console.log('\nOLD Shares entries for Krisha (acid 29):');
  trans2?.forEach(t => console.log(t));
}

run().catch(console.error);
