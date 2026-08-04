/**
 * Deeper BS investigation:
 * Find how NTPC Limited (amid=104519) or NTPC NCD N7 (amid=425629) appears in BS
 * Check what ledger IDs these amids correspond to in acmac1
 * Then check transc1/trans1 for those ledger IDs  
 * Also check sum_table for the duplicate
 */
import { createClient } from '@supabase/supabase-js';
import * as dotenv from 'dotenv';
dotenv.config();

const supabase = createClient(
  process.env.VITE_SUPABASE_URL!,
  process.env.VITE_SUPABASE_ANON_KEY!
);

async function main() {
  console.log('=== BS DOUBLE-ENTRY INVESTIGATION ===\n');

  // Key NTPC amids from previous diagnostic
  const focusAmids = [104519, 425629]; // NTPC Limited, NTPC NCD N7
  
  for (const amid of focusAmids) {
    console.log(`\n--- Investigating amid=${amid} ---`);
    
    // Check bs1 entries
    const { data: bs1 } = await supabase.from('bs1').select('*').eq('amid', amid);
    console.log(`BS1 entries: ${bs1?.length || 0}`);
    bs1?.forEach(r => console.log(`  trid=${r.trid} pfid=${r.pfid} acvch=${r.acvch} trstr="${r.trstr}" qn=${r.qn} amt=${r.amt} dt="${r.dt}" cnid=${r.cnid}`));

    // Check sum_table entries
    const { data: sumRows } = await supabase.from('sum_table').select('*').eq('amid', amid);
    console.log(`\nSum_table entries: ${sumRows?.length || 0}`);
    sumRows?.forEach(r => console.log(`  sid=${r.sid} pfolio_id=${r.pfolio_id} qnt=${r.qnt} amtinv=${r.amtinv} currv=${r.currv}`));

    // Check acmac1 for ledger with id = amid (the NTPC ledger in chart of accounts)
    const { data: acRows } = await supabase.from('acmac1').select('*').eq('id', amid);
    console.log(`\nACMAC1 entries with id=${amid}: ${acRows?.length || 0}`);
    acRows?.forEach(r => console.log(`  id=${r.id} acid=${r.acid} name="${r.name}" parent_id=${r.parent_id} is_group=${r.is_group} ext_id=${r.ext_id}`));
    
    // Check transc1 where maid = amid
    const { data: tc1 } = await supabase.from('transc1').select('*').eq('maid', amid);
    console.log(`\nTRANSC1 entries with maid=${amid}: ${tc1?.length || 0}`);
    tc1?.forEach(r => console.log(`  transid=${r.transid} vid=${r.vid} acid=${r.acid} dramt=${r.dramt} cramt=${r.cramt} dt="${r.dt}"`));
    
    // Check trans1 where maid = amid
    const { data: t1 } = await supabase.from('trans1').select('*').eq('maid', amid);
    console.log(`\nTRANS1 entries with maid=${amid}: ${t1?.length || 0}`);
    t1?.forEach(r => console.log(`  transid=${r.transid} vid=${r.vid} acid=${r.acid} dramt=${r.dramt} cramt=${r.cramt} dt="${r.dt}"`));
  }

  // Now check: what is showing "NTPC" in the BS?
  // The BS uses generateBS() which calls getLedgerBalance() for each non-group acmac1 entry.
  // getLedgerBalance uses transc1/trans1 by maid.
  // So NTPC appears in BS only if there's an acmac1 entry with NTPC's amid as its id,
  // AND transc1 has entries for that maid.
  
  // Let's check acmac1 for ANY entry that has "ntpc" in the name (these ARE the ledgers)
  console.log('\n=== ACMAC1 ledger entries with NTPC in name ===');
  const { data: acNtpc } = await supabase.from('acmac1').select('*').ilike('name', '%ntpc%');
  console.log(`Total: ${acNtpc?.length || 0}`);
  acNtpc?.forEach(r => console.log(`  id=${r.id} acid=${r.acid} name="${r.name}" parent_id=${r.parent_id} is_group=${r.is_group}`));
  
  // For each of those ledger IDs, check transc1
  const ntpcLedgerIds = [...new Set(acNtpc?.map(r => r.id) || [])];
  console.log('\nNTPC Ledger IDs in acmac1:', ntpcLedgerIds);
  
  for (const lid of ntpcLedgerIds) {
    const { data: tc1 } = await supabase.from('transc1').select('*').eq('maid', lid);
    const { data: t1 } = await supabase.from('trans1').select('*').eq('maid', lid);
    if ((tc1?.length || 0) > 0 || (t1?.length || 0) > 0) {
      console.log(`\n🔴 Ledger id=${lid} HAS transc1=${tc1?.length || 0} trans1=${t1?.length || 0} entries - THIS CREATES THE BS ENTRY!`);
      tc1?.forEach(r => console.log(`  TRANSC1: transid=${r.transid} vid=${r.vid} dramt=${r.dramt} cramt=${r.cramt} dt="${r.dt}"`));
      t1?.forEach(r => console.log(`  TRANS1: transid=${r.transid} vid=${r.vid} dramt=${r.dramt} cramt=${r.cramt} dt="${r.dt}"`));
    }
  }

  // ALSO check: does PMS show NTPC because of bs1 directly?
  // The PMS Holdings page uses getHoldings() which reads state.bs1 - NOT transc1!
  // So the "twice in BS" seen by the user might be:
  // 1. The BS page (BalanceSheet.tsx) computing from transc1 (ledger balances)
  // 2. The PMS Holdings page computing from bs1 (portfolio transactions)
  // These are TWO DIFFERENT views! The "BS" the user sees might be the PMS holdings grid.
  
  // Let's check: are there any DUPLICATE bs1 entries for the same pfid+amid?
  console.log('\n=== CHECKING FOR DUPLICATE BS1 ENTRIES (same pfid+amid) ===');
  const { data: allBs1 } = await supabase.from('bs1').select('pfid,amid,trid,trstr,qn,amt,dt,acvch').in('amid', focusAmids);
  
  const groupKey = (r: any) => `${r.pfid}_${r.amid}`;
  const groups: Record<string, any[]> = {};
  allBs1?.forEach(r => {
    const k = groupKey(r);
    if (!groups[k]) groups[k] = [];
    groups[k].push(r);
  });
  
  Object.entries(groups).forEach(([key, rows]) => {
    const buys = rows.filter(r => ['Buy', 'Purchase', 'SIP'].includes(r.trstr));
    const sells = rows.filter(r => ['Sell', 'Redemption'].includes(r.trstr));
    const netQty = buys.reduce((s, r) => s + (Number(r.qn) || 0), 0) - sells.reduce((s, r) => s + (Number(r.qn) || 0), 0);
    if (rows.length > 1 || netQty > 0) {
      console.log(`\npfid_amid=${key}: ${rows.length} entries, net qty=${netQty}`);
      rows.forEach(r => console.log(`  trid=${r.trid} trstr="${r.trstr}" qn=${r.qn} amt=${r.amt} dt="${r.dt}" acvch=${r.acvch}`));
    }
  });

  console.log('\n=== INVESTIGATION COMPLETE ===');
}

main().catch(console.error);
