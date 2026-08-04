/**
 * Check: any recently auto-created acmac1 ledger for acid=31 (Saahil)
 * with id > 503000 (created by import), and check delete logic gap in state.acmac1
 */
import 'dotenv/config';
import { createClient } from '@supabase/supabase-js';

const supabase = createClient(
  process.env.VITE_SUPABASE_URL!,
  process.env.VITE_SUPABASE_ANON_KEY!
);

async function main() {
  // 1. Any new auto-created acmac1 for Saahil (acid=31) with id > 503000
  console.log('=== NEW acmac1 for acid=31 (Saahil), id > 503000 ===');
  const { data: newRows } = await supabase.from('acmac1').select('*')
    .eq('acid', 31).gte('id', 503000).order('id');
  newRows?.forEach(r => console.log(`  id=${r.id} name="${r.name}" parent_id=${r.parent_id} ext_id=${r.ext_id}`));
  console.log(`Total: ${newRows?.length || 0}`);

  // 2. Any acmac1 for acid=31, id > 500000 (all auto-created)
  console.log('\n=== ALL auto-created acmac1 for acid=31 (Saahil), id > 500000 ===');
  const { data: allNew } = await supabase.from('acmac1').select('*')
    .eq('acid', 31).gte('id', 500000).order('id');
  allNew?.forEach(r => console.log(`  id=${r.id} name="${r.name}" parent_id=${r.parent_id} ext_id=${r.ext_id}`));
  console.log(`Total: ${allNew?.length || 0}`);

  // 3. Check transc1 for Saahil recent entries (after 2026-01-01) — any NTPC buy entry
  console.log('\n=== TRANSC1: recent entries for acid=31 after 2026-01-01 ===');
  const { data: recentTrans } = await supabase.from('transc1').select('*')
    .eq('acid', 31).gte('dt', '2026-01-01').order('dt', { ascending: false });
  recentTrans?.forEach(r => console.log(`  transid=${r.transid} vid=${r.vid} maid=${r.maid} dramt=${r.dramt} cramt=${r.cramt} dt="${r.dt}"`));
  console.log(`Total: ${recentTrans?.length || 0}`);

  // 4. Check vouchersc1 for Saahil recent entries (after 2026-01-01)
  console.log('\n=== VOUCHERSC1: recent entries for acid=31 after 2026-01-01 ===');
  const { data: recentVouchers } = await supabase.from('vouchersc1').select('*')
    .eq('acid', 31).gte('dt', '2026-01-01').order('dt', { ascending: false });
  recentVouchers?.forEach(r => console.log(`  vid=${r.vid} narr="${r.narr}" dt="${r.dt}" vtyp=${r.vtyp}`));
  console.log(`Total: ${recentVouchers?.length || 0}`);

  // 5. Check if there's any BS1 entry for NTPC amid=104519 in Saahil's portfolios
  console.log('\n=== BS1: any row for amid=104519 (NTPC) in Saahil portfolios ===');
  const { data: bs1Rows } = await supabase.from('bs1').select('*').eq('amid', 104519);
  bs1Rows?.forEach(r => console.log(`  trid=${r.trid} pfid=${r.pfid} amid=${r.amid} qnt=${r.qnt} dt="${r.dt}" ttyp=${r.ttyp}`));
  console.log(`Total: ${bs1Rows?.length || 0}`);

  // 6. The acmac1 for SAAHIL - what's the highest id?
  console.log('\n=== Highest acmac1 id for acid=31 ===');
  const { data: maxRow } = await supabase.from('acmac1').select('id').eq('acid', 31).order('id', { ascending: false }).limit(1);
  console.log(`Max id for acid=31: ${maxRow?.[0]?.id}`);

  // 7. Global max acmac1 id
  const { data: globalMax } = await supabase.from('acmac1').select('id').order('id', { ascending: false }).limit(1);
  console.log(`Global max acmac1 id: ${globalMax?.[0]?.id}`);
}

main().catch(console.error);
