/**
 * Check CN CNT-26/27-31957379 - imported 3 times (vid=13352,13353,13354)
 * Find all bs1, transc1 entries linked to these vids and fix the orphans
 */
import { createClient } from '@supabase/supabase-js';
import * as dotenv from 'dotenv';
dotenv.config();

const supabase = createClient(
  process.env.VITE_SUPABASE_URL!,
  process.env.VITE_SUPABASE_ANON_KEY!
);

async function getAssetName(amid: number) {
  const { data } = await supabase.from('sam').select('anm').eq('amid', amid).limit(1);
  if (data?.[0]) return data[0].anm;
  const { data: am } = await supabase.from('asset_master').select('name').eq('amid', amid).limit(1);
  return am?.[0]?.name || `amid=${amid}`;
}

async function main() {
  console.log('=== CN CNT-26/27-31957379 DUPLICATE INVESTIGATION ===\n');

  const cnNo = 'CNT-26/27-31957379';
  const vids = [13352, 13353, 13354];

  for (const vid of vids) {
    console.log(`\n--- VID=${vid} ---`);
    
    // Voucher header
    const { data: vsc } = await supabase.from('vouchersc1').select('*').eq('vid', vid);
    const { data: v1 } = await supabase.from('vouchers1').select('*').eq('vid', vid);
    console.log('Vouchersc1:', vsc?.[0] ? `acid=${vsc[0].acid} pfid=${vsc[0].pfid} cnid=${vsc[0].cnid} narr="${vsc[0].narr}" dt="${vsc[0].dt}"` : 'NOT FOUND');
    console.log('Vouchers1:', v1?.[0] ? `acid=${v1[0].acid} cnid=${v1[0].cnid} narr="${v1[0].narr}" dt="${v1[0].dt}"` : 'NOT FOUND');

    // Transc1 entries (drive BS)
    const { data: tc1 } = await supabase.from('transc1').select('*').eq('vid', vid);
    console.log(`Transc1 entries: ${tc1?.length || 0}`);
    for (const r of (tc1 || [])) {
      console.log(`  transid=${r.transid} maid=${r.maid} dramt=${r.dramt} cramt=${r.cramt}`);
    }

    // BS1 entries (portfolio transactions)
    const { data: bs1 } = await supabase.from('bs1').select('*').eq('acvch', vid);
    console.log(`BS1 entries: ${bs1?.length || 0}`);
    for (const r of (bs1 || [])) {
      const name = await getAssetName(r.amid);
      console.log(`  trid=${r.trid} amid=${r.amid} "${name}" trstr="${r.trstr}" qn=${r.qn} amt=${r.amt} dt="${r.dt}"`);
    }
  }

  // What's in sum_table for this portfolio?
  console.log('\n=== SUM_TABLE for pfid=1 (all assets) ===');
  const { data: sumRows } = await supabase.from('sum_table').select('*').eq('pfolio_id', 1).order('sid');
  for (const r of (sumRows || [])) {
    if (r.qnt > 0 || r.amtinv > 0) {
      const name = await getAssetName(r.amid);
      console.log(`  sid=${r.sid} amid=${r.amid} "${name}" qnt=${r.qnt} amtinv=${r.amtinv}`);
    }
  }

  // What does the BS show for pfid=1's broker ledger?
  // The NTPC sell goes to: stock ledger (credit) + broker (debit, money received)
  // Find the broker ledger for acid=100007 or acid=31
  console.log('\n=== CHECKING FOR DUPLICATE TRANSC1 for maid 100007 (Zerodha broker?) ===');
  const { data: zerodha } = await supabase.from('acmac1').select('*').ilike('name', '%zerodha%');
  console.log('Zerodha ledgers:', zerodha?.map(r => `id=${r.id} acid=${r.acid} name="${r.name}"`));
  
  if (zerodha && zerodha.length > 0) {
    for (const z of zerodha) {
      const { data: tc1 } = await supabase.from('transc1').select('*').eq('maid', z.id).order('transid', { ascending: false }).limit(20);
      if (tc1 && tc1.length > 0) {
        console.log(`\nTransc1 for Zerodha maid=${z.id} (acid=${z.acid}) - ${tc1.length} entries:`);
        tc1.forEach(r => console.log(`  transid=${r.transid} vid=${r.vid} dramt=${r.dramt} cramt=${r.cramt} dt="${r.dt}"`));
      }
    }
  }

  // Also check what maid=122865 is (the NTPC in the sell from trid=15951)
  console.log('\n=== What is amid=122865 (the NTPC sell in trid=15951)? ===');
  const name = await getAssetName(122865);
  console.log(`amid=122865 = "${name}"`);
  
  const { data: acmacNtpc } = await supabase.from('acmac1').select('*').eq('id', 122865);
  console.log('ACMAC1 entries:', acmacNtpc?.map(r => `id=${r.id} acid=${r.acid} name="${r.name}" parent_id=${r.parent_id}`));

  const { data: tc1Ntpc } = await supabase.from('transc1').select('*').eq('maid', 122865).order('transid', { ascending: false });
  console.log(`Transc1 for maid=122865: ${tc1Ntpc?.length || 0} entries`);
  tc1Ntpc?.forEach(r => console.log(`  transid=${r.transid} vid=${r.vid} acid=${r.acid} dramt=${r.dramt} cramt=${r.cramt} dt="${r.dt}"`));

  console.log('\n=== INVESTIGATION COMPLETE ===');
}

main().catch(console.error);
