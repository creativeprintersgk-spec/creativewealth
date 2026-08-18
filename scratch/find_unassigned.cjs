const { createClient } = require('@supabase/supabase-js');
const supabase = createClient(
  'https://ajjeoijjsklgkioxqkrb.supabase.co',
  'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImFqamVvaWpqc2tsZ2tpb3hxa3JiIiwicm9sZSI6ImFub24iLCJpYXQiOjE3Nzg0OTgyODMsImV4cCI6MjA5NDA3NDI4M30.3OM0q7_9Eiz_fqt3N4c08sxYtsofb3v50v1vLxKEgvI'
);

async function findUnassigned() {
  // 1. Find ledgers with "unassigned" or "suspense" in name
  const { data: ledgers } = await supabase
    .from('acmac1')
    .select('id, name, parent_id, acid, is_group')
    .ilike('name', '%unassigned%');
  console.log('Unassigned ledgers:', JSON.stringify(ledgers, null, 2));

  // 2. Find parent group
  const { data: suspense } = await supabase
    .from('acmac1')
    .select('id, name, parent_id, acid, is_group')
    .ilike('name', '%suspense%');
  console.log('Suspense ledgers:', JSON.stringify(suspense, null, 2));

  // 3. Check transc1 entries for these ledger IDs
  if (ledgers && ledgers.length > 0) {
    for (const l of ledgers) {
      const { data: txns } = await supabase
        .from('transc1')
        .select('transid, vid, ledger_id, debit, credit, narr, dt')
        .eq('ledger_id', l.id)
        .order('dt', { ascending: false })
        .limit(20);
      console.log(`\nTransactions for ledger id=${l.id} "${l.name}":`, JSON.stringify(txns, null, 2));
    }
  }

  // 4. Also check trans1 (trading transactions)
  if (ledgers && ledgers.length > 0) {
    for (const l of ledgers) {
      const { data: txns } = await supabase
        .from('trans1')
        .select('transid, vid, ledger_id, debit, credit, narr, dt')
        .eq('ledger_id', l.id)
        .limit(20);
      console.log(`\nTrans1 for ledger id=${l.id} "${l.name}":`, JSON.stringify(txns, null, 2));
    }
  }
}

findUnassigned().catch(console.error);
