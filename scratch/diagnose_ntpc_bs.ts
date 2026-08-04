/**
 * Find why NTPC Limited shows ₹14,075.25 in BS but 0 in ledger drill-down
 * Check acmac1 id=503134/503136, sum_table, and bs1 for NTPC amid=104519
 */
import { createClient } from '@supabase/supabase-js';
import * as dotenv from 'dotenv';
dotenv.config();

const supabase = createClient(
  process.env.VITE_SUPABASE_URL!,
  process.env.VITE_SUPABASE_ANON_KEY!
);

async function main() {
  console.log('=== WHY NTPC SHOWS 14075.25 IN BS BUT 0 IN LEDGER ===\n');

  // 1. What are acmac1 id=503130 to 503140? (recently created ledgers)
  console.log('=== ACMAC1 entries id 503130-503140 ===');
  const { data: recentLedgers } = await supabase
    .from('acmac1').select('*')
    .gte('id', 503130).lte('id', 503140);
  recentLedgers?.forEach(r =>
    console.log(`  id=${r.id} acid=${r.acid} name="${r.name}" parent_id=${r.parent_id} is_group=${r.is_group} ext_id=${r.ext_id}`)
  );

  // 2. Is there a transc1 entry with maid=104519 (NTPC Ltd acmac1 id)?
  console.log('\n=== TRANSC1 where maid=104519 (NTPC Limited acmac1 id) ===');
  const { data: tc1Ntpc } = await supabase.from('transc1').select('*').eq('maid', 104519).order('transid', { ascending: false }).limit(10);
  tc1Ntpc?.forEach(r => console.log(`  transid=${r.transid} vid=${r.vid} dramt=${r.dramt} cramt=${r.cramt} dt="${r.dt}"`));
  console.log(`Total: ${tc1Ntpc?.length || 0}`);

  // 3. Is there a sum_table entry for NTPC amid=104519 in portfolio 1?
  console.log('\n=== SUM_TABLE for amid=104519 (NTPC Limited) ===');
  const { data: sumNtpc } = await supabase.from('sum_table').select('*').eq('amid', 104519);
  sumNtpc?.forEach(r => console.log(`  sid=${r.sid} pfolio_id=${r.pfolio_id} qnt=${r.qnt} amtinv=${r.amtinv} currv=${r.currv}`));
  console.log(`Total: ${sumNtpc?.length || 0}`);

  // 4. Is there a bs1 entry for NTPC amid=104519 with non-null acvch (from our new CN imports)?
  console.log('\n=== BS1 entries for amid=104519 with non-null acvch (recently created via CN import) ===');
  const { data: bs1Ntpc } = await supabase.from('bs1').select('*').eq('amid', 104519).not('acvch', 'is', null);
  bs1Ntpc?.forEach(r => console.log(`  trid=${r.trid} pfid=${r.pfid} acvch=${r.acvch} cnid=${r.cnid} trstr="${r.trstr}" qn=${r.qn} amt=${r.amt} dt="${r.dt}"`));
  console.log(`Total: ${bs1Ntpc?.length || 0}`);

  // 5. Check all bs1 entries for amid=104519
  console.log('\n=== ALL BS1 entries for amid=104519 ===');
  const { data: bs1AllNtpc } = await supabase.from('bs1').select('*').eq('amid', 104519).order('trid', { ascending: false });
  bs1AllNtpc?.forEach(r => console.log(`  trid=${r.trid} pfid=${r.pfid} acvch=${r.acvch} cnid=${r.cnid} trstr="${r.trstr}" qn=${r.qn} amt=${r.amt} dt="${r.dt}"`));
  console.log(`Total: ${bs1AllNtpc?.length || 0}`);

  // 6. What does acmac1 id=503136 say? (the ledger created during ETF import)
  console.log('\n=== ACMAC1 id=503136 (ledger from ETF import) ===');
  const { data: ledger503136 } = await supabase.from('acmac1').select('*').eq('id', 503136);
  ledger503136?.forEach(r => console.log(`  id=${r.id} acid=${r.acid} name="${r.name}" parent_id=${r.parent_id} ext_id=${r.ext_id}`));

  // 7. Check transc1 for maid=503136 (the ETF transc1 entry)
  console.log('\n=== TRANSC1 where maid=503136 (ETF ledger) ===');
  const { data: tc1Etf } = await supabase.from('transc1').select('*').eq('maid', 503136);
  tc1Etf?.forEach(r => console.log(`  transid=${r.transid} vid=${r.vid} dramt=${r.dramt} cramt=${r.cramt} dt="${r.dt}"`));

  // 8. What does acmac1 id=503134 say? (ledger from FIRST import attempt - vid=13352, now deleted)
  console.log('\n=== ACMAC1 id=503134 (ledger from DELETED vid=13352 import) ===');
  const { data: ledger503134 } = await supabase.from('acmac1').select('*').eq('id', 503134);
  ledger503134?.forEach(r => console.log(`  id=${r.id} acid=${r.acid} name="${r.name}" parent_id=${r.parent_id} ext_id=${r.ext_id}`));

  // 9. Check transc1 for maid=503134 (should be 0 after our cleanup)
  console.log('\n=== TRANSC1 where maid=503134 (DELETED ETF ledger) ===');
  const { data: tc1Old } = await supabase.from('transc1').select('*').eq('maid', 503134);
  console.log(`Count: ${tc1Old?.length || 0}`);
  tc1Old?.forEach(r => console.log(`  transid=${r.transid} vid=${r.vid} dramt=${r.dramt} cramt=${r.cramt}`));

  // 10. All acmac1 with id >= 500000 (all recently auto-created ledgers)
  console.log('\n=== ALL ACMAC1 with id >= 500000 (auto-created via imports) ===');
  const { data: newLedgers } = await supabase.from('acmac1').select('*').gte('id', 500000).order('id');
  newLedgers?.forEach(r => console.log(`  id=${r.id} acid=${r.acid} name="${r.name}" parent_id=${r.parent_id}`));
  console.log(`Total: ${newLedgers?.length || 0}`);

  // 11. Check BalanceSheet source - does BalanceSheet read from bs1 market value OR transc1 ledger balance?
  // The BS showing 14075.25 for NTPC must be from transc1 for some maid that maps to "NTPC Limited" in acmac1
  // OR from bs1/sum_table current value for NTPC
  
  // Let's check: what is the current price for NTPC amid=104519?
  const { data: priceNtpc } = await supabase.from('mprices').select('*').eq('amid', 104519).limit(1);
  console.log('\n=== MPRICES for NTPC amid=104519 ===');
  priceNtpc?.forEach(r => console.log(`  amid=${r.amid} currp=${r.currp} prevp=${r.prevp}`));

  // 12. Calculate: sum_table qnt * currp for NTPC
  const sumNtpcRow = sumNtpc?.[0];
  const price = priceNtpc?.[0]?.currp || 0;
  if (sumNtpcRow) {
    const val = sumNtpcRow.qnt * price;
    console.log(`\n  NTPC sum_table: qnt=${sumNtpcRow.qnt} * price=${price} = currv=${val} (stored currv=${sumNtpcRow.currv})`);
  }

  console.log('\n=== DIAGNOSIS COMPLETE ===');
}

main().catch(console.error);
