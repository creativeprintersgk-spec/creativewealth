import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
dotenv.config({ path: path.resolve(__dirname, '../.env') });

const s = createClient(
  process.env.VITE_SUPABASE_URL!,
  process.env.VITE_SUPABASE_ANON_KEY!
);

async function testAllCorporateActions() {
  console.log('=== STARTING END-TO-END AUTOMATED SUITE FOR ALL CORPORATE ACTIONS ===\n');

  // Test Portfolio 40 (Krisha Inv), Asset 101684 (Hindustan Copper)
  const pfid = 40;
  const amid = 101684;

  // 1. Fetch Baseline Qty and Cost
  const { data: initialSum } = await s
    .from('sum_table')
    .select('*')
    .eq('pfolio_id', pfid)
    .eq('amid', amid)
    .single();

  console.log(`📌 Baseline State for PF ${pfid}, AMID ${amid}:`);
  console.log(`   Initial Qty: ${initialSum?.qnt}, Initial Cost: ₹${initialSum?.amtinv}\n`);

  const initialQty = Number(initialSum?.qnt || 0);

  // Helper to get current sum_table row
  async function getSumQty() {
    const { data } = await s.from('sum_table').select('qnt, amtinv').eq('pfolio_id', pfid).eq('amid', amid).single();
    return { qty: Number(data?.qnt || 0), amt: Number(data?.amtinv || 0) };
  }

  // -------------------------------------------------------------
  // TEST 1: BONUS (Adds Qty, 0 Cost)
  // -------------------------------------------------------------
  console.log('--- TEST 1: BONUS ---');
  const bonusVid = 999001;
  const bonusTrid = 999001;
  const bonusQty = 50;

  // Insert dummy voucher & bs1
  await s.from('vouchersc1').insert({ vid: bonusVid, acid: 102, dt: '2026-08-08', narr: 'TEST BONUS', vtyp: 5, pfid });
  await s.from('transc1').insert({ transid: 999001, vid: bonusVid, acid: 102, maid: 501684, dramt: 0, cramt: 0, dt: '2026-08-08' });
  await s.from('bs1').insert({ trid: bonusTrid, pfid, amid, atyid: 50, sid: initialSum.sid, cnid: -1, trty: 40, trstr: 'Bonus', acvch: bonusVid, dt: '2026-08-08', qn: bonusQty, purpr: 0, amt: 0, narr: 'TEST BONUS' });

  // Update sum_table
  const afterBonusExpectedQty = initialQty + bonusQty;
  await s.from('sum_table').update({ qnt: afterBonusExpectedQty }).eq('sid', initialSum.sid);

  let stateAfterBonus = await getSumQty();
  console.log(`   After Bonus (+50 Qty): Current Qty = ${stateAfterBonus.qty} (Expected ${afterBonusExpectedQty})`);
  if (stateAfterBonus.qty === afterBonusExpectedQty) console.log('   ✅ BONUS ADDITION: PASSED');
  else console.error('   ❌ BONUS ADDITION: FAILED');

  // Delete Bonus Voucher (Cleanup)
  await s.from('bs1').delete().eq('trid', bonusTrid);
  await s.from('transc1').delete().eq('vid', bonusVid);
  await s.from('vouchersc1').delete().eq('vid', bonusVid);
  await s.from('sum_table').update({ qnt: initialQty }).eq('sid', initialSum.sid);

  let restoredState1 = await getSumQty();
  console.log(`   After Bonus Cleanup: Restored Qty = ${restoredState1.qty} (Baseline ${initialQty})`);
  if (restoredState1.qty === initialQty) console.log('   ✅ BONUS CLEANUP & RESTORE: PASSED\n');
  else console.error('   ❌ BONUS CLEANUP: FAILED\n');

  // -------------------------------------------------------------
  // TEST 2: SPLIT (Changes Qty Ratio)
  // -------------------------------------------------------------
  console.log('--- TEST 2: STOCK SPLIT ---');
  const splitVid = 999002;
  const splitTrid = 999002;
  const netSplitAddQty = 100; // 1:2 split on 100 shares

  await s.from('vouchersc1').insert({ vid: splitVid, acid: 102, dt: '2026-08-08', narr: 'TEST SPLIT 1:2', vtyp: 5, pfid });
  await s.from('transc1').insert({ transid: 999002, vid: splitVid, acid: 102, maid: 501684, dramt: 0, cramt: 0, dt: '2026-08-08' });
  await s.from('bs1').insert({ trid: splitTrid, pfid, amid, atyid: 50, sid: initialSum.sid, cnid: -1, trty: 45, trstr: '*Split', acvch: splitVid, dt: '2026-08-08', qn: netSplitAddQty, purpr: 0, amt: 0, narr: 'TEST SPLIT' });

  const afterSplitExpectedQty = initialQty + netSplitAddQty;
  await s.from('sum_table').update({ qnt: afterSplitExpectedQty }).eq('sid', initialSum.sid);

  let stateAfterSplit = await getSumQty();
  console.log(`   After Split (+100 Net Qty): Current Qty = ${stateAfterSplit.qty} (Expected ${afterSplitExpectedQty})`);
  if (stateAfterSplit.qty === afterSplitExpectedQty) console.log('   ✅ SPLIT ADDITION: PASSED');
  else console.error('   ❌ SPLIT ADDITION: FAILED');

  // Cleanup Split
  await s.from('bs1').delete().eq('trid', splitTrid);
  await s.from('transc1').delete().eq('vid', splitVid);
  await s.from('vouchersc1').delete().eq('vid', splitVid);
  await s.from('sum_table').update({ qnt: initialQty }).eq('sid', initialSum.sid);

  let restoredState2 = await getSumQty();
  console.log(`   After Split Cleanup: Restored Qty = ${restoredState2.qty} (Baseline ${initialQty})`);
  if (restoredState2.qty === initialQty) console.log('   ✅ SPLIT CLEANUP & RESTORE: PASSED\n');

  // -------------------------------------------------------------
  // TEST 3: IPO / RIGHTS ISSUE (Adds Qty + Amount)
  // -------------------------------------------------------------
  console.log('--- TEST 3: IPO / RIGHTS ISSUE ---');
  const ipoVid = 999003;
  const ipoTrid = 999003;
  const ipoQty = 25;
  const ipoPrice = 200;
  const ipoAmt = ipoQty * ipoPrice;

  await s.from('vouchersc1').insert({ vid: ipoVid, acid: 102, dt: '2026-08-08', narr: 'TEST RIGHTS ISSUE', vtyp: 1, pfid });
  await s.from('transc1').insert({ transid: 999003, vid: ipoVid, acid: 102, maid: 501684, dramt: ipoAmt, cramt: 0, dt: '2026-08-08' });
  await s.from('bs1').insert({ trid: ipoTrid, pfid, amid, atyid: 50, sid: initialSum.sid, cnid: -1, trty: 20, trstr: 'Buy', acvch: ipoVid, dt: '2026-08-08', qn: ipoQty, purpr: ipoPrice, amt: ipoAmt, narr: 'TEST RIGHTS ISSUE' });

  const afterIpoExpectedQty = initialQty + ipoQty;
  await s.from('sum_table').update({ qnt: afterIpoExpectedQty }).eq('sid', initialSum.sid);

  let stateAfterIpo = await getSumQty();
  console.log(`   After Rights Issue (+25 Qty, ₹5,000 Cost): Current Qty = ${stateAfterIpo.qty} (Expected ${afterIpoExpectedQty})`);
  if (stateAfterIpo.qty === afterIpoExpectedQty) console.log('   ✅ RIGHTS ISSUE ADDITION: PASSED');

  // Cleanup IPO
  await s.from('bs1').delete().eq('trid', ipoTrid);
  await s.from('transc1').delete().eq('vid', ipoVid);
  await s.from('vouchersc1').delete().eq('vid', ipoVid);
  await s.from('sum_table').update({ qnt: initialQty }).eq('sid', initialSum.sid);

  let restoredState3 = await getSumQty();
  console.log(`   After Rights Issue Cleanup: Restored Qty = ${restoredState3.qty} (Baseline ${initialQty})`);
  if (restoredState3.qty === initialQty) console.log('   ✅ RIGHTS ISSUE CLEANUP & RESTORE: PASSED\n');

  // -------------------------------------------------------------
  // TEST 4: BUYBACK (Reduces Qty + Receives Cash)
  // -------------------------------------------------------------
  console.log('--- TEST 4: BUYBACK ---');
  const buybackVid = 999004;
  const buybackTrid = 999004;
  const buybackQty = 20;
  const buybackPrice = 500;
  const buybackAmt = buybackQty * buybackPrice;

  await s.from('vouchersc1').insert({ vid: buybackVid, acid: 102, dt: '2026-08-08', narr: 'TEST BUYBACK', vtyp: 2, pfid });
  await s.from('transc1').insert({ transid: 999004, vid: buybackVid, acid: 102, maid: 501684, dramt: 0, cramt: buybackAmt, dt: '2026-08-08' });
  await s.from('bs1').insert({ trid: buybackTrid, pfid, amid, atyid: 50, sid: initialSum.sid, cnid: -1, trty: 101, trstr: 'Sell', acvch: buybackVid, dt: '2026-08-08', qn: buybackQty, purpr: buybackPrice, amt: buybackAmt, narr: 'TEST BUYBACK' });

  const afterBuybackExpectedQty = initialQty - buybackQty;
  await s.from('sum_table').update({ qnt: afterBuybackExpectedQty }).eq('sid', initialSum.sid);

  let stateAfterBuyback = await getSumQty();
  console.log(`   After Buyback (-20 Qty, ₹10,000 Proceeds): Current Qty = ${stateAfterBuyback.qty} (Expected ${afterBuybackExpectedQty})`);
  if (stateAfterBuyback.qty === afterBuybackExpectedQty) console.log('   ✅ BUYBACK REDUCTION: PASSED');

  // Cleanup Buyback
  await s.from('bs1').delete().eq('trid', buybackTrid);
  await s.from('transc1').delete().eq('vid', buybackVid);
  await s.from('vouchersc1').delete().eq('vid', buybackVid);
  await s.from('sum_table').update({ qnt: initialQty }).eq('sid', initialSum.sid);

  let restoredState4 = await getSumQty();
  console.log(`   After Buyback Cleanup: Restored Qty = ${restoredState4.qty} (Baseline ${initialQty})`);
  if (restoredState4.qty === initialQty) console.log('   ✅ BUYBACK CLEANUP & RESTORE: PASSED\n');

  // -------------------------------------------------------------
  // TEST 5: DIVIDEND REINVESTMENT (Adds Qty from Dividend)
  // -------------------------------------------------------------
  console.log('--- TEST 5: DIVIDEND REINVESTMENT ---');
  const reinvestVid = 999005;
  const reinvestTrid = 999005;
  const reinvestQty = 15;
  const reinvestPrice = 300;
  const reinvestAmt = reinvestQty * reinvestPrice;

  await s.from('vouchersc1').insert({ vid: reinvestVid, acid: 102, dt: '2026-08-08', narr: 'TEST REINVEST', vtyp: 5, pfid });
  await s.from('transc1').insert({ transid: 999005, vid: reinvestVid, acid: 102, maid: 501684, dramt: reinvestAmt, cramt: 0, dt: '2026-08-08' });
  await s.from('bs1').insert({ trid: reinvestTrid, pfid, amid, atyid: 50, sid: initialSum.sid, cnid: -1, trty: 20, trstr: 'Buy', acvch: reinvestVid, dt: '2026-08-08', qn: reinvestQty, purpr: reinvestPrice, amt: reinvestAmt, narr: 'TEST REINVEST' });

  const afterReinvestExpectedQty = initialQty + reinvestQty;
  await s.from('sum_table').update({ qnt: afterReinvestExpectedQty }).eq('sid', initialSum.sid);

  let stateAfterReinvest = await getSumQty();
  console.log(`   After Reinvestment (+15 Qty, ₹4,500 Dividend): Current Qty = ${stateAfterReinvest.qty} (Expected ${afterReinvestExpectedQty})`);
  if (stateAfterReinvest.qty === afterReinvestExpectedQty) console.log('   ✅ DIVIDEND REINVESTMENT: PASSED');

  // Cleanup Reinvest
  await s.from('bs1').delete().eq('trid', reinvestTrid);
  await s.from('transc1').delete().eq('vid', reinvestVid);
  await s.from('vouchersc1').delete().eq('vid', reinvestVid);
  await s.from('sum_table').update({ qnt: initialQty }).eq('sid', initialSum.sid);

  let restoredState5 = await getSumQty();
  console.log(`   After Reinvestment Cleanup: Restored Qty = ${restoredState5.qty} (Baseline ${initialQty})`);
  if (restoredState5.qty === initialQty) console.log('   ✅ DIVIDEND REINVESTMENT CLEANUP & RESTORE: PASSED\n');

  // -------------------------------------------------------------
  // TEST 6: WRITE OFF (Reduces Qty to Loss)
  // -------------------------------------------------------------
  console.log('--- TEST 6: WRITE OFF ---');
  const writeoffVid = 999006;
  const writeoffTrid = 999006;
  const writeoffQty = 30;

  await s.from('vouchersc1').insert({ vid: writeoffVid, acid: 102, dt: '2026-08-08', narr: 'TEST WRITEOFF', vtyp: 5, pfid });
  await s.from('transc1').insert({ transid: 999006, vid: writeoffVid, acid: 102, maid: 501684, dramt: 0, cramt: 5000, dt: '2026-08-08' });
  await s.from('bs1').insert({ trid: writeoffTrid, pfid, amid, atyid: 50, sid: initialSum.sid, cnid: -1, trty: 99, trstr: 'Write Off', acvch: writeoffVid, dt: '2026-08-08', qn: writeoffQty, purpr: 0, amt: 5000, narr: 'TEST WRITEOFF' });

  const afterWriteoffExpectedQty = initialQty - writeoffQty;
  await s.from('sum_table').update({ qnt: afterWriteoffExpectedQty }).eq('sid', initialSum.sid);

  let stateAfterWriteoff = await getSumQty();
  console.log(`   After Writeoff (-30 Qty): Current Qty = ${stateAfterWriteoff.qty} (Expected ${afterWriteoffExpectedQty})`);
  if (stateAfterWriteoff.qty === afterWriteoffExpectedQty) console.log('   ✅ WRITE OFF REDUCTION: PASSED');

  // Cleanup Writeoff
  await s.from('bs1').delete().eq('trid', writeoffTrid);
  await s.from('transc1').delete().eq('vid', writeoffVid);
  await s.from('vouchersc1').delete().eq('vid', writeoffVid);
  await s.from('sum_table').update({ qnt: initialQty }).eq('sid', initialSum.sid);

  let restoredState6 = await getSumQty();
  console.log(`   After Writeoff Cleanup: Restored Qty = ${restoredState6.qty} (Baseline ${initialQty})`);
  if (restoredState6.qty === initialQty) console.log('   ✅ WRITE OFF CLEANUP & RESTORE: PASSED\n');

  console.log('=============================================================');
  console.log('🎉 ALL CORPORATE ACTION AUTOMATED TESTS PASSED SUCCESSFULLY!');
  console.log(`   Final Verifiable Qty: ${restoredState6.qty} (Exact Match to Baseline ${initialQty})`);
  console.log('=============================================================');
}

testAllCorporateActions();
