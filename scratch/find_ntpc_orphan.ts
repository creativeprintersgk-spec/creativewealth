/**
 * Find the orphaned NTPC transc1/vouchersc1 entry for Saahil
 * causing "Unbalanced by 14,075.25" on the BS
 */
import 'dotenv/config';
import { createClient } from '@supabase/supabase-js';

const supabase = createClient(
  process.env.VITE_SUPABASE_URL!,
  process.env.VITE_SUPABASE_ANON_KEY!
);

async function main() {
  // 1. Search transc1 for Saahil (acid=31) from 2026-05-25 onwards
  console.log('=== TRANSC1: acid=31 from 2026-05-25 ===');
  const { data: recent } = await supabase.from('transc1').select('*')
    .eq('acid', 31).gte('dt', '2026-05-25').order('transid');
  recent?.forEach(r => console.log(`  transid=${r.transid} vid=${r.vid} maid=${r.maid} dramt=${r.dramt} cramt=${r.cramt} dt="${r.dt}"`));
  console.log(`Total: ${recent?.length || 0}`);

  // 2. Find the vouchersc1 entries for those vids
  const vids = [...new Set(recent?.map(r => r.vid) || [])];
  if (vids.length > 0) {
    console.log(`\n=== VOUCHERSC1 for those vids: [${vids.join(', ')}] ===`);
    const { data: vouchers } = await supabase.from('vouchersc1').select('*').in('vid', vids);
    vouchers?.forEach(r => console.log(`  vid=${r.vid} narr="${r.narr}" dt="${r.dt}" acid=${r.acid} pfid=${r.pfid} cnid=${r.cnid}`));
  }

  // 3. Find all transc1 for acid=31 where dramt or cramt is close to 14075.25
  console.log('\n=== TRANSC1 acid=31: entries near 14075 (NTPC amount) ===');
  const { data: all } = await supabase.from('transc1').select('*').eq('acid', 31);
  const close = all?.filter(r => Math.abs(Number(r.dramt) - 14075.25) < 1 || Math.abs(Number(r.cramt) - 14075.25) < 1);
  close?.forEach(r => console.log(`  transid=${r.transid} vid=${r.vid} maid=${r.maid} dramt=${r.dramt} cramt=${r.cramt} dt="${r.dt}"`));
  console.log(`Total near 14075: ${close?.length || 0}`);

  // 4. Find ALL transc1 for acid=31 from 2026-04-01 - check for any NTPC-related imbalanced entry
  console.log('\n=== TRANSC1 acid=31 from 2026-04-01: all ===');
  const { data: newFY } = await supabase.from('transc1').select('*')
    .eq('acid', 31).gte('dt', '2026-04-01').order('dt');
  newFY?.forEach(r => console.log(`  transid=${r.transid} vid=${r.vid} maid=${r.maid} dramt=${r.dramt} cramt=${r.cramt} dt="${r.dt}"`));
  console.log(`Total: ${newFY?.length || 0}`);

  // 5. Check if there are orphaned transc1 entries whose vid does NOT exist in vouchersc1
  if (newFY && newFY.length > 0) {
    const newVids = [...new Set(newFY.map(r => r.vid))];
    console.log(`\n=== Checking which vids have no parent in vouchersc1 ===`);
    const { data: existingVouchers } = await supabase.from('vouchersc1').select('vid').in('vid', newVids);
    const existingVidSet = new Set(existingVouchers?.map(v => v.vid) || []);
    const orphanedVids = newVids.filter(v => !existingVidSet.has(v));
    console.log(`Orphaned vids (transc1 entry but no vouchersc1): [${orphanedVids.join(', ')}]`);
    orphanedVids.forEach(vid => {
      const entries = newFY.filter(r => r.vid === vid);
      entries.forEach(r => console.log(`  orphan vid=${r.vid} transid=${r.transid} maid=${r.maid} dramt=${r.dramt} cramt=${r.cramt} dt="${r.dt}"`));
    });
  }

  // 6. Look up what acmac1 ledger the Zerodha broker is for acid=31
  console.log('\n=== ACMAC1 acid=31: Zerodha / broker ledgers ===');
  const { data: zerodha } = await supabase.from('acmac1').select('*')
    .eq('acid', 31).ilike('name', '%zerodha%');
  zerodha?.forEach(r => console.log(`  id=${r.id} name="${r.name}" parent_id=${r.parent_id}`));

  // 7. Also search by parent_id in broker/sundry creditor group
  console.log('\n=== TRANSC1 acid=31: entries with dramt or cramt in 14000-14200 range (all dates) ===');
  const ntpcClose = all?.filter(r =>
    (Number(r.dramt) >= 14000 && Number(r.dramt) <= 14200) ||
    (Number(r.cramt) >= 14000 && Number(r.cramt) <= 14200)
  );
  ntpcClose?.forEach(r => console.log(`  transid=${r.transid} vid=${r.vid} maid=${r.maid} dramt=${r.dramt} cramt=${r.cramt} dt="${r.dt}"`));
}

main().catch(console.error);
