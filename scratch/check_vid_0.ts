import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
dotenv.config({ path: path.resolve(__dirname, '../.env') });

const supabase = createClient(process.env.VITE_SUPABASE_URL!, process.env.VITE_SUPABASE_ANON_KEY!);

async function run() {
  const { data: vc } = await supabase.from('vouchersc1').select('*').eq('vid', 0);
  const { data: v1 } = await supabase.from('vouchers1').select('*').eq('vid', 0);
  console.log('vouchersc1 vid=0:', vc);
  console.log('vouchers1 vid=0:', v1);
}
run().catch(console.error);
