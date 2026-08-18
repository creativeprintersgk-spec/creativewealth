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

async function debugEveryLedger() {
  const accountId = "31";
  const endDate = "2027-03-31";

  // Simulate getStoredGroups, getStoredLedgers, getStoredVouchers, getStoredEntries
  const acmac1 = await getAllRows('acmac1');
  const vouchersc1 = await getAllRows('vouchersc1');
  const vouchers1 = await getAllRows('vouchers1');
  const transc1 = await getAllRows('transc1');
  const trans1 = await getAllRows('trans1');

  const acidNum = Number(accountId);
  const groups = acmac1
    .filter(a => a.is_group && (!acidNum || a.acid === acidNum))
    .map(a => ({
      id: String(a.id),
      name: a.name,
      parent: a.parent_id ? String(a.parent_id) : undefined,
      type: (a.id === 50 || a.id === 200050 || a.parent_id === 50) ? 'ASSET' : ((a.id === 70 || a.id === 60 || a.id === 80) ? 'LIABILITY' : undefined),
      acid: a.acid
    }));

  const ledgers = acmac1
    .filter(a => !a.is_group && (!acidNum || a.acid === acidNum))
    .map(a => ({
      id: String(a.id),
      name: a.name,
      groupId: String(a.parent_id),
      acid: a.acid
    }));

  const vouchers = [...vouchersc1.map(v => ({ ...v, _src: 'c' })), ...vouchers1.map(v => ({ ...v, _src: 't' }))].map(v => ({
    id: `${v._src || 'v'}_${v.vid}`,
    vid: v.vid,
    date: v.dt || '',
    type: String(v.vtyp || 'journal'),
    narration: v.narr || '',
    voucherNo: `V-${v.vid}`,
    accountId: v.acid ? String(v.acid) : undefined,
    portfolioId: v.pfid ? String(v.pfid) : undefined,
  }));

  const entries = [
    ...transc1.map(e => ({
      id: `c_${e.transid}`,
      voucherId: `c_${e.vid}`,
      ledgerId: String(e.maid),
      debit: Number(e.dramt) || 0,
      credit: Number(e.cramt) || 0,
      date: e.dt || '',
      accountId: e.acid ? String(e.acid) : undefined
    })),
    ...trans1.map(e => ({
      id: `t_${e.transid}`,
      voucherId: `t_${e.vid}`,
      ledgerId: String(e.maid),
      debit: Number(e.dramt) || 0,
      credit: Number(e.cramt) || 0,
      date: e.dt || '',
      accountId: e.acid ? String(e.acid) : undefined
    }))
  ];

  const voucherMap = {};
  vouchers.forEach(v => voucherMap[v.id] = v);

  // Group type resolver
  const getGroupType = (groupId) => {
    let current = groups.find(g => g.id === groupId);
    while (current) {
      if (current.type) return current.type;
      current = groups.find(g => g.id === current.parent);
    }
    return "ASSET";
  };

  // Run calcLedgerBal
  let sumDr = 0;
  let sumCr = 0;
  const ledgerBals = [];

  ledgers.forEach(l => {
    let debit = 0;
    let credit = 0;
    entries.forEach(e => {
      if (String(e.ledgerId) === String(l.id)) {
        const v = voucherMap[e.voucherId];
        const entryDate = e.date || v?.date;
        const entryAcid = e.accountId || v?.accountId;

        const isOpeningBalance = !entryDate || entryDate === '' || entryDate === 'undefined';
        const dateOk = isOpeningBalance || entryDate <= endDate;

        if (dateOk) {
          if (accountId) {
            const belongsToAccount = (entryAcid === accountId);
            if (!belongsToAccount) return;
          }
          debit += e.debit || 0;
          credit += e.credit || 0;
        }
      }
    });
    const type = getGroupType(l.groupId);
    sumDr += debit;
    sumCr += credit;
    if (debit > 0 || credit > 0) {
      ledgerBals.push({ id: l.id, name: l.name, groupId: l.groupId, type, debit, credit, net: debit - credit });
    }
  });

  console.log(`Total Debits across acid=31 ledgers: ${sumDr.toFixed(2)}`);
  console.log(`Total Credits across acid=31 ledgers: ${sumCr.toFixed(2)}`);
  console.log(`Difference (DR - CR): ${(sumDr - sumCr).toFixed(2)}`);

  // Check which entries for acid=31 did NOT get matched to any ledger in `ledgers`!
  const ledgerIdSet = new Set(ledgers.map(l => l.id));
  const unmatchedEntries = entries.filter(e => e.accountId === accountId && !ledgerIdSet.has(e.ledgerId));
  console.log(`\nUnmatched entries for acid=31 (ledger not in acid=31): ${unmatchedEntries.length}`);
  let unmatchedDr = 0;
  let unmatchedCr = 0;
  unmatchedEntries.forEach(u => {
    unmatchedDr += u.debit;
    unmatchedCr += u.credit;
    console.log(`  entry id=${u.id} vid=${u.voucherId} ledgerId=${u.ledgerId} DR=${u.debit} CR=${u.credit} date=${u.date}`);
    // What is this ledger in acmac1?
    const foundInAcmac = acmac1.find(a => String(a.id) === String(u.ledgerId));
    console.log(`    -> in acmac1: name="${foundInAcmac?.name}" acid=${foundInAcmac?.acid} parent_id=${foundInAcmac?.parent_id}`);
  });
  console.log(`Unmatched Total: DR = ${unmatchedDr.toFixed(2)}, CR = ${unmatchedCr.toFixed(2)}, NET = ${(unmatchedDr - unmatchedCr).toFixed(2)}`);
}

debugEveryLedger().catch(console.error);
