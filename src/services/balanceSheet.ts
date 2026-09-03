import { getStoredGroups, getStoredLedgers, getStoredEntries, getStoredVouchers, getStoredPortfolios, getAssetName, state } from "../logic";

// ── MProfit Synthetic MAID → GroupID Mapping ─────────────────────────────────
// These are internal MProfit ledger IDs that appear as maid values in Trans1
// but do NOT have rows in ACMA1. Verified by inspecting SQLite Trans1 narrations.
const SYNTHETIC_MAID_GROUP: Record<number, string> = {
  230: '64',      // Capital Account (Year-end "transfer to capital account" JV)
  621: '60',      // Cash on Hand (UPI/FastTag/petty payments)
  401: '200040',  // Traded Bonds / NCD interest received
  405: '200120',  // PPF / EPF returns
  407: '160',     // Misc interest/charges paid (Expenses)
  415: '160',     // Miscellaneous charges (Expenses)
  205: '90',      // Sundry Debtors / misc receivables
  460: '180',     // Capital Gains – Equity LTCG
  465: '180',     // Capital Gains – Equity STCG
  470: '180',     // Capital Gains – Debt LTCG
  475: '180',     // Capital Gains – Debt STCG
  480: '180',     // Capital Gains – Other
  485: '180',     // Capital Gains – Exempted
  490: '180',     // Capital Gains – STT Paid
  603: '180',     // Capital Gains – Misc
  650: '160',     // STT – Equity Delivery (Expenses)
  655: '160',     // STT – Equity Intraday
  660: '160',     // STT – Futures
  665: '160',     // STT – Options
  670: '160',     // Transaction Charges
  235: '75',      // Sundry Creditors (net credit balance)
  // Broker clearing/settlement accounts — MProfit classifies brokers in Sundry Creditors (75)
  100001: '75',   // R K Global settlement
  100002: '75',   // RKSV / Kotak Securities settlement
  100003: '75',
  100004: '75',   // MStock / other broker settlement
  100005: '75',
  100006: '75',
  100007: '75',   // Zerodha settlement
  100008: '75',   // MStock / Mirae Asset settlement
  100009: '75',
  100010: '75',
};

// Synthetic maid display names matching MProfit
const SYNTHETIC_MAID_NAME: Record<number, string> = {
  230: 'Capital Account',
  621: 'Cash on Hand',
  407: 'Interest / Misc Charges',
  401: 'Interest Income',
  405: 'Interest Income (Tax Free)',
  415: 'Dividend Income',
  460: 'Capital Gains – Eq LTCG',
  465: 'Capital Gains – Eq STCG',
  470: 'Capital Gains – Debt LTCG',
  475: 'Capital Gains – Debt STCG',
  480: 'Capital Gains – Other',
  485: 'Capital Gains – Exempted',
  490: 'Capital Gains – STT Paid',
  603: 'Capital Gains – Misc',
  650: 'STT – Delivery',
  655: 'STT – Intraday',
  660: 'STT – Futures',
  665: 'STT – Options',
  670: 'Transaction Charges',
  100001: 'R K Global',
  100002: 'RKSV',
  100004: 'Direct',
  100007: 'Zerodha',
  100008: 'MStock',
  235: 'Sundry Creditors',
};

// SAM atty → MProfit Investment group
const ATTY_TO_GROUP: Record<number, string> = {
  50: '200050', 60: '200061', 61: '200062', 62: '200061',
  70: '200141', 75: '200075', 77: '200077', 80: '200140',
  90: '200095', 100: '200040', 110: '200070', 120: '200115',
  130: '200120', 140: '200135', 150: '200075', 151: '200077',
  160: '200150', 170: '200155', 180: '200145', 190: '200066',
  200: '200058', 210: '200160', 220: '200195', 240: '200051',
};

// Maid values to completely skip — none at this time.
// (Broker clearing accounts must be INCLUDED to maintain double-entry balance.)
const SKIP_MAIDS = new Set<number>([]);

// Resolve correct group for synthetic maid values
function resolveSyntheticGroup(lidNum: number, stateRef: any): string {
  if (SYNTHETIC_MAID_GROUP[lidNum]) return SYNTHETIC_MAID_GROUP[lidNum];
  if (lidNum >= 100001 && lidNum <= 100099) return '75'; // Broker clearing → Sundry Creditors
  if (lidNum >= 460 && lidNum <= 499) return '180';      // Capital Gains
  if (lidNum >= 600 && lidNum <= 699) return '160';      // STT/Charges (Expenses)
  if (lidNum >= 500000) {
    // SAM investment asset
    const sam = (stateRef.sam || []).find((s: any) => Number(s.amid) === lidNum);
    if (sam?.atty && ATTY_TO_GROUP[Number(sam.atty)]) return ATTY_TO_GROUP[Number(sam.atty)];
    const am = (stateRef.assetMaster || []).find((a: any) => Number(a.amid) === lidNum);
    if (am?.asset_type && ATTY_TO_GROUP[Number(am.asset_type)]) return ATTY_TO_GROUP[Number(am.asset_type)];
    return '200070'; // Default: NCD/Debentures
  }
  return '50'; // Default: Investments
}

export async function getBalanceSheet(_startDate: string, endDate: string, accountId?: string) {

  // Always pass accountId to getStoredGroups/getStoredLedgers for account isolation.
  const groups  = getStoredGroups(accountId);
  const ledgers = getStoredLedgers(accountId);
  const entries = getStoredEntries();
  const vouchers = getStoredVouchers();

  // Walk up parent chain to find the root type of a group
  const getGroupType = (groupId: string): string => {
    let current: any = groups.find((g: any) => g.id === groupId);
    while (current) {
      if (current.type) return current.type;
      current = groups.find((g: any) => g.id === current.parent);
    }
    return "ASSET";
  };

  // Build voucher map for quick lookup
  const voucherMap: Record<string, any> = {};
  vouchers.forEach((v: any) => voucherMap[v.id] = v);

  // Filter portfolios if accountId is provided
  const allPortfolios = getStoredPortfolios();
  const portfolioIds = accountId
    ? allPortfolios.filter((p: any) => p.accountId === accountId).map((p: any) => p.id)
    : null;

  // All ledgers: acid-specific + global (acid=-1)
  // NOTE: ACMA1.db_bal / cr_bal are MProfit's NET stored balances, not just opening balances.
  // When db_bal === cr_bal the account is zeroed/closed (e.g. HDFC after closing entry).
  // We pass the net (db-cr) as openingBalance so the balance sheet reflects MProfit's computed value.
  // For ACMA1 ledgers, Trans1 VID=0 entries (DT=0001-01-01) are the opening-balance rows
  // already included in the Trans1 running sum — do NOT also add openingBalance from ACMA1
  // or you will double-count.
  // For a specific account, allLedgers should contain only the ledgers belonging to that account.
  // Including acid=-1 globally causes duplicate ledgers (e.g. Dharampur, Jewellery) to be added multiple times.
  const allLedgers = getStoredLedgers(accountId);

  // ─────────────────────────────────────────────────────────────────────────
  // CORE ARCHITECTURE: MProfit double-entry uses two tables:
  //   transc1 (c_ prefix) = bank/cash/accounting side (MAID < 500000)
  //   trans1  (t_ prefix) = investment/asset side     (MAID >= 500000)
  //
  // For shared MAIDs (e.g. HDFC=11 appears in BOTH), summing both tables
  // doubles the balance. The rule is:
  //   - Accounting ledgers (MAID < 500000)  → use ONLY transc1 (c_) entries
  //   - Investment ledgers (MAID >= 500000) → use ONLY trans1  (t_) entries
  //
  // Opening balance rows: MProfit VID=0 DT=0001-01-01 entries in trans1
  //   represent the starting balance at 01-Apr-2019. Include them always.
  // ─────────────────────────────────────────────────────────────────────────
  const calcLedgerBal = (ledger: any, groupType: string): number => {
    let debit = 0;
    let credit = 0;
    let hasTransactions = false;

    const lidNum = Number(ledger.id);
    // Investment assets are encoded as 500000 + SAM.amid in MProfit v10
    const isInvestmentLedger = lidNum >= 500000;

    entries.forEach((e: any) => {
      if (String(e.ledgerId) !== String(ledger.id)) return;

      const v = voucherMap[e.voucherId];
      const entryDate = e.date || v?.date;
      const entryAcid = e.accountId || v?.accountId;
      const entryPfid = v?.portfolioId;

      // Opening balance rows: no date, or MProfit year-0001 sentinel (VID=0)
      const isOpeningBalance = !entryDate || entryDate === '' || entryDate === 'undefined'
        || String(entryDate).startsWith('0001');

      // Skip future entries (but always include opening balance rows)
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

    return groupType === "ASSET" ? debit - credit : credit - debit;
  };


  const groupMap: Record<string, any> = {};
  groups.forEach((g: any) => {
    groupMap[g.id] = { ...g, balance: 0, children: [], ledgers: [] };
  });

  const seenLids = new Set<string>();
  const ledgersToInclude: any[] = [];

  // 1. Add standard account ledgers (deduplicated by ID)
  allLedgers.forEach((l: any) => {
    const lidStr = String(l.id);
    if (!seenLids.has(lidStr)) {
      seenLids.add(lidStr);
      ledgersToInclude.push(l);
    }
  });

  // 2. Add all remaining ledgers from entries (synthetic/investment)
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

      // Try to find in allLedgers first (covers acid=-1 global ledgers)
      const existing = allLedgers.find((x: any) => String(x.id) === String(e.ledgerId));
      if (existing) {
        ledgersToInclude.push(existing);
        return;
      }

      // Synthetic maid resolution
      const lidNum = Number(e.ledgerId);

      // Skip broker clearing / settlement accounts
      if (SKIP_MAIDS.has(lidNum)) return;

      const resolvedGroup = resolveSyntheticGroup(lidNum, state);
      if (resolvedGroup === 'SKIP') return;

      let name: string;
      if (SYNTHETIC_MAID_NAME[lidNum]) {
        name = SYNTHETIC_MAID_NAME[lidNum];
      } else if (lidNum >= 500000) {
        // MProfit v10: investment maid = 500000 + SAM.amid
        // getAssetName now strips 500000 and looks up SAM.anm directly
        const resolved = getAssetName(lidNum);
        if (resolved) {
          name = resolved;
        } else {
          // Last resort: look up in SAM by stripped ID and use ISIN or short name
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

  // Attach ledgers to groupMap
  ledgersToInclude.forEach((l: any) => {
    let targetGroup = String(l.groupId);
    if (!groupMap[targetGroup]) {
      const gThis = groups.find((g: any) => String(g.id) === targetGroup);
      if (gThis) {
        targetGroup = String(gThis.id);
      } else {
        // Group not in map: fallback based on known type
        const knownType = (['64','65','75','85','150','155','160','170','175','180'].includes(targetGroup))
          ? 'liability' : 'asset';
        targetGroup = knownType === 'liability' ? '1' : '2';
      }
    }

    const type = getGroupType(targetGroup);
    let bal = calcLedgerBal(l, type);

    const displayBalance = type === 'EXPENSE' ? Math.abs(bal) : bal;

    // Keep P&L Capital Gain ledgers visible for drilldown even if zero balance
    const isPnlOrSpecial = [
      '460', '465', '470', '475', '485', '490', '480', '180', '230'
    ].includes(String(l.id)) || (Number(l.id) > 0 && Number(l.id) < 100000);
    if (Math.abs(bal) < 0.01 && !isPnlOrSpecial) return;

    if (groupMap[targetGroup]) {
      if (!groupMap[targetGroup].ledgers.some((x: any) => String(x.id) === String(l.id))) {
        groupMap[targetGroup].ledgers.push({ ...l, balance: bal, displayBalance, groupType: type });
      }
    }
  });

  // Build tree (parent-child hierarchy)
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

  const assets      = tree.filter(g => getGroupType(g.id) === "ASSET");
  const liabilities = tree.filter(g => getGroupType(g.id) !== "ASSET");

  const totalAssets      = assets.reduce((s, g) => s + g.balance, 0);
  const totalLiabilities = liabilities.reduce((s, g) => s + g.balance, 0);

  return {
    assets,
    liabilities,
    totalAssets,
    totalLiabilities,
  };
}
