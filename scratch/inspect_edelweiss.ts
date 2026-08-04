import { supabase } from '../src/supabase';

async function main() {
  // Find ledger
  const { data: ledgers, error: lErr } = await supabase
    .from('acmac1')
    .select('id, name, acid')
    .ilike('name', '%Edelweiss%');
    
  if (lErr) {
    console.error("Error loading ledgers:", lErr);
    return;
  }
  
  console.log("Found ledgers:", ledgers);
  
  for (const l of ledgers || []) {
    // Load entries in trans1 / transc1 and their parent vouchers to get narration
    const { data: entries, error: eErr } = await supabase
      .from('trans1')
      .select('transid, dramt, cramt, dt, vid')
      .eq('maid', l.id);
      
    if (eErr) {
      console.error(`Error loading entries for ledger ${l.id}:`, eErr);
      continue;
    }
    
    console.log(`\nEntries for Ledger ID ${l.id} (${l.name}):`);
    for (const entry of entries || []) {
      const { data: voucher } = await supabase
        .from('vouchers1')
        .select('vid, narr, vtyp')
        .eq('vid', entry.vid)
        .single();
        
      console.log(`Entry: Date=${entry.dt}, Debit=${entry.dramt}, Credit=${entry.cramt}, VoucherID=${entry.vid}, Narration="${voucher?.narr}", Type=${voucher?.vtyp}`);
    }
    
    // Also check transc1 / vouchersc1
    const { data: entriesC, error: eErrC } = await supabase
      .from('transc1')
      .select('transid, dramt, cramt, dt, vid')
      .eq('maid', l.id);
      
    if (eErrC) {
      console.error(`Error loading entriesC for ledger ${l.id}:`, eErrC);
      continue;
    }
    
    console.log(`\nEntries (transc1) for Ledger ID ${l.id} (${l.name}):`);
    for (const entry of entriesC || []) {
      const { data: voucher } = await supabase
        .from('vouchersc1')
        .select('vid, narr, vtyp')
        .eq('vid', entry.vid)
        .single();
        
      console.log(`Entry (C): Date=${entry.dt}, Debit=${entry.dramt}, Credit=${entry.cramt}, VoucherID=${entry.vid}, Narration="${voucher?.narr}", Type=${voucher?.vtyp}`);
    }
  }
}

main().catch(console.error);
