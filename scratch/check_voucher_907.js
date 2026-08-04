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
  console.log('Querying voucher headers and transaction lines for vid = 907...');
  
  const { data: v1 } = await supabase.from('vouchers1').select('*').eq('vid', 907);
  console.log('vouchers1 match:', v1);

  const { data: vc1 } = await supabase.from('vouchersc1').select('*').eq('vid', 907);
  console.log('vouchersc1 match:', vc1);

  const { data: t1 } = await supabase.from('trans1').select('*').eq('vid', 907);
  console.log('trans1 matches:', t1);

  const { data: tc1 } = await supabase.from('transc1').select('*').eq('vid', 907);
  console.log('transc1 matches:', tc1);
}

run().catch(console.error);
