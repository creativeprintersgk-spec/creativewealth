import { initDatabase, state, getStoredLedgers, getStoredGroups, getStoredEntries, getStoredVouchers, getStoredPortfolios, getAssetName } from '../src/logic.ts';

const SYNTHETIC_MAID_GROUP: Record<number, string> = {
  230: '64', 621: '60', 401: '200040', 405: '200120', 407: '160', 415: '160', 205: '90',
  460: '180', 465: '180', 470: '180', 475: '180', 480: '180', 485: '180', 490: '180',
  603: '180', 650: '160', 655: '160', 660: '160', 665: '160'
};

const SYNTHETIC_MAID_NAME: Record<number, string> = {
  230: 'Capital Account', 621: 'Cash on Hand', 401: 'Bond / NCD Interest', 405: 'PPF / EPF Returns',
  407: 'Bank Charges & Interest Paid', 415: 'Miscellaneous Charges', 205: 'Sundry Debtors',
  460: 'Equity LTCG', 465: 'Equity STCG', 470: 'Debt LTCG', 475: 'Debt STCG',
  480: 'Other Capital Gains', 485: 'Exempted Capital Gains', 490: 'STT Paid', 603: 'Misc Capital Gains',
  650: 'STT (Delivery)', 655: 'STT (Intraday)', 660: 'STT (Futures)', 665: 'STT (Options)',
  100001: 'R K Global', 100002: 'RKSV', 100004: 'Direct', 100007: 'Zerodha'
};

const SKIP_MAIDS = new Set<number>([40, 41, 1000, 1001, 1002, 1003, 1004, 1005, 1006, 1007, 1008, 1009, 1010]);

function resolveSyntheticGroup(lidNum: number, state: any): string {
  if (SYNTHETIC_MAID_GROUP[lidNum]) return SYNTHETIC_MAID_GROUP[lidNum];
  if (lidNum >= 100000 && lidNum < 500000) return '80';
  if (lidNum >= 500000) {
    const samAmid = lidNum - 500000;
    const samRow = (state.sam || []).find((x: any) => Number(x.amid) === samAmid);
    const atyp = samRow?.atyp;
    if (atyp === 50) return '200010';
    if (atyp >= 60 && atyp <= 62) return '200020';
    if (atyp === 90) return '200030';
    if (atyp === 100 || atyp === 110) return '200040';
    if (atyp === 75 || atyp === 77 || atyp === 150 || atyp === 151) return '200050';
    if (atyp === 130) return '200120';
    if (atyp === 80) return '200090';
    if (atyp === 160) return '200080';
    if (atyp === 170) return '200155';
    if (atyp === 140) return '200110';
    if (atyp === 70) return '200100';
    if (atyp === 120 || atyp === 220) return '200130';
    if (atyp === 180) return '200160';
    if (atyp >= 190 && atyp <= 210) return '200140';
    if (atyp === 230) return '200170';
    if (atyp === 240) return '200180';
    return '200180';
  }
  return '200180';
}

async function testDedup() {
  await initDatabase();
  const accountId = '29';
  const startDate = '2025-04-01';
  const endDate = '2026-03-31';

  const groups = getStoredGroups(accountId);
  const entries = getStoredEntries();
  const vouchers = getStoredVouchers();
  const portfolios = getStoredPortfolios();
  const portfolioIds = accountId
    ? portfolios.filter((p: any) => String(p.client_id) === String(accountId)).map((p: any) => p.id)
    : [];

  const voucherMap: Record<string, any> = {};
  vouchers.forEach((v: any) => { voucherMap[v.id] = v; });

  const groupTypeMap: Record<string, string> = {
    '1': 'LIABILITY', '64': 'LIABILITY', '80': 'LIABILITY', '2': 'ASSET',
    '3': 'EXPENSE', '4': 'INCOME'
  };

  const getGroupType = (groupId: string): string => {
    let curr = groups.find((g: any) => String(g.id) === String(groupId));
    while (curr) {
      if (groupTypeMap[String(curr.id)]) return groupTypeMap[String(curr.id)];
      curr = groups.find((g: any) => String(g.id) === String(curr.parent));
    }
    return 'ASSET';
  };

  // Deduped account ledgers:
  const seenLids = new Set<string>();
  const ledgersToInclude: any[] = [];

  getStoredLedgers(accountId).forEach((l: any) => {
    const lidStr = String(l.id);
    if (!seenLids.has(lidStr)) {
      seenLids.add(lidStr);
      ledgersToInclude.push(l);
    }
  });

  // Also include any global ledgers (acid === -1) that are NOT in seenLids:
  (state.acmac1 || []).filter((a: any) => !a.is_group && a.acid === -1).forEach((a: any) => {
    const lidStr = String(a.id);
    if (!seenLids.has(lidStr)) {
      seenLids.add(lidStr);
      const db = Number(a.db_bal) || 0;
      const cr = Number(a.cr_bal) || 0;
      const net = db - cr;
      ledgersToInclude.push({
        id: lidStr,
        name: a.name,
        groupId: String(a.parent_id),
        openingBalance: Math.abs(net),
        openingType: (net >= 0 ? 'DR' : 'CR') as 'DR' | 'CR',
        acid: -1,
        _acmac1NetBalance: net
      });
    }
  });

  // Process entries:
  entries.forEach((e: any) => {
    const v = voucherMap[e.voucherId];
    const entryDate = e.date || v?.date;
    const entryAcid = e.accountId || v?.accountId;
    const entryPfid = v?.portfolioId;

    const isOpeningBalance = !entryDate || entryDate === '' || entryDate === 'undefined';
    if (!isOpeningBalance && entryDate > endDate) return;

    const belongsToAccount = !accountId ||
      (entryAcid === accountId) ||
      (entryPfid && portfolioIds?.includes(entryPfid));

    if (belongsToAccount && !seenLids.has(String(e.ledgerId))) {
      seenLids.add(String(e.ledgerId));

      const lidNum = Number(e.ledgerId);
      if (SKIP_MAIDS.has(lidNum)) return;

      const resolvedGroup = resolveSyntheticGroup(lidNum, state);
      if (resolvedGroup === 'SKIP') return;

      let name: string;
      if (SYNTHETIC_MAID_NAME[lidNum]) {
        name = SYNTHETIC_MAID_NAME[lidNum];
      } else if (lidNum >= 500000) {
        const resolved = getAssetName(lidNum);
        if (resolved) {
          name = resolved;
        } else {
          const samAmid = lidNum - 500000;
          const samRow = (state.sam || []).find((x: any) => Number(x.amid) === samAmid);
          name = samRow?.anm || samRow?.alias || samRow?.isr || `Inv-${samAmid}`;
        }
      } else {
        name = getAssetName(lidNum) || `Acct-${lidNum}`;
      }

      ledgersToInclude.push({
        id: String(e.ledgerId),
        name,
        groupId: resolvedGroup,
        openingBalance: 0,
        openingType: 'DR' as const,
        amid: lidNum >= 100000 ? lidNum : undefined,
        acid: accountId ? Number(accountId) : undefined
      });
    }
  });

  const calcLedgerBal = (ledger: any, groupType: string): number => {
    let debit = 0;
    let credit = 0;
    let hasTransactions = false;

    const lidNum = Number(ledger.id);
    const isInvestmentLedger = lidNum >= 500000;

    entries.forEach((e: any) => {
      if (String(e.ledgerId) !== String(ledger.id)) return;

      const v = voucherMap[e.voucherId];
      const entryDate = e.date || v?.date;
      const entryAcid = e.accountId || v?.accountId;
      const entryPfid = v?.portfolioId;

      const isOpeningBalance = !entryDate || entryDate === '' || entryDate === 'undefined'
        || String(entryDate).startsWith('0001');

      if (!isOpeningBalance && entryDate > endDate) return;

      if (accountId) {
        const belongsToAccount =
          (entryAcid === accountId) ||
          (entryPfid && portfolioIds?.includes(entryPfid));
        if (!belongsToAccount) return;
      }

      hasTransactions = true;
      debit  += e.debit  || 0;
      credit += e.credit || 0;
    });

    if (!hasTransactions) {
      if (ledger._acmac1NetBalance !== undefined) {
        return groupType === "ASSET" ? ledger._acmac1NetBalance : -ledger._acmac1NetBalance;
      }
      return ledger.openingType === "DR"
        ? (groupType === "ASSET" ? ledger.openingBalance : -ledger.openingBalance)
        : (groupType === "ASSET" ? -ledger.openingBalance : ledger.openingBalance);
    }

    return groupType === "ASSET" ? debit - credit : credit - debit;
  };

  const groupMap: Record<string, any> = {};
  groups.forEach((g: any) => {
    groupMap[g.id] = { ...g, balance: 0, children: [], ledgers: [] };
  });

  ledgersToInclude.forEach((l: any) => {
    let targetGroup = String(l.groupId);
    if (!groupMap[targetGroup]) {
      const gThis = groups.find((g: any) => String(g.id) === targetGroup);
      if (gThis) targetGroup = String(gThis.id);
      else targetGroup = '200180';
    }

    if (groupMap[targetGroup]) {
      const type = getGroupType(targetGroup);
      let bal = calcLedgerBal(l, type);

      let displayBalance = bal;
      if (type === 'LIABILITY' && bal < 0) {
        bal = -bal;
        displayBalance = bal;
      }

      // Check if already in targetGroup:
      if (!groupMap[targetGroup].ledgers.some((x: any) => String(x.id) === String(l.id))) {
        groupMap[targetGroup].ledgers.push({ ...l, balance: bal, displayBalance, groupType: type });
      }
    }
  });

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

  const assets = tree.filter(g => getGroupType(g.id) === "ASSET");
  const liabilities = tree.filter(g => getGroupType(g.id) !== "ASSET");

  const totalAssets = assets.reduce((s, g) => s + g.balance, 0);
  const totalLiabilities = liabilities.reduce((s, g) => s + g.balance, 0);

  console.log("=== RESULTS WITH DEDUPLICATION ===");
  console.log(`Total Assets: ?${totalAssets.toFixed(2)}`);
  console.log(`Total Liabilities: ?${totalLiabilities.toFixed(2)}`);
  console.log(`Difference: ?${(totalAssets - totalLiabilities).toFixed(2)}`);
}
testDedup().catch(console.error);
