import { initDatabase, getStoredVouchers, getStoredEntries } from '../src/logic';
import { supabase } from '../src/supabase';

async function main() {
  await initDatabase();
  
  // Let's get a few rows of bs1
  const { data: bs1Rows } = await supabase.from('bs1').select('*').limit(20);
  console.log('BS1 sample rows:');
  bs1Rows?.forEach(r => {
    console.log(`trid=${r.trid}, pfid=${r.pfid}, amid=${r.amid}, trty=${r.trty}, acvch="${r.acvch}", dt=${r.dt}, amt=${r.amt}`);
  });

  // Let's check how we can find a voucher for a given bs1 row
  // We want to edit a trade (bs1 row) by loading the voucher it belongs to
  if (bs1Rows && bs1Rows.length > 0) {
    const firstRow = bs1Rows[0];
    console.log(`\nInspecting first row: trid=${firstRow.trid}, acvch="${firstRow.acvch}"`);
    // Let's search vouchers with this acvch
    // Is there a vouchers1 or vouchersc1 row where vid matches the numeric part of acvch?
    // Let's extract the numeric part from acvch (e.g. "c_123" -> 123, or if it is just a number)
    const match = String(firstRow.acvch).match(/\d+/);
    if (match) {
      const vid = Number(match[0]);
      console.log(`Extracted number from acvch: ${vid}`);
      const { data: vchC1 } = await supabase.from('vouchersc1').select('*').eq('vid', vid);
      const { data: vch1 } = await supabase.from('vouchers1').select('*').eq('vid', vid);
      console.log(`Matching vouchersc1 count: ${vchC1?.length}, vouchers1 count: ${vch1?.length}`);
    }
  }
}

main().catch(console.error);
