import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
dotenv.config({ path: path.resolve(__dirname, '../.env') });

const supabase = createClient(process.env.VITE_SUPABASE_URL!, process.env.VITE_SUPABASE_ANON_KEY!);

async function run() {
  const { data: t1 } = await supabase.from('trans1').select('*').eq('vid', 0).eq('acid', 32);
  const { data: tc1 } = await supabase.from('transc1').select('*').eq('vid', 0).eq('acid', 32);
  console.log('trans1 vid=0 acid=32:', t1);
  console.log('transc1 vid=0 acid=32:', tc1);
}
run().catch(console.error);
