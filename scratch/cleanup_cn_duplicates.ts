/**
 * CLEANUP: Delete duplicate CN vouchers 13352 and 13353
 * The CN CNT-26/27-31957379 was imported 3 times.
 * Keep vid=13354 (has the correct bs1 entry and acid=100007 Zerodha)
 * Delete vid=13352 (wrong date Jun 3, wrong maid 503134, no bs1)  
 * Delete vid=13353 (empty ghost - no transc1, no bs1)
 */
import { createClient } from '@supabase/supabase-js';
import * as dotenv from 'dotenv';
dotenv.config();

const supabase = createClient(
  process.env.VITE_SUPABASE_URL!,
  process.env.VITE_SUPABASE_ANON_KEY!
);

async function deleteVoucher(vid: number) {
  console.log(`\nDeleting vid=${vid}...`);
  
  // Check transc1
  const { data: tc1 } = await supabase.from('transc1').select('transid').eq('vid', vid);
  console.log(`  transc1 entries to delete: ${tc1?.length || 0}`);
  
  // Check bs1
  const { data: bs1 } = await supabase.from('bs1').select('trid').eq('acvch', vid);
  console.log(`  bs1 entries to delete: ${bs1?.length || 0}`);

  // Check voucher
  const { data: vsc } = await supabase.from('vouchersc1').select('vid').eq('vid', vid);
  console.log(`  vouchersc1: ${vsc?.length || 0} row(s)`);

  // Delete transc1 first
  if (tc1 && tc1.length > 0) {
    const { error: e1 } = await supabase.from('transc1').delete().eq('vid', vid);
    if (e1) console.error(`  ❌ transc1 delete error: ${e1.message}`);
    else console.log(`  ✅ Deleted ${tc1.length} transc1 rows`);
  }

  // Delete bs1
  if (bs1 && bs1.length > 0) {
    const { error: e2 } = await supabase.from('bs1').delete().eq('acvch', vid);
    if (e2) console.error(`  ❌ bs1 delete error: ${e2.message}`);
    else console.log(`  ✅ Deleted ${bs1.length} bs1 rows`);
  }

  // Delete vouchersc1
  const { error: e3 } = await supabase.from('vouchersc1').delete().eq('vid', vid);
  if (e3) console.error(`  ❌ vouchersc1 delete error: ${e3.message}`);
  else console.log(`  ✅ Deleted vouchersc1 row`);

  // Also delete vouchers1 just in case
  await supabase.from('vouchers1').delete().eq('vid', vid);
}

async function main() {
  console.log('=== CLEANUP: Removing duplicate CN vouchers ===\n');
  
  // First show what we have now
  console.log('BEFORE cleanup:');
  const { data: before } = await supabase.from('transc1').select('transid,vid,maid,dramt,cramt').in('vid', [13352, 13353, 13354]).order('transid');
  before?.forEach(r => console.log(`  transid=${r.transid} vid=${r.vid} maid=${r.maid} dramt=${r.dramt} cramt=${r.cramt}`));
  
  // Verify vid=13354 is correct before we delete the others
  const { data: goodVoucher } = await supabase.from('vouchersc1').select('*').eq('vid', 13354);
  const { data: goodBs1 } = await supabase.from('bs1').select('*').eq('acvch', 13354);
  console.log('\nKeeping vid=13354:', goodVoucher?.[0]?.narr, '| bs1 entries:', goodBs1?.length);

  // Delete the duplicates
  await deleteVoucher(13352); // wrong date/maid, no bs1
  await deleteVoucher(13353); // empty ghost

  // Verify after cleanup
  console.log('\n\nAFTER cleanup:');
  const { data: after } = await supabase.from('transc1').select('transid,vid,maid,dramt,cramt').in('vid', [13352, 13353, 13354]).order('transid');
  after?.forEach(r => console.log(`  transid=${r.transid} vid=${r.vid} maid=${r.maid} dramt=${r.dramt} cramt=${r.cramt}`));
  
  const { data: afterVsc } = await supabase.from('vouchersc1').select('vid,narr,dt,acid').in('vid', [13352, 13353, 13354]);
  console.log('\nVouchersc1 remaining:', afterVsc?.length, afterVsc?.map(v => `vid=${v.vid} "${v.narr}"`));

  // Also check Zerodha balance now (maid=100007, only recent entries)
  const { data: zerodhaTc1 } = await supabase
    .from('transc1')
    .select('transid,vid,dramt,cramt,dt')
    .eq('maid', 100007)
    .gte('dt', '2026-05-01')
    .order('transid', { ascending: false });
  
  console.log('\n=== Zerodha transc1 entries after June 2026 (SHOULD now show only once for CN) ===');
  zerodhaTc1?.forEach(r => console.log(`  transid=${r.transid} vid=${r.vid} dramt=${r.dramt} cramt=${r.cramt} dt="${r.dt}"`));

  console.log('\n✅ Cleanup complete!');
  console.log('Please refresh the app (Force Refresh Database button or reload page) to see the corrected Balance Sheet.');
}

main().catch(console.error);
