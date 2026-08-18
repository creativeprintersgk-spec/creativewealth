const { createClient } = require('@supabase/supabase-js');
const supabase = createClient(
  'https://ajjeoijjsklgkioxqkrb.supabase.co',
  'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImFqamVvaWpqc2tsZ2tpb3hxa3JiIiwicm9sZSI6ImFub24iLCJpYXQiOjE3Nzg0OTgyODMsImV4cCI6MjA5NDA3NDI4M30.3OM0q7_9Eiz_fqt3N4c08sxYtsofb3v50v1vLxKEgvI'
);

async function findUnassigned() {
  // Check vouchersc1 for any vouchers with narration "Unassigned"
  const { data: v1 } = await supabase
    .from('vouchersc1')
    .select('vid, narr, dt, acid, tamt')
    .ilike('narr', '%unassigned%');
  console.log('vouchersc1 unassigned:', JSON.stringify(v1, null, 2));

  // Check vouchers1
  const { data: v2 } = await supabase
    .from('vouchers1')
    .select('vid, narr, dt, acid, tamt')
    .ilike('narr', '%unassigned%');
  console.log('vouchers1 unassigned:', JSON.stringify(v2, null, 2));
  
  // Check if ₹47,072.13 is in any voucher amount
  const { data: v3 } = await supabase
    .from('vouchersc1')
    .select('vid, narr, dt, acid, tamt')
    .gte('tamt', 47000)
    .lte('tamt', 48000);
  console.log('vouchersc1 near 47072:', JSON.stringify(v3, null, 2));

  // The balance sheet is computed by the frontend logic.ts - let's look at BalanceSheet.tsx
  // to understand how "Suspense / Unassigned" group is computed
  
  // Check the actual sum of all accounts: do all transc1 + vouchersc1 transactions balance?
  const { data: allVc1 } = await supabase
    .from('vouchersc1')
    .select('vid, narr, dt, acid, tamt')
    .order('dt', { ascending: false })
    .limit(10);
  console.log('\nLatest 10 vouchersc1:', JSON.stringify(allVc1, null, 2));

  // Check what tables actually hold the accounting data since transc1 returned 0 rows
  const { data: tc1Count } = await supabase
    .from('transc1')
    .select('transid', { count: 'exact' });
  console.log('\ntransc1 count check:', tc1Count);
  
  // Try with explicit select
  const { data: anyTc1, error } = await supabase.from('transc1').select('*').limit(5);
  console.log('transc1 any rows:', JSON.stringify(anyTc1), 'error:', error);
  
  // Also check trans1
  const { data: anyT1, error: e2 } = await supabase.from('trans1').select('*').limit(5);
  console.log('trans1 any rows:', JSON.stringify(anyT1), 'error:', e2);
}

findUnassigned().catch(console.error);
