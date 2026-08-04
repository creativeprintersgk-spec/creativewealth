import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';
dotenv.config();

const supabase = createClient(process.env.VITE_SUPABASE_URL, process.env.VITE_SUPABASE_ANON_KEY);

async function checkUnbalanced() {
  const { data: transc1 } = await supabase.from('transc1').select('*').eq('acid', 30);
  const { data: trans1 } = await supabase.from('trans1').select('*').eq('acid', 30);
  
  const allEntries = [...(transc1 || []), ...(trans1 || [])];
  
  const voucherBalance = {};
  
  for (const e of allEntries) {
    if (!voucherBalance[e.vid]) {
      voucherBalance[e.vid] = 0;
    }
    const dramt = Number(e.dramt || 0);
    const cramt = Number(e.cramt || 0);
    voucherBalance[e.vid] += (dramt - cramt);
  }
  
  for (const vid in voucherBalance) {
    if (Math.abs(voucherBalance[vid]) > 0.01) {
      console.log(`Voucher ${vid} is unbalanced by ${voucherBalance[vid]} within acid 30!`);
    }
  }
  console.log('Done check.');
}

checkUnbalanced();
