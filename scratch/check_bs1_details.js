import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
dotenv.config({ path: path.resolve(__dirname, '../.env') });

const supabase = createClient(
  process.env.VITE_SUPABASE_URL,
  process.env.VITE_SUPABASE_ANON_KEY
);

async function run() {
  const { data: sample } = await supabase.from('bs1').select('*').limit(10);
  console.log('Sample bs1 rows:', sample);
  
  const { data: count } = await supabase.from('bs1').select('*', { count: 'exact', head: true });
  console.log('Total bs1 rows in DB:', count);

  const { data: distinctPfids } = await supabase.from('bs1').select('pfid');
  const pfids = Array.from(new Set(distinctPfids?.map(r => r.pfid)));
  console.log('Distinct pfids in bs1:', pfids);
}
run().catch(console.error);
