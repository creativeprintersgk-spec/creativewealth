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
  console.log('Searching transc1 and trans1 for quantity 150000 or amount 225000...');
  
  const { data: trans1 } = await supabase.from('trans1').select('*');
  const { data: transc1 } = await supabase.from('transc1').select('*');
  const { data: bs1 } = await supabase.from('bs1').select('*');
  const { data: vouchersc1 } = await supabase.from('vouchersc1').select('*');
  const { data: vouchers1 } = await supabase.from('vouchers1').select('*');

  const allEntries = [
    ...(trans1 || []).map(e => ({ ...e, table: 'trans1' })),
    ...(transc1 || []).map(e => ({ ...e, table: 'transc1' }))
  ];

  // We check bs1 first since quantity/price/amount are stored directly there for portfolio transactions
  const matchedBs = (bs1 || []).filter(b => Number(b.qn) === 150000 || Number(b.amt) === 225000);
  console.log(`Matched bs1 rows: ${matchedBs.length}`);
  matchedBs.forEach(b => {
    console.log('bs1 row:', b);
    const v1 = vouchers1?.find(v => v.vid === b.acvch);
    if (v1) console.log('Parent vouchers1:', v1);
    const vc1 = vouchersc1?.find(v => v.vid === b.acvch);
    if (vc1) console.log('Parent vouchersc1:', vc1);
  });
}

run().catch(console.error);
