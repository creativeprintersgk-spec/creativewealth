/**
 * DATA REPAIR: Fix bad RLINFRA voucher vid=13370
 * 
 * Problem: voucher credited Reliance Infrastructure at SALE PRICE (1,83,963.20)
 * instead of COST (1,51,017.20). No capital gain entry was made.
 * This caused BS unbalance of exactly 1,51,017.20.
 * 
 * Fix: Delete the bad voucher and recreate correctly:
 *   Dr  Gold Bond          63,995.00  (buy, at sale proceeds price)
 *   Cr  RLINFRA (acid=30) 1,51,017.20 (at COST - remove investment)
 *   Cr  LTCG (id=465)        32,946.00 (capital gain = proceeds - cost)
 *   Dr  STT                     184.00
 *   Dr  Trans Charges             9.23
 *   Dr  MStock               1,19,774.97 (net payable to broker)
 * 
 * Sum Debits:  63,995 + 184 + 9.23 + 119,774.97 = 183,963.20
 * Sum Credits: 151,017.20 + 32,946.00           = 183,963.20 ✓ BALANCED
 */

const { createClient } = require('@supabase/supabase-js');
require('dotenv').config();

const supabase = createClient(process.env.VITE_SUPABASE_URL, process.env.VITE_SUPABASE_ANON_KEY);

async function run() {
  const VID = 13370;
  const CNID = 4222;
  const ACID = 30; // Pramesh Shah (HUF)

  console.log('=== REPAIR: Bad RLINFRA voucher vid=' + VID + ' ===\n');

  // 1. Verify the bad voucher exists
  const { data: vch } = await supabase.from('vouchersc1').select('*').eq('vid', VID);
  if (!vch || vch.length === 0) {
    console.error('❌ Voucher not found. Already deleted?');
    return;
  }
  console.log('✅ Found bad voucher:', vch[0].narr, 'date:', vch[0].dt);

  // 2. Show existing lines
  const { data: lines } = await supabase.from('transc1').select('*').eq('vid', VID).order('transid');
  console.log('Current lines (to be deleted):');
  let totalDr = 0, totalCr = 0;
  for (const l of lines || []) {
    console.log(`  maid=${l.maid} Dr=${l.dramt} Cr=${l.cramt}`);
    totalDr += Number(l.dramt) || 0;
    totalCr += Number(l.cramt) || 0;
  }
  console.log(`  Total: Dr=${totalDr.toFixed(2)} Cr=${totalCr.toFixed(2)}`);
  console.log('');

  // 3. Compute FIFO cost for Reliance Infrastructure from bs1 for pfid=40 (Krisha Inv)
  // The sells on 2025-09-30: qty = 302+40+15+10+10+359 = 736 shares (in this voucher)
  // The buy for pfid=40: 19 shares at 229.6 = 4,362.40 on 2024-01-29
  // Since only 19 shares were bought, remaining 717 must be from other portfolios 
  // (family pool or transferred).
  // The total sale in the voucher = 183,963.20 at 249.95/share
  // Total qty sold: 302+40+15+10+10+359 = 736 shares
  
  // From bs1, pfid=40 buys for amid=100285:
  const { data: buys } = await supabase.from('bs1')
    .select('trid,pfid,amid,dt,qn,amt,purpr,trty')
    .eq('pfid', 40)
    .eq('amid', 100285)
    .in('trty', [19, 20, 12, 25, 30, 35, 40, 45, 46, 47])
    .order('dt');
  
  console.log('Buy history for pfid=40 amid=100285 (Reliance Infrastructure):');
  let totalBuyQty = 0, totalBuyCost = 0;
  for (const b of buys || []) {
    console.log(`  trid=${b.trid} dt=${b.dt} qty=${b.qn} amt=${b.amt}`);
    totalBuyQty += Number(b.qn);
    totalBuyCost += Number(b.amt);
  }
  console.log(`  Total buys: qty=${totalBuyQty} cost=${totalBuyCost}`);
  
  // The FIFO cost from MProfit's own calculation in the voucher C-4133 was 1,51,017.20
  // We'll use this authoritative number from MProfit since it has the full history
  const RLINFRA_COST = 151017.20;
  const RLINFRA_GAIN = 32946.00;  // = 183,963.20 - 151,017.20
  
  console.log(`\nUsing MProfit-authoritative cost: ${RLINFRA_COST} (from voucher C-4133)`);
  console.log(`Capital Gain (LTCG): ${RLINFRA_GAIN}`);
  console.log(`Proceeds: ${(RLINFRA_COST + RLINFRA_GAIN).toFixed(2)}\n`);

  // 4. Check if RLINFRA ledger exists for acid=30 (Pramesh)
  const { data: rlinfraLedger30 } = await supabase.from('acmac1')
    .select('*')
    .ilike('name', 'Reliance Infrastructure%')
    .eq('acid', 30)
    .eq('is_group', false)
    .limit(1);
  
  let rlinfraId;
  if (rlinfraLedger30 && rlinfraLedger30.length > 0) {
    rlinfraId = rlinfraLedger30[0].id;
    console.log(`✅ RLINFRA ledger found for acid=30: id=${rlinfraId}`);
  } else {
    // Create a new RLINFRA ledger for acid=30
    const { data: maxId } = await supabase.from('acmac1').select('id').order('id', { ascending: false }).limit(1);
    rlinfraId = (maxId?.[0]?.id || 500000) + 1;
    const { error: createErr } = await supabase.from('acmac1').insert([{
      id: rlinfraId,
      name: 'Reliance Infrastructure Limited',
      parent_id: 200050, // Stocks group
      acid: 30,
      is_group: false
    }]);
    if (createErr) {
      console.error('❌ Failed to create RLINFRA ledger for acid=30:', createErr.message);
      return;
    }
    console.log(`✅ Created RLINFRA ledger for acid=30: id=${rlinfraId}`);
  }

  // 5. DELETE the bad voucher
  console.log('\nDeleting bad voucher...');
  const { error: delLines } = await supabase.from('transc1').delete().eq('vid', VID);
  if (delLines) { console.error('❌ Failed to delete transc1 lines:', delLines.message); return; }
  console.log('✅ Deleted transc1 lines');

  const { error: delVch } = await supabase.from('vouchersc1').delete().eq('vid', VID);
  if (delVch) { console.error('❌ Failed to delete vouchersc1:', delVch.message); return; }
  console.log('✅ Deleted vouchersc1 header');

  // Also delete the scnote1 entry if it exists
  const { error: delScnote } = await supabase.from('scnote1').delete().eq('cnid', CNID);
  if (delScnote) console.warn('⚠️  scnote1 delete warning:', delScnote.message);
  else console.log('✅ Deleted scnote1 entry (cnid=' + CNID + ')');

  // 6. Get next transid
  const { data: maxTrans } = await supabase.from('transc1').select('transid').order('transid', { ascending: false }).limit(1);
  let nextTransid = (maxTrans?.[0]?.transid || 23000) + 1;

  // 7. Insert the CORRECT voucher header
  const { error: insVch } = await supabase.from('vouchersc1').insert([{
    vid: VID,
    vtyp: 5,
    dt: '2025-09-30',
    narr: 'Daily trades CN (MStock) - prs curr mstock No: 00004583307 [REPAIRED]',
    pfid: 66,
    atype: 50,
    cnid: CNID,
    acid: ACID
  }]);
  if (insVch) { console.error('❌ Failed to insert corrected vouchersc1:', insVch.message); return; }
  console.log('\n✅ Created corrected voucher header');

  // Re-create scnote1
  await supabase.from('scnote1').insert([{
    cnid: CNID,
    pfid: 66,
    aty: 50,
    brkrid: 100008, // MStock
    cnnum: '00004583307',
    stt: 184,
    tranchrg: 9.23,
    othchrg: 0,
    amtdue: 119774.97,
    dt: '2025-09-30'
  }]);

  // 8. Insert CORRECT transc1 lines:
  // Dr Gold Bond 2.50% JUN 2030 Sr-I (maid=256372): 38,397 + 25,598 = 63,995
  // Cr RLINFRA (acid=30, rlinfraId): 151,017.20 at COST
  // Cr LTCG id=465 (acid=30): 32,946.00
  // Dr STT maid=650: 184
  // Dr Trans Charges maid=654: 9.23
  // Dr MStock maid=100008: 119,774.97

  const correctLines = [
    { transid: nextTransid++, vid: VID, dt: '2025-09-30', maid: 256372, dramt: 38397,     cramt: 0,          acid: ACID },
    { transid: nextTransid++, vid: VID, dt: '2025-09-30', maid: 256372, dramt: 25598,     cramt: 0,          acid: ACID },
    { transid: nextTransid++, vid: VID, dt: '2025-09-30', maid: rlinfraId, dramt: 0,      cramt: 151017.20,  acid: ACID },
    { transid: nextTransid++, vid: VID, dt: '2025-09-30', maid: 465,    dramt: 0,          cramt: 32946.00,   acid: ACID },
    { transid: nextTransid++, vid: VID, dt: '2025-09-30', maid: 650,    dramt: 184,        cramt: 0,          acid: ACID },
    { transid: nextTransid++, vid: VID, dt: '2025-09-30', maid: 654,    dramt: 9.23,       cramt: 0,          acid: ACID },
    { transid: nextTransid++, vid: VID, dt: '2025-09-30', maid: 100008, dramt: 119774.97,  cramt: 0,          acid: ACID },
  ];

  // Verify balanced before inserting
  const sumDr = correctLines.reduce((s, l) => s + l.dramt, 0);
  const sumCr = correctLines.reduce((s, l) => s + l.cramt, 0);
  console.log(`\nNew lines verification: Dr=${sumDr.toFixed(2)} Cr=${sumCr.toFixed(2)} Diff=${Math.abs(sumDr-sumCr).toFixed(2)}`);
  
  if (Math.abs(sumDr - sumCr) > 0.01) {
    console.error('❌ ABORT: New voucher is unbalanced! Will NOT insert.');
    return;
  }

  const { error: insLines } = await supabase.from('transc1').insert(correctLines);
  if (insLines) {
    console.error('❌ Failed to insert corrected transc1 lines:', insLines.message);
    return;
  }
  
  console.log('\n✅ Inserted ' + correctLines.length + ' corrected transc1 lines');
  console.log('\n=== REPAIR COMPLETE ===');
  console.log('Expected BS result:');
  console.log('  Reliance Infrastructure (acid=30): ZERO balance (investment fully sold)');
  console.log('  Long Term Gain Equity (id=465, acid=30): 32,946 Cr');
  console.log('  BS Unbalanced amount should be: ZERO');
}

run().catch(console.error);
