import 'dotenv/config';
import dotenv from 'dotenv';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
dotenv.config({ path: path.resolve(__dirname, '../.env') });

import { supabase } from '../src/supabase';
import { initDatabase, createVoucher, deleteVoucher, state } from '../src/logic';

async function verifyContractNoteLifecycle() {
  console.log("=== STARTING CONTRACT NOTE LIFE-CYCLE VERIFICATION ===");

  // 1. Initialize database and fetch in-memory cache
  await initDatabase();
  console.log(`Database loaded. In-memory scnote1 size: ${state.scnote1.length}`);

  // We need to use valid account ledger IDs that exist in acmac1 for pfid=1 (Saahil)
  // Let's find some stock ledger and broker ledger
  const brokerLedger = state.acmac1.find(a => !a.is_group && (a.name.toLowerCase().includes("zerodha") || a.name.toLowerCase().includes("broker")))?.id || 100001;
  const stockLedger = state.acmac1.find(a => !a.is_group && Number(a.id) >= 100000 && a.name.toLowerCase().includes("ntpc"))?.id || 503134;

  const testCnNo = `SIM-CN-${Date.now()}`;
  const testDate = '2026-06-03';
  const testCharges = {
    stt: 12.50,
    brokerage: 5.00,
    gst: 3.15,
    stamp: 1.20,
    transCharges: 0.85,
    other: 0.10
  };

  const mappedLines = [
    {
      ledgerId: stockLedger,
      debit: 10000.00,
      credit: 0,
      quantity: 50,
      price: 200.00
    },
    { ledgerId: 650, debit: testCharges.stt, credit: 0 },
    { ledgerId: 144, debit: testCharges.brokerage, credit: 0 },
    { ledgerId: 651, debit: testCharges.gst, credit: 0 },
    { ledgerId: 653, debit: testCharges.stamp, credit: 0 },
    { ledgerId: 652, debit: testCharges.transCharges, credit: 0 },
    { ledgerId: 654, debit: testCharges.other, credit: 0 },
    {
      ledgerId: brokerLedger,
      debit: 0,
      credit: 10022.80
    }
  ];

  const dataPayload = {
    accountId: brokerLedger,
    portfolioId: 1, // Saahil
    date: testDate,
    narration: `Simulated trades CN - ${testCnNo}`,
    type: "journal",
    lines: mappedLines,
    isContractNote: true,
    cnNo: testCnNo,
    cnCharges: testCharges,
    netPayable: 10022.80 // 10000 buy + 22.80 total charges
  };

  console.log("1. Committing simulated contract note...");
  // Capture existing list lengths
  const prevScCount = state.scnote1.length;
  const prevVchCount = state.vouchersC1.length;
  const prevTransCount = state.transC1.length;
  const prevBsCount = state.bs1.length;

  // We need to determine the vid that will be created
  // Let's hook into state or query DB after
  await createVoucher(dataPayload);

  // 2. Fetch the created voucher details
  const createdVoucher = state.vouchersC1[state.vouchersC1.length - 1];
  const vid = createdVoucher.vid;
  const cnid = createdVoucher.cnid;

  console.log(`✅ Voucher created successfully with vid=${vid}, cnid=${cnid}`);

  // 3. Verify in-memory state updates
  if (state.scnote1.length !== prevScCount + 1) {
    throw new Error(`Memory mismatch: scnote1 did not increment. Expected ${prevScCount + 1}, got ${state.scnote1.length}`);
  }
  if (state.vouchersC1.length !== prevVchCount + 1) {
    throw new Error(`Memory mismatch: vouchersc1 did not increment.`);
  }
  if (state.bs1.length !== prevBsCount + 1) {
    throw new Error(`Memory mismatch: bs1 did not increment.`);
  }

  // 4. Verify Database Records
  console.log("2. Querying Supabase database to verify record contents...");
  
  // Verify SCNOTE1 header
  const { data: dbScnote, error: scErr } = await supabase.from('scnote1').select('*').eq('cnid', cnid).single();
  if (scErr || !dbScnote) {
    throw new Error(`DB Verifcation failed for scnote1: ${scErr?.message || 'No record found'}`);
  }
  console.log("   - scnote1 row matched:", dbScnote);
  if (dbScnote.cnnum !== testCnNo || Number(dbScnote.stt) !== testCharges.stt || Number(dbScnote.amtdue) !== dataPayload.netPayable) {
    throw new Error("DB Verification failed: scnote1 values mismatch");
  }

  // Verify vouchersc1
  const { data: dbVch, error: vchErr } = await supabase.from('vouchersc1').select('*').eq('vid', vid).single();
  if (vchErr || !dbVch) {
    throw new Error(`DB Verification failed for vouchersc1: ${vchErr?.message}`);
  }
  console.log("   - vouchersc1 row matched:", dbVch);
  if (dbVch.cnid !== cnid) {
    throw new Error(`DB Verification failed: vouchersc1.cnid (${dbVch.cnid}) != ${cnid}`);
  }

  // Verify transc1 rows
  const { data: dbTrans, error: transErr } = await supabase.from('transc1').select('*').eq('vid', vid);
  if (transErr || !dbTrans || dbTrans.length === 0) {
    throw new Error(`DB Verification failed for transc1: ${transErr?.message}`);
  }
  console.log(`   - transc1 rows matched (${dbTrans.length} lines)`);

  // Verify bs1 rows
  const { data: dbBs, error: bsErr } = await supabase.from('bs1').select('*').eq('acvch', vid);
  if (bsErr || !dbBs || dbBs.length === 0) {
    throw new Error(`DB Verification failed for bs1: ${bsErr?.message}`);
  }
  console.log("   - bs1 row matched:", dbBs[0]);
  if (dbBs[0].cnid !== cnid) {
    throw new Error(`DB Verification failed: bs1.cnid (${dbBs[0].cnid}) != ${cnid}`);
  }

  // 5. Test clean deletion
  console.log(`3. Deleting voucher vid=${vid}...`);
  await deleteVoucher(vid);

  console.log("4. Verifying database cleanup...");
  const [dbScCheck, dbVchCheck, dbTransCheck, dbBsCheck] = await Promise.all([
    supabase.from('scnote1').select('*').eq('cnid', cnid),
    supabase.from('vouchersc1').select('*').eq('vid', vid),
    supabase.from('transc1').select('*').eq('vid', vid),
    supabase.from('bs1').select('*').eq('acvch', vid)
  ]);

  if (dbScCheck.data?.length !== 0) throw new Error("Cleanup failed: scnote1 row still exists");
  if (dbVchCheck.data?.length !== 0) throw new Error("Cleanup failed: vouchersc1 row still exists");
  if (dbTransCheck.data?.length !== 0) throw new Error("Cleanup failed: transc1 rows still exist");
  if (dbBsCheck.data?.length !== 0) throw new Error("Cleanup failed: bs1 rows still exist");

  console.log("   - Database cleanup verified (all records deleted successfully).");

  // Verify in-memory state is also cleaned up
  if (state.scnote1.some(s => s.cnid === cnid)) throw new Error("Cleanup failed: scnote1 still in memory");
  if (state.vouchersC1.some(v => v.vid === vid)) throw new Error("Cleanup failed: vouchersc1 still in memory");
  if (state.bs1.some(b => b.acvch === vid)) throw new Error("Cleanup failed: bs1 still in memory");
  
  console.log("   - In-memory cleanup verified.");
  console.log("\n⭐️⭐️⭐️ SUCCESS: Contract note import and delete verification complete! ⭐️⭐️⭐️\n");
}

verifyContractNoteLifecycle().catch(err => {
  console.error("❌ Test failed:", err);
  process.exit(1);
});
