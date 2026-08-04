import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
dotenv.config({ path: path.resolve(__dirname, '../.env') });

const supabase = createClient(
  process.env.VITE_SUPABASE_URL!,
  process.env.VITE_SUPABASE_ANON_KEY!
);

async function run() {
  console.log("=== HEALING DATABASE VOUCHER 13352 ===");
  
  // 1. Fetch max ids
  const { data: maxTrans } = await supabase.from('transc1').select('transid').order('transid', { ascending: false }).limit(1);
  const nextTransid = (maxTrans?.[0]?.transid || 0) + 1;
  console.log("Next transid:", nextTransid);

  const { data: maxTridRow } = await supabase.from('bs1').select('trid').order('trid', { ascending: false }).limit(1);
  const nextTrid = (maxTridRow?.[0]?.trid || 0) + 1;
  console.log("Next trid:", nextTrid);

  // 2. Update parent voucher acid to 31 (Saahil Shah's account)
  const { error: vchErr } = await supabase
    .from('vouchersc1')
    .update({ acid: 31 })
    .eq('vid', 13352);
  
  if (vchErr) {
    console.error("Failed to update voucher acid:", vchErr.message);
    return;
  }
  console.log("Updated voucher 13352 acid to 31.");

  // 3. Update existing child entries acid to 31
  const { error: transAcidErr } = await supabase
    .from('transc1')
    .update({ acid: 31 })
    .eq('vid', 13352);
  
  if (transAcidErr) {
    console.error("Failed to update transc1 entries acid:", transAcidErr.message);
    return;
  }
  console.log("Updated existing transc1 entries acid to 31.");

  // 4. Insert missing broker credit line (Zerodha, id 100007)
  const brokerCreditEntry = {
    transid: nextTransid,
    vid: 13352,
    dt: '2026-06-03',
    maid: 100007, // Zerodha
    cramt: 14091.79,
    dramt: 0,
    acid: 31
  };
  
  const { error: insErr } = await supabase.from('transc1').insert(brokerCreditEntry);
  if (insErr) {
    console.error("Failed to insert broker credit entry:", insErr.message);
    return;
  }
  console.log("Inserted Zerodha credit entry of 14,091.79 in transc1.");

  // 5. Insert missing bs1 transaction for NTPC (amid 104519)
  const bsRow = {
    trid: nextTrid,
    pfid: 1,
    amid: 104519,
    atyid: 50,
    sid: -1,
    cnid: -1,
    trty: 20,
    trstr: 'Buy',
    acvch: 13352,
    dt: '2026-06-03',
    qn: 35,
    purpr: 402.15,
    netpr: 402.15,
    amt: 14075.25,
    brkg: 0,
    chrgs: 0,
    narr: 'Daily trades CN (Zerodha) - Saahil Inv No: CNT-26/27-31957379'
  };

  const { error: bsErr } = await supabase.from('bs1').insert(bsRow);
  if (bsErr) {
    console.error("Failed to insert bs1 row:", bsErr.message);
    return;
  }
  console.log("Inserted bs1 transaction row for NTPC buy trade.");
  console.log("🎉 Healing completed successfully!");
}

run().catch(console.error);
