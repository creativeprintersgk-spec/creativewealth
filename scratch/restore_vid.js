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
  console.log('--- Restoring the CORRECT MProfit entry (vid: 3059) ---');
  
  const voucher = {
    vid: 3059,
    vtyp: 4,
    dt: '2025-12-30',
    narr: 'Share Contract Note,  No.:00006767911:Dec 30 2025',
    pms_trans_id: null,
    cnid: -1,
    acctlist: null,
    extid_source: null,
    pfid: null,
    atype: null,
    sid: null,
    imp_rec_id: null,
    chqno: null,
    acid: 30
  };
  
  await supabase.from('vouchers1').insert(voucher);

  const trans = [
    { transid: 22993, vid: 3059, vtyp: null, dt: '2025-12-30', maid: 502662, ext_id: null, cramt: 18799.85, dramt: 0, special_account: null, narr: null, acid: 30 },
    { transid: 22994, vid: 3059, vtyp: null, dt: '2025-12-30', maid: 465, ext_id: null, cramt: 0, dramt: 5369.85, special_account: null, narr: null, acid: 30 },
    { transid: 22995, vid: 3059, vtyp: null, dt: '2025-12-30', maid: 650, ext_id: null, cramt: 0, dramt: 13, special_account: null, narr: null, acid: 30 },
    { transid: 22996, vid: 3059, vtyp: null, dt: '2025-12-30', maid: 665, ext_id: null, cramt: 0, dramt: 0.5, special_account: null, narr: null, acid: 30 },
    { transid: 22997, vid: 3059, vtyp: null, dt: '2025-12-30', maid: 100008, ext_id: null, cramt: 0, dramt: 13416.5, special_account: null, narr: null, acid: 30 }
  ];
  
  await supabase.from('trans1').insert(trans);
  console.log('Restored vid 3059.');

  console.log('--- Deleting the INCORRECT raw MStock import duplicate (vid: 13370) ---');
  await supabase.from('transc1').delete().eq('vid', 13370);
  await supabase.from('vouchersc1').delete().eq('vid', 13370);
  console.log('Deleted vid 13370.');
}

run().catch(console.error);
