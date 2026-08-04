/**
 * Check ONLY recent entries (last 7 days) in bs1, vouchersc1, transc1
 * to find what was imported via contract note and why NTPC is still showing
 */
import { createClient } from '@supabase/supabase-js';
import * as dotenv from 'dotenv';
dotenv.config();

const supabase = createClient(
  process.env.VITE_SUPABASE_URL!,
  process.env.VITE_SUPABASE_ANON_KEY!
);

async function main() {
  console.log('=== RECENT ENTRIES DIAGNOSTIC (last 7 days) ===\n');

  const sinceDate = '2026-05-29'; // last week

  // 1. Recent bs1 entries
  const { data: recentBs1 } = await supabase
    .from('bs1')
    .select('*')
    .gte('dt', sinceDate)
    .order('trid', { ascending: false });

  console.log(`=== Recent BS1 entries (${recentBs1?.length || 0} total since ${sinceDate}) ===`);
  recentBs1?.forEach(r => {
    console.log(`  trid=${r.trid} pfid=${r.pfid} amid=${r.amid} acvch=${r.acvch} cnid=${r.cnid} trstr="${r.trstr}" qn=${r.qn} amt=${r.amt} dt="${r.dt}"`);
  });

  // 2. Recent vouchersc1 entries
  const { data: recentVsc } = await supabase
    .from('vouchersc1')
    .select('*')
    .gte('dt', sinceDate)
    .order('vid', { ascending: false });

  console.log(`\n=== Recent VOUCHERSC1 entries (${recentVsc?.length || 0} total) ===`);
  recentVsc?.forEach(r => {
    console.log(`  vid=${r.vid} pfid=${r.pfid} acid=${r.acid} cnid=${r.cnid} narr="${r.narr}" dt="${r.dt}"`);
  });

  // 3. Recent vouchers1 entries
  const { data: recentV1 } = await supabase
    .from('vouchers1')
    .select('*')
    .gte('dt', sinceDate)
    .order('vid', { ascending: false });

  console.log(`\n=== Recent VOUCHERS1 entries (${recentV1?.length || 0} total) ===`);
  recentV1?.forEach(r => {
    console.log(`  vid=${r.vid} acid=${r.acid} cnid=${r.cnid} narr="${r.narr}" dt="${r.dt}"`);
  });

  // Collect all recent vids
  const allVids = [
    ...(recentVsc?.map(r => r.vid) || []),
    ...(recentV1?.map(r => r.vid) || [])
  ];

  // 4. Recent transc1 entries for those vids
  if (allVids.length > 0) {
    const { data: recentTc1 } = await supabase
      .from('transc1')
      .select('*')
      .in('vid', allVids)
      .order('transid', { ascending: false });

    console.log(`\n=== Recent TRANSC1 entries (${recentTc1?.length || 0} total - DRIVES BALANCE SHEET) ===`);
    recentTc1?.forEach(r => {
      console.log(`  transid=${r.transid} vid=${r.vid} acid=${r.acid} maid=${r.maid} dramt=${r.dramt} cramt=${r.cramt} dt="${r.dt}"`);
    });
  }

  // 5. Recent scnote1 entries
  const { data: recentScnote } = await supabase
    .from('scnote1')
    .select('*')
    .gte('dt', sinceDate)
    .order('cnid', { ascending: false });

  console.log(`\n=== Recent SCNOTE1 entries (${recentScnote?.length || 0} total) ===`);
  recentScnote?.forEach(r => {
    console.log(`  cnid=${r.cnid} pfid=${r.pfid} cnnum="${r.cnnum}" brkrid=${r.brkrid} amtdue=${r.amtdue} dt="${r.dt}"`);
  });

  // 6. HIGH TRID bs1 entries (most recently inserted rows regardless of date)
  const { data: highTridBs1 } = await supabase
    .from('bs1')
    .select('*')
    .order('trid', { ascending: false })
    .limit(30);

  console.log(`\n=== HIGHEST TRID BS1 entries (last 30 inserted) ===`);
  highTridBs1?.forEach(r => {
    console.log(`  trid=${r.trid} pfid=${r.pfid} amid=${r.amid} acvch=${r.acvch} cnid=${r.cnid} trstr="${r.trstr}" qn=${r.qn} amt=${r.amt} dt="${r.dt}"`);
  });

  // 7. HIGH VID vouchers (most recently inserted)
  const { data: highVidVsc } = await supabase
    .from('vouchersc1')
    .select('*')
    .order('vid', { ascending: false })
    .limit(20);

  console.log(`\n=== HIGHEST VID VOUCHERSC1 (last 20 inserted) ===`);
  highVidVsc?.forEach(r => {
    console.log(`  vid=${r.vid} pfid=${r.pfid} acid=${r.acid} cnid=${r.cnid} narr="${r.narr}" dt="${r.dt}"`);
  });

  // 8. HIGH CNID scnote1 (most recently inserted)
  const { data: highCnid } = await supabase
    .from('scnote1')
    .select('*')
    .order('cnid', { ascending: false })
    .limit(10);

  console.log(`\n=== HIGHEST CNID SCNOTE1 (last 10 inserted) ===`);
  highCnid?.forEach(r => {
    console.log(`  cnid=${r.cnid} pfid=${r.pfid} cnnum="${r.cnnum}" brkrid=${r.brkrid} amtdue=${r.amtdue} dt="${r.dt}"`);
  });

  // 9. Check if there are bs1 rows with NO matching vouchersc1 (orphaned from our new imports)
  const recentAcvchVids = [...new Set(
    highTridBs1?.filter(r => r.acvch && r.acvch > 0).map(r => Number(r.acvch)) || []
  )];

  if (recentAcvchVids.length > 0) {
    const { data: matchingVouchers } = await supabase
      .from('vouchersc1')
      .select('vid')
      .in('vid', recentAcvchVids);

    const matchedVids = new Set(matchingVouchers?.map(v => v.vid) || []);
    const orphaned = recentAcvchVids.filter(v => !matchedVids.has(v));
    
    if (orphaned.length > 0) {
      console.log(`\n🔴 ORPHANED BS1 RECORDS (acvch has no vouchersc1 match): vids=${orphaned.join(',')}`);
      const orphanedRows = highTridBs1?.filter(r => orphaned.includes(Number(r.acvch)));
      orphanedRows?.forEach(r => {
        console.log(`  trid=${r.trid} acvch=${r.acvch} pfid=${r.pfid} amid=${r.amid} trstr="${r.trstr}" qn=${r.qn} dt="${r.dt}"`);
      });
    } else {
      console.log('\n✅ All recent bs1 acvch references have matching vouchersc1 entries.');
    }
  }

  console.log('\n=== DIAGNOSTIC COMPLETE ===');
}

main().catch(console.error);
