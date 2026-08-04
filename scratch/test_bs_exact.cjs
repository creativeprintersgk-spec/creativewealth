const { createClient } = require('@supabase/supabase-js');
require('dotenv').config();
const supabase = createClient(process.env.VITE_SUPABASE_URL, process.env.VITE_SUPABASE_ANON_KEY);

async function run() {
  const accountId = 30;
  
  const { data: acmac1 } = await supabase.from('acmac1').select('*');
  const { data: trans1 } = await supabase.from('trans1').select('*');
  const { data: transc1 } = await supabase.from('transc1').select('*');
  const { data: vouchers1 } = await supabase.from('vouchers1').select('*');
  const { data: vouchersc1 } = await supabase.from('vouchersc1').select('*');
  const { data: portfolios } = await supabase.from('portfolios').select('*');
  const { data: acc_pflink } = await supabase.from('acc_pflink').select('*');

  // getStoredGroups
  const groups = acmac1.filter(a => a.is_group).map(a => ({
    id: String(a.id),
    name: a.name,
    parent: a.parent_id === 0 ? null : String(a.parent_id),
    type: null // simplified
  }));
  // manually patch root types
  
  
  
  

  // getStoredLedgers
  const ledgers = acmac1.filter(a => !a.is_group && (a.acid === accountId)).map(a => ({
    id: String(a.id),
    name: a.name,
    groupId: String(a.parent_id)
  }));

  // getStoredEntries
  const c1 = transc1.map(e => ({
    id: `c_${e.transid}`,
    voucherId: `c_${e.vid}`,
    ledgerId: String(e.maid),
    debit: Number(e.dramt) || 0,
    credit: Number(e.cramt) || 0,
    accountId: e.acid ? String(e.acid) : undefined,
    date: e.dt || ''
  }));
  const t1 = trans1.map(e => ({
    id: `t_${e.transid}`,
    voucherId: `t_${e.vid}`,
    ledgerId: String(e.maid),
    debit: Number(e.dramt) || 0,
    credit: Number(e.cramt) || 0,
    accountId: e.acid ? String(e.acid) : undefined,
    date: e.dt || ''
  }));
  const allEntries = [...c1, ...t1];

  // getStoredVouchers
  const v1 = vouchersc1.map(v => ({ id: `c_${v.vid}`, date: v.dt || '', accountId: String(v.acid), portfolioId: v.pfid ? String(v.pfid) : null }));
  const v2 = vouchers1.map(v => ({ id: `t_${v.vid}`, date: v.dt || '', accountId: String(v.acid), portfolioId: v.pfid ? String(v.pfid) : null }));
  const allVouchers = [...v1, ...v2];

  // getStoredPortfolios
  const allPortfolios = portfolios.map(p => {
    const link = acc_pflink.find(l => l.pfid === p.id);
    return { id: String(p.id), accountId: link ? String(link.acid) : undefined };
  });

  const voucherMap = {};
  allVouchers.forEach(v => voucherMap[v.id] = v);

  const portfolioIds = allPortfolios.filter(p => p.accountId === String(accountId)).map(p => p.id);

  const calcLedgerBal = (ledger, groupType) => {
    let debit = 0, credit = 0;
    allEntries.forEach(e => {
      if (String(e.ledgerId) === String(ledger.id)) {
        const v = voucherMap[e.voucherId];
        const entryAcid = e.accountId || v?.accountId;
        const entryPfid = v?.portfolioId;
        const belongsToAccount = (entryAcid === String(accountId)) || (entryPfid && portfolioIds.includes(String(entryPfid)));
        if (!belongsToAccount) return;
        debit += e.debit || 0;
        credit += e.credit || 0;
      }
    });
    return groupType === "ASSET" ? debit - credit : credit - debit;
  };

  const getGroupType = (groupId) => {
    let current = groups.find(g => g.id === groupId);
    while (current) {
      if (current.type) return current.type;
      current = groups.find(g => g.id === current.parent);
    }
    return "ASSET";
  };

  const groupMap = {};
  groups.forEach(g => {
    groupMap[g.id] = { ...g, balance: 0, children: [], ledgers: [] };
  });

  const ledgerIdsInEntries = new Set();
  allEntries.forEach(e => {
    const v = voucherMap[e.voucherId];
    const entryAcid = e.accountId || v?.accountId;
    const entryPfid = v?.portfolioId;
    const belongsToAccount = (entryAcid === String(accountId)) || (entryPfid && portfolioIds.includes(String(entryPfid)));
    if (belongsToAccount) {
      ledgerIdsInEntries.add(e.ledgerId);
    }
  });

  const existingLedgerIds = new Set(ledgers.map(l => l.id));
  const missingLedgerIds = Array.from(ledgerIdsInEntries).filter(id => !existingLedgerIds.has(id));

  const allLedgers = acmac1.filter(a => !a.is_group).map(a => ({
    id: String(a.id), name: a.name, groupId: String(a.parent_id)
  }));

  console.log('Is 255486 in allEntries?', allEntries.some(e => e.ledgerId === '255486')); console.log('ledgerIdsInEntries:', Array.from(ledgerIdsInEntries).filter(id => id === '255486')); console.log('missingLedgerIds:', missingLedgerIds.filter(id => id === '255486')); if (missingLedgerIds.length > 0) {
    missingLedgerIds.forEach(id => {
      const globalLedger = allLedgers.find(l => String(l.id) === String(id));
      if (globalLedger) {
        ledgers.push(globalLedger);
      }
    });
  }

  ledgers.forEach(l => {
    if (!groupMap[l.groupId]) return;
    const type = getGroupType(l.groupId);
    const bal = calcLedgerBal(l, type);
    const displayBalance = type === 'EXPENSE' ? Math.abs(bal) : bal;
    groupMap[l.groupId].ledgers.push({ ...l, balance: bal, displayBalance, groupType: type });
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

  // Find Reliance Infra
  console.log("Total Assets:", totalAssets);
  console.log("Total Liabilities:", totalLiabilities);
  console.log("Unbalance:", Math.abs(totalAssets - totalLiabilities));

  const stocksGroup = Object.values(groupMap).find(g => g.id === '200050');
  console.log("Stocks Group Ledgers:", stocksGroup?.ledgers.filter(l => l.name.includes("Reliance")));
}

run();
