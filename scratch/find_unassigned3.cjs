const { createClient } = require('@supabase/supabase-js');
const supabase = createClient(
  'https://ajjeoijjsklgkioxqkrb.supabase.co',
  'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImFqamVvaWpqc2tsZ2tpb3hxa3JiIiwicm9sZSI6ImFub24iLCJpYXQiOjE3Nzg0OTgyODMsImV4cCI6MjA5NDA3NDI4M30.3OM0q7_9Eiz_fqt3N4c08sxYtsofb3v50v1vLxKEgvI'
);

async function findOrphans() {
  // Get ALL transc1 rows (paginate)
  let allTc1 = [];
  let from = 0;
  const pageSize = 1000;
  while (true) {
    const { data } = await supabase
      .from('transc1')
      .select('transid, vid, ledger_id, debit, credit, dt, acid')
      .range(from, from + pageSize - 1);
    if (!data || data.length === 0) break;
    allTc1 = allTc1.concat(data);
    if (data.length < pageSize) break;
    from += pageSize;
  }
  console.log(`Total transc1 rows: ${allTc1.length}`);

  // Get all valid ledger IDs per acid
  const { data: allLedgers } = await supabase
    .from('acmac1')
    .select('id, name, acid, is_group')
    .eq('is_group', false);
  
  const ledgerMap = {};
  (allLedgers||[]).forEach(l => {
    const key = `${l.id}_${l.acid}`;
    ledgerMap[key] = l.name;
  });

  // Find transc1 where ledger_id+acid combo doesn't exist in acmac1
  const orphaned = allTc1.filter(t => {
    const key = `${t.ledger_id}_${t.acid}`;
    return !ledgerMap[key];
  });
  
  console.log(`\nOrphaned transc1 rows: ${orphaned.length}`);
  
  // Group by ledger_id and sum
  const byLedger = {};
  orphaned.forEach(t => {
    const k = `ledger${t.ledger_id}_acid${t.acid}`;
    if (!byLedger[k]) byLedger[k] = { ledger_id: t.ledger_id, acid: t.acid, total: 0, rows: [] };
    byLedger[k].total += (t.debit || 0) - (t.credit || 0);
    byLedger[k].rows.push(t);
  });
  
  // Total across all orphans
  let grandTotal = 0;
  for (const [k, v] of Object.entries(byLedger)) {
    grandTotal += v.total;
    console.log(`  ledger_id=${v.ledger_id} acid=${v.acid} TOTAL=${v.total.toFixed(2)} (${v.rows.length} rows)`);
    v.rows.slice(0, 3).forEach(r => {
      console.log(`    transid=${r.transid} vid=${r.vid} debit=${r.debit} credit=${r.credit} dt=${r.dt}`);
    });
  }
  console.log(`\nGrand total of orphaned balances: ${grandTotal.toFixed(2)}`);

  // Also check: what does the balance sheet "Suspense/Unassigned" group map to in code?
  // The ₹47,072.13 - let's find transc1 rows with those values
  const nearTarget = allTc1.filter(t => Math.abs((t.debit||0) - (t.credit||0)) > 40000 && Math.abs((t.debit||0) - (t.credit||0)) < 50000);
  console.log('\nTransc1 rows with net near ₹47,072:', JSON.stringify(nearTarget, null, 2));
  
  // Check transc1 around the CN import date
  const cnRows = allTc1.filter(t => t.dt === '2026-08-11');
  console.log(`\nTransc1 rows on 2026-08-11 (CN date): ${cnRows.length}`);
  cnRows.forEach(t => {
    const name = ledgerMap[`${t.ledger_id}_${t.acid}`] || `[ORPHAN ledger_id=${t.ledger_id}]`;
    console.log(`  transid=${t.transid} vid=${t.vid} ledger_id=${t.ledger_id} [${name}] debit=${t.debit} credit=${t.credit} acid=${t.acid}`);
  });
}

findOrphans().catch(console.error);
