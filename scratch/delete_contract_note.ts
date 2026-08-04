import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';

dotenv.config();

const supabase = createClient(process.env.VITE_SUPABASE_URL, process.env.VITE_SUPABASE_ANON_KEY);

async function deleteContractNote(cnNo: string) {
  console.log(`Checking for contract note: ${cnNo}`);

  // 1. Delete from scnote1
  const { data: scnoteData, error: scnoteErr } = await supabase
    .from('scnote1')
    .delete()
    .ilike('cnnum', cnNo)
    .select();
    
  if (scnoteErr) console.error('Error deleting from scnote1:', scnoteErr);
  else console.log(`Deleted ${scnoteData?.length || 0} rows from scnote1`);

  // 2. Find vouchers matching this contract note in narration
  const { data: v1Data } = await supabase
    .from('vouchers1')
    .select('vid')
    .ilike('narr', `%no: ${cnNo}%`);
    
  const v1Ids = v1Data?.map(v => v.vid) || [];
  
  const { data: vc1Data } = await supabase
    .from('vouchersc1')
    .select('vid')
    .ilike('narr', `%no: ${cnNo}%`);
    
  const vc1Ids = vc1Data?.map(v => v.vid) || [];

  console.log(`Found vouchers: Vouchers1 (${v1Ids.length}), VouchersC1 (${vc1Ids.length})`);

  // 3. Delete from trans1, transc1, bs1 using the found vids
  if (v1Ids.length > 0) {
    await supabase.from('trans1').delete().in('vid', v1Ids);
    await supabase.from('bs1').delete().in('acvch', v1Ids);
    await supabase.from('vouchers1').delete().in('vid', v1Ids);
    console.log(`Deleted trans1, bs1, and vouchers1 for vid(s): ${v1Ids.join(', ')}`);
  }

  if (vc1Ids.length > 0) {
    await supabase.from('transc1').delete().in('vid', vc1Ids);
    await supabase.from('bs1').delete().in('acvch', vc1Ids);
    await supabase.from('vouchersc1').delete().in('vid', vc1Ids);
    console.log(`Deleted transc1, bs1, and vouchersc1 for vid(s): ${vc1Ids.join(', ')}`);
  }

  console.log('Deletion process complete!');
}

const args = process.argv.slice(2);
if (args.length === 0) {
  console.log('Usage: npx tsx scratch/delete_contract_note.ts <CONTRACT_NOTE_NUMBER>');
} else {
  deleteContractNote(args[0]);
}
