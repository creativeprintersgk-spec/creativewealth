const { createClient } = require('@supabase/supabase-js');
const supabase = createClient(
  'https://ajjeoijjsklgkioxqkrb.supabase.co',
  'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImFqamVvaWpqc2tsZ2tpb3hxa3JiIiwicm9sZSI6ImFub24iLCJpYXQiOjE3Nzg0OTgyODMsImV4cCI6MjA5NDA3NDI4M30.3OM0q7_9Eiz_fqt3N4c08sxYtsofb3v50v1vLxKEgvI'
);

async function findSuspense() {
  // The balance sheet uses state.entries (which maps to vouchersC1+transC1 lines stored in memory)
  // acmac1 uses: maid = ledger ID, special_account = group ID (or -1 for normal)
  
  // The balance sheet code uses entries where ledgerId refers to an acmac1.id
  // But it found entries with ledgerIds that don't exist in the current account's acmac1
  
  // The CN voucher lines use ledger IDs that may be from a different account's acmac1
  
  // Let's find the CN vouchers and their transc1 lines
  const { data: cnVouchers } = await supabase
    .from('vouchersc1')
    .select('vid, narr, dt, acid, tamt')
    .ilike('narr', '%77026007%');
  console.log('CN Vouchers:', JSON.stringify(cnVouchers, null, 2));

  // Now find transc1 lines for these vouchers
  const vids = (cnVouchers||[]).map(v => v.vid);
  console.log('Voucher IDs:', vids);

  if (vids.length > 0) {
    const { data: tc1Lines } = await supabase
      .from('transc1')
      .select('transid, vid, maid, cramt, dramt, special_account, acid')
      .in('vid', vids);
    console.log('\nTransc1 lines for CN voucher:', JSON.stringify(tc1Lines, null, 2));
    
    // Check if these maid values exist in acmac1 for the correct acid
    const maids = [...new Set((tc1Lines||[]).map(t => t.maid))];
    console.log('\nMAIDs used in CN transc1:', maids);
    
    for (const maid of maids) {
      const { data: ledger } = await supabase
        .from('acmac1')
        .select('id, name, acid, parent_id, is_group')
        .eq('id', maid);
      console.log(`  maid=${maid}:`, JSON.stringify(ledger));
    }
  }
  
  // Also check the CN-created ledgers (high ID from ensureAssetLedgerExists)
  const { data: highLedgers } = await supabase
    .from('acmac1')
    .select('id, name, acid, parent_id, is_group')
    .gte('id', 500000)
    .order('id', { ascending: false })
    .limit(30);
  console.log('\nacmac1 with id >= 500000 (auto-created from CN):', JSON.stringify(highLedgers, null, 2));
  
  // The balance ₹47,072.13 - find transc1 where the maid is one of these high IDs  
  if (highLedgers && highLedgers.length > 0) {
    const highIds = highLedgers.map(l => l.id);
    const { data: highTxns } = await supabase
      .from('transc1')
      .select('transid, vid, maid, cramt, dramt, special_account, acid, dt')
      .in('maid', highIds)
      .order('dt', { ascending: false });
    console.log('\ntransc1 rows with auto-created ledger IDs:', JSON.stringify(highTxns, null, 2));
  }
}

findSuspense().catch(console.error);
