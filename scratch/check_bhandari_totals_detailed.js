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
  const bhandariLedgerId = 500589;

  console.log(`Fetching all transc1 and trans1 entries for maid = ${bhandariLedgerId}...`);
  const { data: trans1 } = await supabase.from('trans1').select('*').eq('maid', bhandariLedgerId);
  const { data: transc1 } = await supabase.from('transc1').select('*').eq('maid', bhandariLedgerId);
  const { data: vouchers1 } = await supabase.from('vouchers1').select('*');
  const { data: vouchersc1 } = await supabase.from('vouchersc1').select('*');

  const allVouchers = [
    ...(vouchers1 || []).map(v => ({ ...v, _src: 'v1' })),
    ...(vouchersc1 || []).map(v => ({ ...v, _src: 'vc1' }))
  ];

  console.log(`\n=== trans1 entries (${trans1?.length || 0}) ===`);
  (trans1 || []).forEach(e => {
    const v = allVouchers.find(v => v.vid === e.vid && v._src === 'v1');
    console.log(`  transid: ${e.transid}, vid: ${e.vid}, dr: ${e.dramt}, cr: ${e.cramt}, dt: ${e.dt}, acid: ${e.acid}, narr: "${v?.narr || ''}"`);
  });

  console.log(`\n=== transc1 entries (${transc1?.length || 0}) ===`);
  (transc1 || []).forEach(e => {
    const v = allVouchers.find(v => v.vid === e.vid && v._src === 'vc1');
    console.log(`  transid: ${e.transid}, vid: ${e.vid}, dr: ${e.dramt}, cr: ${e.cramt}, dt: ${e.dt}, acid: ${e.acid}, narr: "${v?.narr || ''}"`);
  });
}

run().catch(console.error);
