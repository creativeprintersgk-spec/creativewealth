import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
dotenv.config({ path: path.resolve(__dirname, '../.env') });

const supabase = createClient(process.env.VITE_SUPABASE_URL!, process.env.VITE_SUPABASE_ANON_KEY!);

async function run() {
  const { data: bs1Txs } = await supabase.from('bs1').select('*').eq('dt', '2025-06-18').eq('pfid', 1);
  console.log('bs1 transactions on 2025-06-18:', bs1Txs);
}
run().catch(console.error);
