const { createClient } = require('@supabase/supabase-js');
const supabase = createClient(
  'https://ajjeoijjsklgkioxqkrb.supabase.co',
  'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImFqamVvaWpqc2tsZ2tpb3hxa3JiIiwicm9sZSI6ImFub24iLCJpYXQiOjE3Nzg0OTgyODMsImV4cCI6MjA5NDA3NDI4M30.3OM0q7_9Eiz_fqt3N4c08sxYtsofb3v50v1vLxKEgvI'
);

async function getAllRows(table, filterCol, filterVal) {
  let all = [];
  let from = 0;
  const pageSize = 1000;
  while (true) {
    let q = supabase.from(table).select('*').range(from, from + pageSize - 1);
    if (filterCol && filterVal !== undefined) q = q.eq(filterCol, filterVal);
    const { data, error } = await q;
    if (error || !data || data.length === 0) break;
    all = all.concat(data);
    if (data.length < pageSize) break;
    from += pageSize;
  }
  return all;
}

async function pinpoint2699() {
  const accountId = 31;
  const tc1 = await getAllRows('transc1', 'acid', accountId);
  const t1 = await getAllRows('trans1', 'acid', accountId);
  const allEntries = [...tc1, ...t1];
  const allLedgers = await getAllRows('acmac1', 'acid', accountId);

  // Check sum of ALL debits and credits across all entries for acid=31
  let totalDr = 0;
  let totalCr = 0;
  allEntries.forEach(e => {
    totalDr += Number(e.dramt) || 0;
    totalCr += Number(e.cramt) || 0;
  });

  console.log(`All Transactions for acid=31: Total DR = ${totalDr.toFixed(2)}, Total CR = ${totalCr.toFixed(2)}, Diff = ${(totalDr - totalCr).toFixed(2)}`);

  // Check sum of ALL opening balances in acmac1 for acid=31
  let openDr = 0;
  let openCr = 0;
  allLedgers.forEach(l => {
    if (!l.is_group) {
      openDr += Number(l.db_bal) || 0;
      openCr += Number(l.cr_bal) || 0;
    }
  });

  console.log(`All Opening Balances for acid=31: Open DR = ${openDr.toFixed(2)}, Open CR = ${openCr.toFixed(2)}, Diff = ${(openDr - openCr).toFixed(2)}`);

  // Total trial balance = (openDr + totalDr) - (openCr + totalCr)
  const grandDr = openDr + totalDr;
  const grandCr = openCr + totalCr;
  console.log(`Grand Total: DR = ${grandDr.toFixed(2)}, CR = ${grandCr.toFixed(2)}, NET = ${(grandDr - grandCr).toFixed(2)}`);

  // Check if any voucher has DR != CR
  const vouchers = await getAllRows('vouchersc1', 'acid', accountId);
  const vMap = {};
  allEntries.forEach(e => {
    if (!vMap[e.vid]) vMap[e.vid] = { dr: 0, cr: 0, count: 0 };
    vMap[e.vid].dr += Number(e.dramt) || 0;
    vMap[e.vid].cr += Number(e.cramt) || 0;
    vMap[e.vid].count++;
  });

  console.log('\n--- Vouchers with DR != CR in acid=31 ---');
  let unbalancedVouchers = 0;
  for (const [vid, v] of Object.entries(vMap)) {
    const diff = Math.abs(v.dr - v.cr);
    if (diff > 0.01) {
      unbalancedVouchers++;
      const vDetails = vouchers.find(x => x.vid == vid);
      console.log(`  vid=${vid} DR=${v.dr.toFixed(2)} CR=${v.cr.toFixed(2)} DIFF=${(v.dr - v.cr).toFixed(2)} narr="${vDetails?.narr}" dt=${vDetails?.dt}`);
    }
  }
  console.log(`Total unbalanced vouchers: ${unbalancedVouchers}`);

  // Let's check Canara Bank ledger (501603) opening balance and transactions:
  const canara = allLedgers.find(l => l.id === 501603);
  console.log('\nCanara Bank (501603) in acmac1:', canara);
  const canaraTxns = allEntries.filter(e => e.maid === 501603);
  console.log(`Canara Bank txns: ${canaraTxns.length}`);
  canaraTxns.forEach(t => console.log(`  vid=${t.vid} dramt=${t.dramt} cramt=${t.cramt} dt=${t.dt}`));
}

pinpoint2699().catch(console.error);
