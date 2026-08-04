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
  console.log("=== TESTING PMS INSERT TRIGGER ===");
  const testVid = 999999;
  
  // Clean up if previous test run failed
  await supabase.from('transc1').delete().eq('vid', testVid);
  await supabase.from('vouchersc1').delete().eq('vid', testVid);

  const { data: initialBs1, error: initErr } = await supabase
    .from('bs1')
    .select('*')
    .eq('acvch', `c_${testVid}`);
  
  console.log("Initial bs1 rows:", initialBs1);

  // Try inserting a voucher
  const voucherRow = {
    vid: testVid,
    acid: 61,
    dt: '2026-05-27',
    narr: 'TEST PMS INSERT',
    vtyp: 4, // receipt/sell
    pfid: 2
  };

  const { error: vErr } = await supabase.from('vouchersc1').insert(voucherRow);
  if (vErr) {
    console.error("Voucher insert error:", vErr.message);
    return;
  }

  // Insert lines
  const transRow = {
    transid: 9999999,
    vid: testVid,
    vtyp: 4,
    dt: '2026-05-27',
    maid: 502869, // some stocks ledger
    cramt: 5000,
    dramt: 0,
    acid: 61
  };

  const { error: tErr } = await supabase.from('transc1').insert(transRow);
  if (tErr) {
    console.error("Trans insert error:", tErr.message);
    // Cleanup voucher
    await supabase.from('vouchersc1').delete().eq('vid', testVid);
    return;
  }

  // Wait 1 second
  await new Promise(r => setTimeout(r, 1000));

  // Query bs1
  const { data: finalBs1, error: finalErr } = await supabase
    .from('bs1')
    .select('*');
  
  console.log("Total bs1 rows:", finalBs1?.length);
  const matching = finalBs1?.filter((r: any) => r.narr === 'TEST PMS INSERT' || r.acvch === `c_${testVid}` || r.trid === testVid);
  console.log("Matching bs1 rows:", matching);

  // Clean up
  await supabase.from('transc1').delete().eq('vid', testVid);
  await supabase.from('vouchersc1').delete().eq('vid', testVid);
  console.log("Cleanup done.");
}
run();
