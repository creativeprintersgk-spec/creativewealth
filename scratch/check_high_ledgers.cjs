const { createClient } = require('@supabase/supabase-js');
const supabase = createClient(
  'https://ajjeoijjsklgkioxqkrb.supabase.co',
  'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImFqamVvaWpqc2tsZ2tpb3hxa3JiIiwicm9sZSI6ImFub24iLCJpYXQiOjE3Nzg0OTgyODMsImV4cCI6MjA5NDA3NDI4M30.3OM0q7_9Eiz_fqt3N4c08sxYtsofb3v50v1vLxKEgvI'
);

async function checkHighLedgers() {
  // Find acmac1 entries with id >= 500000 - these are auto-created by WealthCore
  const { data: allHigh } = await supabase
    .from('acmac1')
    .select('id, name, acid, parent_id, is_group')
    .gte('id', 500000)
    .order('id', { ascending: true });
  
  console.log(`High-ID ledgers in acmac1 (id >= 500000): ${(allHigh||[]).length}`);
  (allHigh||[]).forEach(l => {
    console.log(`  id=${l.id} name="${l.name}" acid=${l.acid} parent=${l.parent_id}`);
  });

  // Now compute the net balance per high-ID ledger from transc1
  const highIds = (allHigh||[]).map(l => l.id);
  
  const { data: txns } = await supabase
    .from('transc1')
    .select('transid, vid, maid, cramt, dramt, acid, dt')
    .in('maid', highIds)
    .order('maid', { ascending: true });
  
  // Sum per maid
  const balances = {};
  (txns||[]).forEach(t => {
    if (!balances[t.maid]) balances[t.maid] = { dr: 0, cr: 0, acid: t.acid };
    balances[t.maid].dr += t.dramt || 0;
    balances[t.maid].cr += t.cramt || 0;
  });
  
  console.log('\nNet balances for high-ID ledgers:');
  let totalUnassigned = 0;
  for (const [maid, bal] of Object.entries(balances)) {
    const net = bal.dr - bal.cr;
    const ledger = (allHigh||[]).find(l => l.id == maid);
    totalUnassigned += net;
    console.log(`  maid=${maid} name="${ledger?.name||'?'}" acid=${ledger?.acid||'?'} DR=${bal.dr.toFixed(2)} CR=${bal.cr.toFixed(2)} NET=${net.toFixed(2)}`);
  }
  console.log(`\n  TOTAL NET of all high-ID ledgers: ${totalUnassigned.toFixed(2)}`);
  
  // Find: which high-ID ledgers are used in transc1 for an acid that doesn't own them?
  const mismatches = (txns||[]).filter(t => {
    const ledger = (allHigh||[]).find(l => l.id === t.maid);
    return ledger && ledger.acid !== t.acid;
  });
  console.log(`\nCross-account mismatches (transc1.acid != acmac1.acid): ${mismatches.length}`);
  mismatches.slice(0, 10).forEach(t => {
    const ledger = (allHigh||[]).find(l => l.id === t.maid);
    console.log(`  transid=${t.transid} vid=${t.vid} maid=${t.maid} "${ledger?.name}" acmac1.acid=${ledger?.acid} transc1.acid=${t.acid} DR=${t.dramt} CR=${t.cramt} dt=${t.dt}`);
  });
}

checkHighLedgers().catch(console.error);
