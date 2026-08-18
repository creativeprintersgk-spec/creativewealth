const { createClient } = require('@supabase/supabase-js');
const supabase = createClient(
  'https://ajjeoijjsklgkioxqkrb.supabase.co',
  'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImFqamVvaWpqc2tsZ2tpb3hxa3JiIiwicm9sZSI6ImFub24iLCJpYXQiOjE3Nzg0OTgyODMsImV4cCI6MjA5NDA3NDI4M30.3OM0q7_9Eiz_fqt3N4c08sxYtsofb3v50v1vLxKEgvI'
);

async function deepFind() {
  // The balance sheet shows ₹47,072.13 in Suspense/Unassigned
  // The "Unassigned Ledger" label in the UI is a fallback for ledgers with no name match
  
  // Let's check ALL transc1 entries where the ledger_id doesn't exist in acmac1
  // i.e., orphaned transaction lines
  
  // First, get all unique ledger_ids from transc1
  const { data: tc1, count } = await supabase
    .from('transc1')
    .select('transid, vid, ledger_id, debit, credit, dt, acid')
    .order('dt', { ascending: false })
    .limit(500);
  
  console.log(`Total transc1 rows fetched: ${(tc1||[]).length}`);
  
  // Get all ledger IDs from acmac1
  const { data: allLedgers } = await supabase
    .from('acmac1')
    .select('id, name, acid')
    .eq('is_group', false);
  
  const ledgerIdSet = new Set((allLedgers||[]).map(l => l.id));
  const ledgerMap = {};
  (allLedgers||[]).forEach(l => { ledgerMap[l.id] = l.name; });
  
  // Find transc1 rows where ledger_id is NOT in acmac1
  const orphaned = (tc1||[]).filter(t => !ledgerIdSet.has(t.ledger_id));
  console.log(`\nOrphaned transc1 rows (ledger_id not in acmac1): ${orphaned.length}`);
  if (orphaned.length > 0) {
    let total = 0;
    orphaned.forEach(t => {
      const net = (t.debit || 0) - (t.credit || 0);
      total += net;
      console.log(`  transid=${t.transid} vid=${t.vid} ledger_id=${t.ledger_id} debit=${t.debit} credit=${t.credit} dt=${t.dt}`);
    });
    console.log(`  TOTAL NET: ${total}`);
  }
  
  // Also: what's the biggest balances in transc1 by ledger_id for unrecognized ledgers?
  const bigOrphans = {};
  (tc1||[]).forEach(t => {
    if (!ledgerIdSet.has(t.ledger_id)) {
      if (!bigOrphans[t.ledger_id]) bigOrphans[t.ledger_id] = 0;
      bigOrphans[t.ledger_id] += (t.debit || 0) - (t.credit || 0);
    }
  });
  
  if (Object.keys(bigOrphans).length > 0) {
    console.log('\nOrphaned ledger balances:', JSON.stringify(bigOrphans));
  }

  // Check the balance sheet's "Suspense / Unassigned" group (parent_id 155)
  const { data: grp155 } = await supabase
    .from('acmac1')
    .select('id, name, parent_id, acid, is_group')
    .eq('parent_id', 155);
  console.log('\nChildren of parent_id=155 (Suspense group):', JSON.stringify(grp155, null, 2));

  // What's the balance sheet group structure around 47,072.13?
  // The UI shows "Unassigned Ledger" - check if there's a ledger literally named that
  const { data: ul } = await supabase
    .from('acmac1')
    .select('id, name, parent_id, acid, is_group')
    .ilike('name', 'Unassigned Ledger');
  console.log('\n"Unassigned Ledger" ledgers:', JSON.stringify(ul, null, 2));
  
  // Look for ledger_ids in transc1 that match very high numbers (auto-created during CN import?)
  const { data: highIdTxns } = await supabase
    .from('transc1')
    .select('transid, vid, ledger_id, debit, credit, dt, acid')
    .gte('ledger_id', 400000)
    .order('ledger_id', { ascending: false })
    .limit(30);
  console.log('\ntransc1 with ledger_id >= 400000:', JSON.stringify(highIdTxns, null, 2));
}

deepFind().catch(console.error);
