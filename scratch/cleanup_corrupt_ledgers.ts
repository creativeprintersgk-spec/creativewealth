/**
 * CLEANUP: Delete the 3 corrupt acmac1 ledgers (503134, 503135, 503136)
 * that were wrongly named "NTPC Limited" during ETF import attempts.
 * Also deletes any residual transc1/bs1 linked to them.
 */
import { createClient } from '@supabase/supabase-js';
import * as dotenv from 'dotenv';
dotenv.config();

const supabase = createClient(
  process.env.VITE_SUPABASE_URL!,
  process.env.VITE_SUPABASE_ANON_KEY!
);

async function main() {
  console.log('=== CLEANUP: Removing corrupt NTPC ledgers 503134, 503135, 503136 ===\n');

  const corruptIds = [503134, 503135, 503136];

  for (const lid of corruptIds) {
    console.log(`\n--- Cleaning ledger id=${lid} ---`);

    // Check what it is
    const { data: ac } = await supabase.from('acmac1').select('*').eq('id', lid);
    const unique = ac?.filter((r, i, arr) => arr.findIndex(x => x.acid === r.acid) === i);
    console.log(`  acmac1 rows: ${ac?.length || 0} (unique acid combos: ${unique?.length || 0})`);
    unique?.forEach(r => console.log(`    acid=${r.acid} name="${r.name}" parent_id=${r.parent_id}`));

    // Check transc1
    const { data: tc1 } = await supabase.from('transc1').select('transid,vid,dramt,cramt').eq('maid', lid);
    console.log(`  transc1 entries: ${tc1?.length || 0}`);
    tc1?.forEach(r => console.log(`    transid=${r.transid} vid=${r.vid} dramt=${r.dramt} cramt=${r.cramt}`));

    // Check bs1
    const { data: bs1 } = await supabase.from('bs1').select('trid,acvch,trstr,amt').eq('amid', lid);
    console.log(`  bs1 entries (amid=${lid}): ${bs1?.length || 0}`);

    // Delete transc1 entries for this maid
    if (tc1 && tc1.length > 0) {
      const vids = [...new Set(tc1.map(r => r.vid))];
      console.log(`  Deleting transc1 for vids: ${vids.join(',')}`);
      const { error: e1 } = await supabase.from('transc1').delete().eq('maid', lid);
      if (e1) console.error(`  ❌ transc1 delete: ${e1.message}`);
      else console.log(`  ✅ Deleted ${tc1.length} transc1 rows`);

      // Also delete the parent vouchersc1 if it becomes empty
      for (const vid of vids) {
        const { data: remaining } = await supabase.from('transc1').select('transid').eq('vid', vid);
        if (!remaining || remaining.length === 0) {
          console.log(`  Voucher vid=${vid} now has no transc1 entries, deleting vouchersc1...`);
          const { error: ev } = await supabase.from('vouchersc1').delete().eq('vid', vid);
          if (ev) console.error(`  ❌ vouchersc1 delete: ${ev.message}`);
          else console.log(`  ✅ Deleted vouchersc1 vid=${vid}`);
          
          // Also delete bs1 for that vid
          await supabase.from('bs1').delete().eq('acvch', vid);
        }
      }
    }

    // Delete the corrupt acmac1 entry
    const { error: eac } = await supabase.from('acmac1').delete().eq('id', lid);
    if (eac) console.error(`  ❌ acmac1 delete: ${eac.message}`);
    else console.log(`  ✅ Deleted acmac1 id=${lid} (all acid variants)`);
  }

  // Verify cleanup
  console.log('\n=== Verification ===');
  const { data: remaining } = await supabase.from('acmac1').select('*').in('id', corruptIds);
  console.log(`Remaining acmac1 rows for ids 503134-503136: ${remaining?.length || 0}`);

  const { data: remainingTc1 } = await supabase.from('transc1').select('*').in('maid', corruptIds);
  console.log(`Remaining transc1 for those maids: ${remainingTc1?.length || 0}`);

  // Check sum_table for NTPC amid=104519 - these are 0-balance, should be cleaned too
  const { data: ntpcSum } = await supabase.from('sum_table').select('*').eq('amid', 104519);
  console.log(`\nSum_table for NTPC (amid=104519): ${ntpcSum?.length || 0} rows`);
  ntpcSum?.forEach(r => console.log(`  sid=${r.sid} pfolio_id=${r.pfolio_id} qnt=${r.qnt} amtinv=${r.amtinv}`));
  
  // Delete 0-balance sum_table rows for NTPC in pfid=1 (user's active portfolio)
  const zeroNtpc = ntpcSum?.filter(r => Number(r.qnt) === 0 && Number(r.amtinv) === 0);
  if (zeroNtpc && zeroNtpc.length > 0) {
    const sidsToDelete = zeroNtpc.map(r => r.sid);
    console.log(`Deleting ${zeroNtpc.length} zero-balance sum_table rows for NTPC: sids=${sidsToDelete.join(',')}`);
    const { error: es } = await supabase.from('sum_table').delete().in('sid', sidsToDelete);
    if (es) console.error(`❌ sum_table delete: ${es.message}`);
    else console.log(`✅ Deleted ${zeroNtpc.length} zero-balance NTPC sum_table rows`);
  }

  console.log('\n✅ CLEANUP COMPLETE!');
  console.log('🔄 Please refresh the app to reload data. NTPC should no longer appear in the Balance Sheet.');
}

main().catch(console.error);
