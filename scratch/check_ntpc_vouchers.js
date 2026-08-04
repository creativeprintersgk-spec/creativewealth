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
  console.log('--- Searching vouchers1 for NTPC ---');
  const { data: v1 } = await supabase.from('vouchers1').select('*').ilike('narr', '%ntpc%');
  console.log('vouchers1 matches:', v1);

  console.log('\n--- Searching vouchersc1 for NTPC ---');
  const { data: vc1 } = await supabase.from('vouchersc1').select('*').ilike('narr', '%ntpc%');
  console.log('vouchersc1 matches:', vc1);

  console.log('\n--- Searching transc1 for maid = 503134 ---');
  const { data: trans } = await supabase.from('transc1').select('*').eq('maid', 503134);
  console.log('transc1 matches:', trans);
  
  if (trans && trans.length > 0) {
    const vids = trans.map(t => t.vid);
    const { data: vInfo } = await supabase.from('vouchersc1').select('*').in('vid', vids);
    console.log('Associated vouchers:', vInfo);
  }
}

run().catch(console.error);
