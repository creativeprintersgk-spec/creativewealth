/**
 * Diagnose: NTPC contract (Saahil, acid=31) imported+deleted but still showing in BS
 * Check: acmac1, transc1, sum_table for NTPC amid=104519 in Saahil's portfolios
 */
import 'dotenv/config';
import { createClient } from '@supabase/supabase-js';

const supabase = createClient(
  process.env.VITE_SUPABASE_URL!,
  process.env.VITE_SUPABASE_ANON_KEY!
);

const SAAHIL_ACID = 31; // Saahil Shah A/c
const NTPC_AMID = 104519; // NTPC Limited

async function main() {
  // 1. All acmac1 entries for NTPC in Saahil's account
  console.log('=== ACMAC1: NTPC-related ledgers for acid=31 (Saahil) ===');
  const { data: acmac } = await supabase.from('acmac1').select('*')
    .eq('acid', SAAHIL_ACID)
    .ilike('name', '%NTPC%');
  acmac?.forEach(r => console.log(`  id=${r.id} name="${r.name}" parent_id=${r.parent_id} is_group=${r.is_group} ext_id=${r.ext_id}`));
  console.log(`Total: ${acmac?.length || 0}`);

  // 2. All acmac1 with name NTPC (any acid) - to see all ghost ledgers
  console.log('\n=== ACMAC1: ALL NTPC ledgers (all accounts) ===');
  const { data: acmacAll } = await supabase.from('acmac1').select('*')
    .ilike('name', '%NTPC%').order('acid');
  acmacAll?.forEach(r => console.log(`  id=${r.id} acid=${r.acid} name="${r.name}" parent_id=${r.parent_id}`));
  console.log(`Total: ${acmacAll?.length || 0}`);

  // 3. transc1 entries for Saahil's NTPC ledgers
  const ntpcIds = acmac?.map(r => r.id) || [];
  console.log('\n=== TRANSC1: entries for NTPC ledger ids in Saahil ===');
  for (const maid of ntpcIds) {
    const { data: tc1 } = await supabase.from('transc1').select('*').eq('maid', maid);
    console.log(`  maid=${maid}: ${tc1?.length || 0} entries`);
    tc1?.forEach(r => console.log(`    transid=${r.transid} vid=${r.vid} dramt=${r.dramt} cramt=${r.cramt} dt="${r.dt}" acid=${r.acid}`));
  }

  // 4. transc1 for NTPC by ext_id / amid (any ledger with ext_id=104519)
  console.log('\n=== ACMAC1: ledgers with ext_id=104519 (NTPC amid) ===');
  const { data: byExtId } = await supabase.from('acmac1').select('*').eq('ext_id', NTPC_AMID);
  byExtId?.forEach(r => console.log(`  id=${r.id} acid=${r.acid} name="${r.name}" parent_id=${r.parent_id}`));
  console.log(`Total: ${byExtId?.length || 0}`);

  // 5. sum_table for NTPC amid=104519 in Saahil's portfolios
  console.log('\n=== SUM_TABLE: NTPC amid=104519 (all portfolios) ===');
  const { data: stAll } = await supabase.from('sum_table').select('*').eq('amid', NTPC_AMID);
  stAll?.forEach(r => console.log(`  pfolio_id=${r.pfolio_id} amid=${r.amid} qnt=${r.qnt} currv=${r.currv} amtinv=${r.amtinv}`));
  console.log(`Total: ${stAll?.length || 0}`);

  // 6. Saahil's portfolios
  console.log('\n=== ACC_PFLINK: Saahil (acid=31) portfolios ===');
  const { data: pflinks } = await supabase.from('acc_pflink').select('*').eq('acid', SAAHIL_ACID);
  pflinks?.forEach(r => console.log(`  pfid=${r.pfid}`));

  // 7. Check vouchers1 / vouchersC1 for NTPC in Saahil's account
  console.log('\n=== VOUCHERSC1: any NTPC-related voucher for acid=31 ===');
  const { data: vc1 } = await supabase.from('vouchersc1').select('*').eq('acid', SAAHIL_ACID).ilike('narr', '%NTPC%');
  vc1?.forEach(r => console.log(`  vid=${r.vid} narr="${r.narr}" dt="${r.dt}" vtyp=${r.vtyp}`));
  console.log(`Total: ${vc1?.length || 0}`);

  // 8. Check ALL vouchers with NTPC in narration for Saahil
  const { data: vc1All } = await supabase.from('vouchersc1').select('*').eq('acid', SAAHIL_ACID).order('vid', { ascending: false }).limit(5);
  console.log('\n=== VOUCHERSC1: last 5 vouchers for Saahil ===');
  vc1All?.forEach(r => console.log(`  vid=${r.vid} narr="${r.narr}" dt="${r.dt}" vtyp=${r.vtyp}`));

  // 9. Check transc1 for any recent entries with NTPC maid, any acid
  console.log('\n=== TRANSC1: any entry with maid in NTPC ledger ids (all acids) ===');
  const allNtpcIds = acmacAll?.map(r => r.id) || [];
  for (const maid of allNtpcIds) {
    const { data: tc } = await supabase.from('transc1').select('*').eq('maid', maid);
    if (tc && tc.length > 0) {
      console.log(`  maid=${maid}: ${tc.length} entries`);
      tc.forEach(r => console.log(`    transid=${r.transid} vid=${r.vid} dramt=${r.dramt} cramt=${r.cramt} dt="${r.dt}" acid=${r.acid}`));
    }
  }
}

main().catch(console.error);
