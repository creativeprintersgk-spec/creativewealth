/**
 * Diagnose NTPC double-entry issue:
 * Check bs1, transc1, vouchersc1, vouchers1, scnote1 for all NTPC records
 */
import { createClient } from '@supabase/supabase-js';
import * as dotenv from 'dotenv';
dotenv.config();

const supabase = createClient(
  process.env.VITE_SUPABASE_URL!,
  process.env.VITE_SUPABASE_ANON_KEY!
);

async function main() {
  console.log('=== NTPC FULL DIAGNOSTIC ===\n');

  // Step 1: Find NTPC in asset master / SAM
  const { data: samRows } = await supabase.from('sam').select('*').ilike('anm', '%ntpc%');
  const { data: amRows } = await supabase.from('asset_master').select('*').ilike('name', '%ntpc%');
  console.log('SAM matches:', samRows?.map(r => `amid=${r.amid} name="${r.anm}"`));
  console.log('Asset Master matches:', amRows?.map(r => `amid=${r.amid} name="${r.name}"`));

  const ntpcAmids = [
    ...new Set([
      ...(samRows?.map(r => r.amid) || []),
      ...(amRows?.map(r => r.amid) || [])
    ])
  ];
  console.log('\nNTPC amid(s):', ntpcAmids);

  if (ntpcAmids.length === 0) {
    console.log('❌ NTPC not found in asset master. Trying BS1 directly...');
    // Try to find in bs1 by narration
    const { data: bsNarr } = await supabase.from('bs1').select('*').ilike('narr', '%ntpc%');
    console.log('BS1 narr matches:', bsNarr?.length, bsNarr);
    return;
  }

  // Step 2: Check bs1 for all NTPC entries
  const { data: bs1Rows } = await supabase.from('bs1').select('*').in('amid', ntpcAmids);
  console.log(`\n=== BS1 entries for NTPC (${bs1Rows?.length || 0} total) ===`);
  bs1Rows?.forEach(r => {
    console.log(`  trid=${r.trid} pfid=${r.pfid} amid=${r.amid} acvch=${r.acvch} cnid=${r.cnid} trty=${r.trty} trstr="${r.trstr}" qn=${r.qn} amt=${r.amt} dt="${r.dt}"`);
  });

  // Collect all vid references from bs1
  const acvchVids = [...new Set(bs1Rows?.map(r => Number(r.acvch)).filter(v => v > 0) || [])];
  console.log('\nVoucher IDs referenced from bs1:', acvchVids);

  // Step 3: Check vouchersc1 for those vids
  const { data: vscRows } = await supabase.from('vouchersc1').select('*').in('vid', acvchVids);
  console.log(`\n=== VOUCHERSC1 entries (${vscRows?.length || 0} total) ===`);
  vscRows?.forEach(r => {
    console.log(`  vid=${r.vid} pfid=${r.pfid} acid=${r.acid} cnid=${r.cnid} narr="${r.narr}" dt="${r.dt}"`);
  });

  // Step 4: Check vouchers1 for those vids  
  const { data: v1Rows } = await supabase.from('vouchers1').select('*').in('vid', acvchVids);
  console.log(`\n=== VOUCHERS1 entries (${v1Rows?.length || 0} total) ===`);
  v1Rows?.forEach(r => {
    console.log(`  vid=${r.vid} acid=${r.acid} cnid=${r.cnid} narr="${r.narr}" dt="${r.dt}"`);
  });

  // Step 5: Check transc1 for all those vids (these drive the BS!)
  const { data: tc1Rows } = await supabase.from('transc1').select('*').in('vid', acvchVids);
  console.log(`\n=== TRANSC1 entries (${tc1Rows?.length || 0} total - THESE DRIVE BALANCE SHEET) ===`);
  tc1Rows?.forEach(r => {
    console.log(`  transid=${r.transid} vid=${r.vid} acid=${r.acid} maid=${r.maid} dramt=${r.dramt} cramt=${r.cramt} dt="${r.dt}"`);
  });

  // Step 6: Check trans1 for those vids
  const { data: t1Rows } = await supabase.from('trans1').select('*').in('vid', acvchVids);
  console.log(`\n=== TRANS1 entries (${t1Rows?.length || 0} total) ===`);
  t1Rows?.forEach(r => {
    console.log(`  transid=${r.transid} vid=${r.vid} acid=${r.acid} maid=${r.maid} dramt=${r.dramt} cramt=${r.cramt} dt="${r.dt}"`);
  });

  // Step 7: Check scnote1 for those cnids
  const cnids = [...new Set([
    ...(bs1Rows?.map(r => r.cnid).filter(c => c && c !== -1) || []),
    ...(vscRows?.map(r => r.cnid).filter(c => c && c !== -1) || [])
  ])];
  if (cnids.length > 0) {
    const { data: snRows } = await supabase.from('scnote1').select('*').in('cnid', cnids);
    console.log(`\n=== SCNOTE1 entries (${snRows?.length || 0} total) ===`);
    snRows?.forEach(r => {
      console.log(`  cnid=${r.cnid} pfid=${r.pfid} cnnum="${r.cnnum}" brkrid=${r.brkrid} amtdue=${r.amtdue} dt="${r.dt}"`);
    });
  }

  // Step 8: Identify orphaned bs1 records (in bs1 but no matching vouchersc1/vouchers1)
  const allVids = new Set([
    ...(vscRows?.map(r => r.vid) || []),
    ...(v1Rows?.map(r => r.vid) || [])
  ]);
  const orphanedBs1 = bs1Rows?.filter(r => r.acvch && !allVids.has(Number(r.acvch)));
  if (orphanedBs1 && orphanedBs1.length > 0) {
    console.log(`\n🔴 ORPHANED BS1 RECORDS (no matching voucher!) - ${orphanedBs1.length} records:`);
    orphanedBs1.forEach(r => {
      console.log(`  trid=${r.trid} acvch=${r.acvch} trstr="${r.trstr}" qn=${r.qn} amt=${r.amt} dt="${r.dt}"`);
    });
  }

  // Step 9: Identify orphaned transc1 records (in transc1 but no matching vouchersc1)
  const vscVids = new Set(vscRows?.map(r => r.vid) || []);
  const orphanedTc1 = tc1Rows?.filter(r => !vscVids.has(Number(r.vid)));
  if (orphanedTc1 && orphanedTc1.length > 0) {
    console.log(`\n🔴 ORPHANED TRANSC1 RECORDS (no matching vouchersc1!) - ${orphanedTc1.length} records:`);
    orphanedTc1.forEach(r => {
      console.log(`  transid=${r.transid} vid=${r.vid} maid=${r.maid} dramt=${r.dramt} cramt=${r.cramt}`);
    });
  }

  // Step 10: NTPC ledger ID in acmac1  
  const { data: acmac1Rows } = await supabase.from('acmac1').select('*').in('id', ntpcAmids);
  console.log(`\n=== ACMAC1 entries for NTPC amids (${acmac1Rows?.length || 0} rows) ===`);
  acmac1Rows?.forEach(r => {
    console.log(`  id=${r.id} acid=${r.acid} name="${r.name}" parent_id=${r.parent_id} is_group=${r.is_group}`);
  });

  // Step 11: TRANSC1 entries for NTPC ledger id (maid = ntpcAmid)
  for (const amid of ntpcAmids) {
    const { data: tc1ByMaid } = await supabase.from('transc1').select('*').eq('maid', amid);
    console.log(`\n=== TRANSC1 entries where maid=${amid} NTPC (${tc1ByMaid?.length || 0} rows) ===`);
    tc1ByMaid?.forEach(r => {
      console.log(`  transid=${r.transid} vid=${r.vid} acid=${r.acid} dramt=${r.dramt} cramt=${r.cramt} dt="${r.dt}"`);
    });
  }

  console.log('\n=== DIAGNOSTIC COMPLETE ===');
}

main().catch(console.error);
