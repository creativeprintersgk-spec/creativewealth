import Database from 'better-sqlite3';

const db = new Database('C:/Users/Admin/Desktop/mprTempBackupMPrAPPv10.db', { readonly: true });

// Load data as in WealthCore
const acid = '29';
const endDate = '2026-03-31';

// Group mapping from logic_defaults / acmac1
const acmac1All = db.prepare('SELECT * FROM ACMA1').all();
const samAll = db.prepare('SELECT * FROM SAM').all();
const samMap: Record<number, string> = {};
samAll.forEach((s: any) => { samMap[s.AMID] = s.ANM; });

// Portfolios
const accPflink = db.prepare('SELECT * FROM ACC_PFLINK').all();
const portfolioIds = accPflink.filter((l: any) => String(l.ACID) === acid).map((l: any) => String(l.PFID));
console.log('Unnati Linked Portfolios:', portfolioIds);

// Groups for acid 29
const groups = acmac1All.filter((a: any) => a.IS_GROUP && String(a.ACID) === acid).map((a: any) => ({
  id: String(a.ID),
  name: a.NAME,
  parent: a.PARENT_ID ? String(a.PARENT_ID) : undefined,
  specialTypeId: a.SPECIAL_TYPE_ID
}));

// Ledgers for acid 29
const ledgers = acmac1All.filter((a: any) => !a.IS_GROUP && String(a.ACID) === acid).map((a: any) => ({
  id: String(a.ID),
  name: a.NAME,
  groupId: String(a.PARENT_ID),
  openingBalance: 0,
  openingType: 'DR'
}));

// Vouchers & Trans
const v1 = db.prepare('SELECT * FROM Vouchers1').all();
const voucherMap: Record<string, any> = {};
v1.forEach((v: any) => {
  voucherMap[`t_${v.VID}`] = {
    id: `t_${v.VID}`,
    date: v.DT || '',
    type: String(v.VTYP || 'journal'),
    narration: v.NARR || '',
    portfolioId: v.PFID ? String(v.PFID) : undefined,
    accountId: v.ACID ? String(v.ACID) : undefined
  };
});

const t1 = db.prepare('SELECT * FROM Trans1').all();
const entries = t1.map((e: any) => ({
  id: `t_${e.TRANSID}`,
  voucherId: `t_${e.VID}`,
  ledgerId: String(e.MAID),
  debit: Number(e.DRAMT) || 0,
  credit: Number(e.CRAMT) || 0,
  date: e.DT || '',
  accountId: e.ACID ? String(e.ACID) : undefined
}));

// getGroupType helper
const getGroupType = (groupId: string): string => {
  let current: any = groups.find((g: any) => g.id === groupId);
  while (current) {
    if (current.specialTypeId === 250 || current.specialTypeId === 275 || current.id === '1' || current.id === '64' || current.id === '65') return 'LIABILITY';
    if (current.specialTypeId === 150 || current.id === '2' || current.id === '45' || current.id === '50' || current.id === '55' || current.id === '60') return 'ASSET';
    if (current.id === '155' || current.id === '180') return 'INCOME';
    if (current.id === '160' || current.id === '170' || current.id === '171' || current.id === '175') return 'EXPENSE';
    current = groups.find((g: any) => g.id === current.parent);
  }
  return 'ASSET';
};

const calcLedgerBal = (ledger: any, groupType: string): number => {
  let debit = 0;
  let credit = 0;
  entries.forEach((e: any) => {
    if (String(e.ledgerId) === String(ledger.id)) {
      const v = voucherMap[e.voucherId];
      const entryDate = e.date || v?.date;
      const entryAcid = e.accountId || v?.accountId;
      const entryPfid = v?.portfolioId;

      const isOpeningBalance = !entryDate || entryDate === '' || entryDate === 'undefined';
      if (!isOpeningBalance && entryDate > endDate) return;

      if (acid) {
        const belongsToAccount =
          (entryAcid === acid) ||
          (entryPfid && portfolioIds.includes(entryPfid));
        if (!belongsToAccount) return;
      }

      debit += e.debit || 0;
      credit += e.credit || 0;
    }
  });
  return groupType === 'ASSET' ? debit - credit : credit - debit;
};

const groupMap: Record<string, any> = {};
groups.forEach((g: any) => {
  groupMap[g.id] = { ...g, balance: 0, children: [], ledgers: [] };
});

const seenLids = new Set<string>();
const ledgersToInclude: any[] = [];

ledgers.forEach((l: any) => {
  seenLids.add(String(l.id));
  ledgersToInclude.push(l);
});

// Add security ledgers
entries.forEach((e: any) => {
  const v = voucherMap[e.voucherId];
  const entryDate = e.date || v?.date;
  const entryAcid = e.accountId || v?.accountId;
  const entryPfid = v?.portfolioId;

  const isOpeningBalance = !entryDate || entryDate === '' || entryDate === 'undefined';
  if (!isOpeningBalance && entryDate > endDate) return;

  const belongsToAccount = !acid ||
    (entryAcid === acid) ||
    (entryPfid && portfolioIds.includes(entryPfid));

  if (belongsToAccount && !seenLids.has(String(e.ledgerId))) {
    seenLids.add(String(e.ledgerId));
    const lidNum = Number(e.ledgerId);
    const name = samMap[lidNum] || `Asset ${e.ledgerId}`;
    ledgersToInclude.push({
      id: String(e.ledgerId),
      name,
      groupId: lidNum >= 100000 ? '50' : '50',
      openingBalance: 0,
      openingType: 'DR'
    });
  }
});

ledgersToInclude.forEach((l: any) => {
  let targetGroup = String(l.groupId);
  if (!groupMap[targetGroup]) {
    targetGroup = '50';
  }
  const type = getGroupType(targetGroup);
  const bal = calcLedgerBal(l, type);
  if (Math.abs(bal) > 0.01) {
    if (groupMap[targetGroup]) {
      groupMap[targetGroup].ledgers.push({ ...l, balance: bal, groupType: type });
    }
  }
});

// Build tree
const tree: any[] = [];
Object.values(groupMap).forEach((g: any) => {
  if (g.parent && groupMap[g.parent]) {
    groupMap[g.parent].children.push(g);
  } else {
    tree.push(g);
  }
});

const calcGroupBalance = (group: any): number => {
  let bal = group.ledgers.reduce((s: number, l: any) => s + l.balance, 0);
  group.children.forEach((child: any) => { bal += calcGroupBalance(child); });
  group.balance = bal;
  return bal;
};
tree.forEach(g => calcGroupBalance(g));

const assets = tree.filter(g => getGroupType(g.id) === 'ASSET');
const liabilities = tree.filter(g => getGroupType(g.id) !== 'ASSET');

const totalAssets = assets.reduce((s, g) => s + g.balance, 0);
const totalLiabilities = liabilities.reduce((s, g) => s + g.balance, 0);

console.log('\n=== RESULTS FOR UNNATI SHAH ===');
console.log(`Total Assets: ₹${totalAssets.toFixed(2)}`);
console.log(`Total Liabilities: ₹${totalLiabilities.toFixed(2)}`);
console.log(`Difference: ₹${(totalAssets - totalLiabilities).toFixed(2)}`);

console.log('\n--- ASSET GROUPS BREAKDOWN ---');
function printGroup(g: any, indent = 0) {
  const pad = ' '.repeat(indent);
  console.log(`${pad}> Group "${g.name}" (ID: ${g.id}): ₹${g.balance.toFixed(2)}`);
  g.ledgers.forEach((l: any) => {
    console.log(`${pad}   - Ledger "${l.name}" (ID: ${l.id}): ₹${l.balance.toFixed(2)}`);
  });
  g.children.forEach((c: any) => printGroup(c, indent + 3));
}
assets.forEach(g => printGroup(g));

console.log('\n--- LIABILITY GROUPS BREAKDOWN ---');
liabilities.forEach(g => printGroup(g));
