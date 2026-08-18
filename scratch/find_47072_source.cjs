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

async function findDiscrepancy() {
  const ledgers = await getAllRows('acmac1', 'acid', 31);
  const tc1 = await getAllRows('transc1', 'acid', 31);
  const t1 = await getAllRows('trans1', 'acid', 31);

  console.log(`Total acmac1: ${ledgers.length}, Total transc1: ${tc1.length}, Total trans1: ${t1.length}`);

  const ledgerMap = {};
  ledgers.forEach(l => {
    ledgerMap[l.id] = { ...l, dr: 0, cr: 0, openingDr: Number(l.db_bal)||0, openingCr: Number(l.cr_bal)||0 };
  });

  const missingMaids = {};
  [...tc1, ...t1].forEach(t => {
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

  console.log('\n--- Missing MAIDs in acmac1 for acid=31 ---');
  let missingNetTotal = 0;
  for (const [maid, data] of Object.entries(missingMaids)) {
    const net = data.dr - data.cr;
    missingNetTotal += net;
    console.log(`MAID: ${maid}, DR: ${data.dr.toFixed(2)}, CR: ${data.cr.toFixed(2)}, NET: ${net.toFixed(2)} (${data.count} txns)`);
    const { data: anyAcmac } = await supabase.from('acmac1').select('id, name, acid, parent_id').eq('id', maid);
    console.log(`  -> details in acmac1:`, anyAcmac);
  }
  console.log(`\nTOTAL NET of all missing MAIDs: ₹${missingNetTotal.toFixed(2)}`);

  // Also check: which ledgers in acid=31 have parent_id that does NOT exist in groups of acid=31?
  const groupIds = new Set(ledgers.filter(l => l.is_group).map(l => l.id));
  const ledgersWithInvalidGroup = ledgers.filter(l => !l.is_group && !groupIds.has(l.parent_id));
  console.log(`\nLedgers with invalid/missing parent_id in acid=31: ${ledgersWithInvalidGroup.length}`);
  let invalidGroupNet = 0;
  ledgersWithInvalidGroup.forEach(l => {
    const net = (l.openingDr + l.dr) - (l.openingCr + l.cr);
    if (Math.abs(net) > 0.01) {
      invalidGroupNet += net;
      console.log(`  id=${l.id} name="${l.name}" parent_id=${l.parent_id} NET=₹${net.toFixed(2)}`);
    }
  });
  console.log(`TOTAL NET of ledgers with invalid group: ₹${invalidGroupNet.toFixed(2)}`);
}

findDiscrepancy().catch(console.error);
