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

async function debugExactFrontendBS() {
  const accountId = "31";
  const endDate = "2027-03-31";

  // Simulate frontend state loading:
  const acmac1 = await getAllRows('acmac1');
  const vouchersc1 = await getAllRows('vouchersc1');
  const vouchers1 = await getAllRows('vouchers1');
  const transc1 = await getAllRows('transc1');
  const trans1 = await getAllRows('trans1');

  // getStoredGroups(accountId)
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

  // getStoredLedgers(accountId)
  const ledgers = acmac1
    .filter(a => !a.is_group && (!acidNum || a.acid === acidNum))
    .map(a => {
      const db = Number(a.db_bal) || 0;
      const cr = Number(a.cr_bal) || 0;
      return {
        id: String(a.id),
        name: a.name,
        groupId: String(a.parent_id),
        openingBalance: Math.abs(db - cr),
        openingType: db >= cr ? 'DR' : 'CR',
        currentBalance: 0,
        currentType: 'DR',
        amid: a.id >= 100000 ? a.id : undefined,
        acid: a.acid
      };
    });

  // getStoredVouchers()
  const vouchers = [...vouchersc1.map(v => ({ ...v, _src: 'c' })), ...vouchers1.map(v => ({ ...v, _src: 't' }))].map(v => ({
    id: `${v._src || 'v'}_${v.vid}`,
    vid: v.vid,
    date: v.dt || '',
    type: String(v.vtyp || 'journal'),
    narration: v.narr || '',
    voucherNo: `V-${v.vid}`,
    accountId: v.acid ? String(v.acid) : undefined,
    portfolioId: v.pfid ? String(v.pfid) : undefined,
    totalAmount: Number(v.tamt) || 0
  }));

  // getStoredEntries()
  const entries = [
    ...transc1.map(e => ({
      id: `c_${e.transid}`,
      voucherId: `c_${e.vid}`,
      ledgerId: String(e.maid),
      debit: Number(e.dramt) || 0,
      credit: Number(e.cramt) || 0,
      accountId: e.acid ? String(e.acid) : undefined
    })),
    ...trans1.map(e => ({
      id: `t_${e.transid}`,
      voucherId: `t_${e.vid}`,
      ledgerId: String(e.maid),
      debit: Number(e.dramt) || 0,
      credit: Number(e.cramt) || 0,
      accountId: e.acid ? String(e.acid) : undefined
    }))
  ];

  // Now run the EXACT logic from balanceSheet.ts:
  const getGroupType = (groupId) => {
    let current = groups.find(g => g.id === groupId);
    while (current) {
      if (current.type) return current.type;
      current = groups.find(g => g.id === current.parent);
    }
    return "ASSET";
  };

  const voucherMap = {};
  vouchers.forEach(v => voucherMap[v.id] = v);

  const calcLedgerBal = (ledger, groupType) => {
    let debit = 0;
    let credit = 0;
    entries.forEach(e => {
      if (String(e.ledgerId) === String(ledger.id)) {
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
    return groupType === "ASSET" ? debit - credit : credit - debit;
  };

  const groupMap = {};
  groups.forEach(g => {
    groupMap[g.id] = { ...g, balance: 0, children: [], ledgers: [] };
  });

  // Attach ledgers
  ledgers.forEach(l => {
    let targetGroup = l.groupId;
    if (!groupMap[targetGroup]) {
      if (accountId) return;
      targetGroup = 'suspense_virtual';
    }
    const type = getGroupType(targetGroup);
    const bal = calcLedgerBal(l, type);
    const displayBalance = type === 'EXPENSE' ? Math.abs(bal) : bal;
    if (Math.abs(bal) < 0.01) return;
    groupMap[targetGroup].ledgers.push({ ...l, balance: bal, displayBalance, groupType: type });
  });

  const tree = [];
  Object.values(groupMap).forEach(g => {
    if (g.parent && groupMap[g.parent]) {
      groupMap[g.parent].children.push(g);
    } else {
      tree.push(g);
    }
  });

  const calcGroupBalance = (group) => {
    let bal = group.ledgers.reduce((s, l) => s + l.balance, 0);
    group.children.forEach(child => { bal += calcGroupBalance(child); });
    group.balance = bal;
    return bal;
  };
  tree.forEach(g => calcGroupBalance(g));

  const assets = tree.filter(g => getGroupType(g.id) === "ASSET");
  const liabilities = tree.filter(g => getGroupType(g.id) !== "ASSET");

  const totalAssets = assets.reduce((s, g) => s + g.balance, 0);
  const totalLiabilities = liabilities.reduce((s, g) => s + g.balance, 0);
  const diff = totalLiabilities - totalAssets;

  console.log('\n=== EXACT BALANCE SHEET TOTALS ===');
  console.log(`Total Assets: ${totalAssets.toFixed(2)}`);
  console.log(`Total Liabilities & Equity: ${totalLiabilities.toFixed(2)}`);
  console.log(`Discrepancy (Liabilities - Assets): ${diff.toFixed(2)}`);

  // Let's inspect which group has what
  console.log('\n--- Asset Groups ---');
  assets.forEach(a => console.log(`  ${a.name}: ${a.balance.toFixed(2)}`));
  console.log('\n--- Liability Groups ---');
  liabilities.forEach(l => console.log(`  ${l.name}: ${l.balance.toFixed(2)}`));
}

debugExactFrontendBS().catch(console.error);
