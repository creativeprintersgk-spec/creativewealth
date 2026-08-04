import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
dotenv.config({ path: path.resolve(__dirname, '../.env') });

const supabase = createClient(process.env.VITE_SUPABASE_URL, process.env.VITE_SUPABASE_ANON_KEY);

async function run() {
  // Get last 5 vouchers from vouchersc1
  const { data: vouchers } = await supabase.from('vouchersc1').select('*').order('vid', { ascending: false }).limit(10);
  console.log('\n=== LAST 10 VOUCHERSC1 ===');
  vouchers?.forEach(v => console.log(`  vid=${v.vid} acid=${v.acid} pfid=${v.pfid} vtyp=${v.vtyp} dt=${v.dt} narr=${v.narr?.substring(0,40)}`));

  // Get last transc1 entries
  const { data: trans } = await supabase.from('transc1').select('*').order('transid', { ascending: false }).limit(20);
  console.log('\n=== LAST 20 TRANSC1 ===');
  trans?.forEach(t => console.log(`  transid=${t.transid} vid=${t.vid} acid=${t.acid} maid=${t.maid} dr=${t.dramt} cr=${t.cramt} dt=${t.dt}`));

  // Get dividend-type bs1 entries
  const { data: bs } = await supabase.from('bs1').select('*').eq('trty', 62).order('trid', { ascending: false }).limit(10);
  console.log('\n=== LAST 10 DIVIDEND BS1 (trty=62) ===');
  bs?.forEach(b => console.log(`  trid=${b.trid} pfid=${b.pfid} amid=${b.amid} amt=${b.amt} acvch=${b.acvch} dt=${b.dt}`));

  // Check acc_pflink for Anant Raj-related portfolios (pfid from dividend bs1)
  if (bs && bs.length > 0) {
    const pfids = [...new Set(bs.map(b => b.pfid))];
    const { data: links } = await supabase.from('acc_pflink').select('*').in('pfid', pfids);
    console.log('\n=== ACC_PFLINK for dividend portfolios ===');
    links?.forEach(l => console.log(`  pfid=${l.pfid} acid=${l.acid}`));

    // Check corresponding voucher's acid
    const vids = [...new Set(bs.filter(b => b.acvch).map(b => b.acvch))];
    if (vids.length > 0) {
      const { data: relVouchers } = await supabase.from('vouchersc1').select('*').in('vid', vids);
      console.log('\n=== LINKED VOUCHERS ===');
      relVouchers?.forEach(v => console.log(`  vid=${v.vid} acid=${v.acid} pfid=${v.pfid}`));

      // Check transc1 for these vids
      const { data: relTrans } = await supabase.from('transc1').select('*').in('vid', vids);
      console.log('\n=== TRANSC1 FOR LINKED VOUCHERS ===');
      relTrans?.forEach(t => console.log(`  transid=${t.transid} vid=${t.vid} acid=${t.acid} maid=${t.maid} dr=${t.dramt} cr=${t.cramt}`));

      // Check what ledger maid maps to
      if (relTrans && relTrans.length > 0) {
        const maids = [...new Set(relTrans.map(t => t.maid))];
        const { data: ledgers } = await supabase.from('acmac1').select('*').in('id', maids);
        console.log('\n=== ACMAC1 LEDGERS FOR TRANSC1 ===');
        ledgers?.forEach(l => console.log(`  id=${l.id} acid=${l.acid} name=${l.name} is_group=${l.is_group} parent_id=${l.parent_id}`));
      }
    }
  }
}

run().catch(console.error);
