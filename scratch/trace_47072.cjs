const { createClient } = require('@supabase/supabase-js');
const supabase = createClient(
  'https://ajjeoijjsklgkioxqkrb.supabase.co',
  'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImFqamVvaWpqc2tsZ2tpb3hxa3JiIiwicm9sZSI6ImFub24iLCJpYXQiOjE3Nzg0OTgyODMsImV4cCI6MjA5NDA3NDI4M30.3OM0q7_9Eiz_fqt3N4c08sxYtsofb3v50v1vLxKEgvI'
);

async function checkBalanceSheet() {
  // Saahil's acid is 31 (Saahil Shah A/c)
  // Let's get all acmac1 ledgers for acid=31
  const { data: ledgers } = await supabase.from('acmac1').select('*').eq('acid', 31);
  console.log(`Total acmac1 rows for acid=31: ${ledgers?.length}`);

  // Fetch all transc1 rows for acid=31
  const { data: tc1 } = await supabase.from('transc1').select('*').eq('acid', 31);
  console.log(`Total transc1 rows for acid=31: ${tc1?.length}`);

  // Fetch all trans1 rows for acid=31
  const { data: t1 } = await supabase.from('trans1').select('*').eq('acid', 31);
  console.log(`Total trans1 rows for acid=31: ${t1?.length}`);

  // Compute balance per ledger in acid=31 from transc1 + trans1
  const ledgerMap = {};
  ledgers?.forEach(l => {
    ledgerMap[l.id] = { ...l, dr: 0, cr: 0, openingDr: Number(l.db_bal)||0, openingCr: Number(l.cr_bal)||0 };
  });

  const missingMaids = {};
  [...(tc1 || []), ...(t1 || [])].forEach(t => {
    const l = ledgerMap[t.maid];
    if (l) {
      l.dr += Number(t.dramt || 0);
      l.cr += Number(t.cramt || 0);
    } else {
      if (!missingMaids[t.maid]) missingMaids[t.maid] = { dr: 0, cr: 0, count: 0, rows: [] };
      missingMaids[t.maid].dr += Number(t.dramt || 0);
      missingMaids[t.maid].cr += Number(t.cramt || 0);
      missingMaids[t.maid].count++;
      missingMaids[t.maid].rows.push(t);
    }
  });

  console.log('\n--- Missing MAIDs in acmac1 for acid=31 that have transactions in transc1/trans1 ---');
  let missingNetTotal = 0;
  for (const [maid, data] of Object.entries(missingMaids)) {
    const net = data.dr - data.cr;
    missingNetTotal += net;
    console.log(`MAID: ${maid}, DR: ${data.dr.toFixed(2)}, CR: ${data.cr.toFixed(2)}, NET (DR-CR): ${net.toFixed(2)} (${data.count} txns)`);
    // Let's check what this maid is across all acmac1
    const { data: anyAcmac } = await supabase.from('acmac1').select('id, name, acid, parent_id').eq('id', maid);
    console.log(`  -> in other accounts:`, anyAcmac);
  }
  console.log(`\nTOTAL NET of all missing MAIDs: ₹${missingNetTotal.toFixed(2)}`);
}

checkBalanceSheet().catch(console.error);
