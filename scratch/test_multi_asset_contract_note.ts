import dotenv from 'dotenv';
dotenv.config();
import { createClient } from '@supabase/supabase-js';

const supabase = createClient(
  process.env.VITE_SUPABASE_URL!,
  process.env.VITE_SUPABASE_ANON_KEY!
);

async function run() {
  console.log("=== Starting Multi-Asset Contract Note Simulation Test ===");

  // Let's first make sure we can query some active details
  const { data: vch } = await supabase.from('vouchersc1').select('*').limit(1);
  if (!vch || vch.length === 0) {
    console.log("No vouchers in database to verify, exiting test.");
    return;
  }
  const sampleVch = vch[0];
  console.log("Using sample client/portfolio parameters from existing voucher:", {
    acid: sampleVch.acid,
    pfid: sampleVch.pfid
  });

  const acid = sampleVch.acid;
  const pfid = sampleVch.pfid;

  // Find some real assets in asset_master or acmac1 to use in trades
  const { data: ledgers } = await supabase
    .from('acmac1')
    .select('id, name')
    .eq('acid', acid)
    .gt('id', 100000)
    .limit(2);

  if (!ledgers || ledgers.length < 2) {
    console.log("Not enough assets in acmac1 for this account to run trade simulation, exiting.");
    return;
  }

  const asset1 = ledgers[0];
  const asset2 = ledgers[1];
  console.log("Selected assets for trade simulation:", {
    asset1: asset1.name,
    asset2: asset2.name
  });

  // Let's mock a data payload matching the PMSTransactionModal save output
  // We simulate BUYing 10 shares of asset1 at 1500 and SELLing 20 shares of asset2 at 400
  // Charges: STT = 50, Brokerage = 20
  // Net payable = (10 * 1500) + 50 + 20 - (20 * 400) = 15000 + 70 - 8000 = 7070
  const totalBuys = 15000;
  const totalSells = 8000;
  const totalCharges = 70;
  const netPayable = 7070;

  // Let's resolve Zerodha or a counter broker ledger
  const { data: brokerLedger } = await supabase
    .from('acmac1')
    .select('id, name')
    .eq('acid', acid)
    .eq('parent_id', 75)
    .limit(1);

  const brokerId = brokerLedger?.[0]?.id || 100007; // Zerodha fallback
  console.log("Selected broker counter ledger:", brokerLedger?.[0]?.name || 'Zerodha');

  // Let's resolve STT and Brokerage ledgers
  const { data: sttLedger } = await supabase
    .from('acmac1')
    .select('id')
    .eq('acid', acid)
    .ilike('name', '%stt%')
    .limit(1);
  const sttId = sttLedger?.[0]?.id || 650;

  const { data: brkgLedger } = await supabase
    .from('acmac1')
    .select('id')
    .eq('acid', acid)
    .ilike('name', '%brokerage%')
    .limit(1);
  const brkgId = brkgLedger?.[0]?.id || 665;

  const dummyVid = 9999999;
  const dummyTrid1 = 8888888;
  const dummyTrid2 = 8888889;
  const dummyTransId1 = 7777777;
  const dummyTransId2 = 7777778;
  const dummyTransId3 = 7777779;
  const dummyTransId4 = 7777780;
  const dummyTransId5 = 7777781;

  console.log("Preparing transaction rows for double-entry check...");
  
  const voucherRow = {
    vid: dummyVid,
    acid,
    dt: '2026-05-31',
    narr: 'SIMULATED Share Contract Note, No.:CNT-TEST-9999',
    vtyp: 5,
    pfid,
    cnid: 99999
  };

  const transRows = [
    // Asset 1 Buy (Debit)
    { transid: dummyTransId1, vid: dummyVid, acid, maid: asset1.id, dramt: totalBuys, cramt: 0, dt: '2026-05-31' },
    // Asset 2 Sell (Credit)
    { transid: dummyTransId2, vid: dummyVid, acid, maid: asset2.id, dramt: 0, cramt: totalSells, dt: '2026-05-31' },
    // Charges (Debits)
    { transid: dummyTransId3, vid: dummyVid, acid, maid: sttId, dramt: 50, cramt: 0, dt: '2026-05-31' },
    { transid: dummyTransId4, vid: dummyVid, acid, maid: brkgId, dramt: 20, cramt: 0, dt: '2026-05-31' },
    // Broker settlement (Credit - Net Payable)
    { transid: dummyTransId5, vid: dummyVid, acid, maid: brokerId, dramt: 0, cramt: netPayable, dt: '2026-05-31' }
  ];

  const bsRows = [
    // Buy asset 1
    {
      trid: dummyTrid1,
      pfid,
      amid: asset1.id,
      atyid: 50,
      sid: -1,
      cnid: 99999,
      trty: 20,
      trstr: 'Buy',
      acvch: dummyVid,
      dt: '2026-05-31',
      qn: 10,
      purpr: 1500,
      brkg: 0,
      netpr: 1500,
      amt: totalBuys,
      chrgs: 0,
      narr: 'SIMULATED Buy'
    },
    // Sell asset 2
    {
      trid: dummyTrid2,
      pfid,
      amid: asset2.id,
      atyid: 50,
      sid: -1,
      cnid: 99999,
      trty: 101,
      trstr: 'Sell',
      acvch: dummyVid,
      dt: '2026-05-31',
      qn: 20,
      purpr: 400,
      brkg: 0,
      netpr: 400,
      amt: totalSells,
      chrgs: 0,
      narr: 'SIMULATED Sell'
    }
  ];

  console.log("Inserting simulated contract note into database...");
  await supabase.from('vouchersc1').insert(voucherRow);
  await supabase.from('transc1').insert(transRows);
  await supabase.from('bs1').insert(bsRows);

  console.log("Verifying voucher balance in database...");
  const sumDebits = transRows.reduce((s, r) => s + r.dramt, 0);
  const sumCredits = transRows.reduce((s, r) => s + r.cramt, 0);
  console.log(`- Sum of Debits: ${sumDebits}`);
  console.log(`- Sum of Credits: ${sumCredits}`);
  if (sumDebits === sumCredits) {
    console.log("✅ SUCCESS: Double-entry transactions balance perfectly!");
  } else {
    console.error("❌ FAILURE: Double-entry transactions are unbalanced!");
  }

  // Clean up
  console.log("Cleaning up simulated test records...");
  await supabase.from('transc1').delete().eq('vid', dummyVid);
  await supabase.from('vouchersc1').delete().eq('vid', dummyVid);
  await supabase.from('bs1').delete().eq('acvch', dummyVid);
  console.log("✅ Cleanup complete!");
}

run().catch(console.error);
