import fs from 'fs';
import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';
dotenv.config();

const supabase = createClient(
  process.env.VITE_SUPABASE_URL!,
  process.env.VITE_SUPABASE_ANON_KEY!
);

async function run() {
  const { data: acmac1 } = await supabase.from('acmac1').select('*');
  const { data: transc1 } = await supabase.from('transc1').select('*');
  const { data: vouchersc1 } = await supabase.from('vouchersc1').select('*');
  
  const ledgers = acmac1.filter(a => !a.is_group);
  const vouchers = vouchersc1;
  const entries = transc1;
  
  // Find Kotak Bank for Saahil Shah HUF
  const saahilLedgers = ledgers.filter(l => l.name.toLowerCase().includes('kotak') && l.acid === 62); // 62 is Saahil Shah HUF from earlier
  console.log("Found Ledgers for Saahil Kotak:", saahilLedgers.map(l => ({ name: l.name, id: l.id, op_bal: l.op_bal, cr_bal: l.cr_bal, db_bal: l.db_bal })));
  
  for (const l of saahilLedgers) {
     const ledgerEntries = entries.filter(e => e.alid === l.id);
     
     // Filter by FY 25-26
     const fyVouchers = vouchers.filter(v => v.fy === '25-26');
     const fyVids = new Set(fyVouchers.map(v => v.vid));
     
     const fyEntries = ledgerEntries.filter(e => fyVids.has(e.vid));
     
     let dr = 0;
     let cr = 0;
     for (const e of fyEntries) {
        dr += Number(e.damt) || 0;
        cr += Number(e.camt) || 0;
     }
     
     const cr_bal = Number(l.cr_bal) || 0;
     const db_bal = Number(l.db_bal) || 0;
     const opening = db_bal > cr_bal ? db_bal - cr_bal : cr_bal - db_bal;
     const op_type = cr_bal > db_bal ? 'CR' : 'DR';
     
     console.log(`Ledger ${l.name} FY 25-26: Op ${op_type} ${opening}, DR ${dr}, CR ${cr}, Net: ${(op_type === 'DR' ? opening : -opening) + dr - cr}`);
  }
}
run();
