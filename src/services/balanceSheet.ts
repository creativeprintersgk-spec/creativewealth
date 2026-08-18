import { getStoredGroups, getStoredLedgers, getStoredEntries, getStoredVouchers, getStoredPortfolios } from "../logic.ts";

export async function getBalanceSheet(_startDate: string, endDate: string, accountId?: string) {

  // CRITICAL FIX: Always pass accountId to getStoredGroups/getStoredLedgers.
  // acmac1.id is NOT globally unique — id=64 "Capital Account" exists for every person (acid).
  // Without this filter, all 7 persons' ledgers get attached to the same group node,
  // causing "Capital Account" to appear 7 times with repeated identical values.
  const groups  = getStoredGroups(accountId)
  const ledgers = getStoredLedgers(accountId)
  const entries = getStoredEntries()
  const vouchers = getStoredVouchers()

  // Walk up parent chain to find the root type of a group
  const getGroupType = (groupId: string): string => {
    let current: any = groups.find((g: any) => g.id === groupId)
    while (current) {
      if (current.type) return current.type
      current = groups.find((g: any) => g.id === current.parent)
    }
    return "ASSET"
  }

  // Build voucher map for quick lookup
  const voucherMap: Record<string, any> = {}
  vouchers.forEach((v: any) => voucherMap[v.id] = v)

  // Filter portfolios if accountId is provided (for portfolio-level isolation)
  const allPortfolios = getStoredPortfolios();
  const portfolioIds = accountId
    ? allPortfolios.filter((p: any) => p.accountId === accountId).map((p: any) => p.id)
    : null;

  // Local balance calculator iterating over entries directly to handle vid=0 (opening entries)
  const calcLedgerBal = (ledger: any, groupType: string): number => {
    let debit = 0;
    let credit = 0;
    entries.forEach((e: any) => {
      if (String(e.ledgerId) === String(ledger.id)) {
        const v = voucherMap[e.voucherId]
        const entryDate = e.date || v?.date
        const entryAcid = e.accountId || v?.accountId
        const entryPfid = v?.portfolioId

        // Opening balance entries (vid=0) have null date — treat as always included (inception).
        // Regular entries must have a date within the report period.
        const isOpeningBalance = !entryDate || entryDate === '' || entryDate === 'undefined';
        const dateOk = isOpeningBalance || entryDate <= endDate;

        if (dateOk) {
          if (accountId) {
            const belongsToAccount =
              (entryAcid === accountId) ||
              (entryPfid && portfolioIds?.includes(entryPfid));
            if (!belongsToAccount) return;
          }
          debit  += e.debit  || 0;
          credit += e.credit || 0;
        }
      }
    });
    return groupType === "ASSET" ? debit - credit : credit - debit;
  };

  // Build group map from acid-filtered groups only
  const groupMap: Record<string, any> = {}
  groups.forEach((g: any) => {
    groupMap[g.id] = { ...g, balance: 0, children: [], ledgers: [] }
  })

  // Find any ledgers missing from the acid-filtered list that are used in valid entries
  const ledgerIdsInEntries = new Set<string>();
  entries.forEach((e: any) => {
    const v = voucherMap[e.voucherId];
    const entryDate = e.date || v?.date;
    const entryAcid = e.accountId || v?.accountId;
    const entryPfid = v?.portfolioId;

    const isOpeningBalance = !entryDate || entryDate === '' || entryDate === 'undefined';
    const dateOk = isOpeningBalance || entryDate <= endDate;

    if (dateOk) {
      if (accountId) {
        const belongsToAccount =
          (entryAcid === accountId) ||
          (entryPfid && portfolioIds?.includes(entryPfid));
        if (belongsToAccount) {
          ledgerIdsInEntries.add(e.ledgerId);
        }
      } else {
        ledgerIdsInEntries.add(e.ledgerId);
      }
    }
  });

  const existingLedgerIds = new Set(ledgers.map((l: any) => l.id));
  const missingLedgerIds = Array.from(ledgerIdsInEntries).filter(id => !existingLedgerIds.has(id));

  if (missingLedgerIds.length > 0) {
    const allLedgers = getStoredLedgers(); // Fetch all without acid filter
    missingLedgerIds.forEach(id => {
      const globalLedger = allLedgers.find((l: any) => String(l.id) === String(id));
      if (globalLedger) {
        // If we are rendering for a specific account, only include cross-account ledgers
        // that actually belong to this account. Skip those from other accounts entirely.
        if (accountId && globalLedger.acid && Number(globalLedger.acid) !== Number(accountId)) {
          // This ledger belongs to a different family member's account — skip it.
          // It will be correctly shown on their balance sheet instead.
          return;
        }
        ledgers.push(globalLedger);
      } else {
        // Truly unresolvable ledger ID — create a virtual one only for non-filtered views
        if (!accountId) {
          ledgers.push({
            id: id,
            name: `Unassigned Ledger (${id})`,
            groupId: 'suspense_virtual',
            accountId: accountId || 31
          } as any);
        }
      }
    });
  }

  // Attach acid-filtered and portfolio-linked ledgers to their groups
  const allLedgers = getStoredLedgers();
  const seenLids = new Set<string>();
  const ledgersToInclude: any[] = [];

  // 1. First add standard account ledgers (including P&L Capital Gains ledgers)
  ledgers.forEach((l: any) => {
    seenLids.add(String(l.id));
    ledgersToInclude.push(l);
  });

  // 2. Add all asset ledgers that have entries belonging to this account / linked portfolios
  entries.forEach((e: any) => {
    const v = voucherMap[e.voucherId];
    const entryDate = e.date || v?.date;
    const entryAcid = e.accountId || v?.accountId;
    const entryPfid = v?.portfolioId;

    const isOpeningBalance = !entryDate || entryDate === '' || entryDate === 'undefined';
    const dateOk = isOpeningBalance || entryDate <= endDate;

    if (dateOk) {
      const belongsToAccount = !accountId ||
        (entryAcid === accountId) ||
        (entryPfid && portfolioIds?.includes(entryPfid));

      if (belongsToAccount && !seenLids.has(String(e.ledgerId))) {
        seenLids.add(String(e.ledgerId));
        const l = allLedgers.find((x: any) => String(x.id) === String(e.ledgerId));
        if (l) {
          ledgersToInclude.push(l);
        }
      }
    }
  });

  // Attach ledgers to groupMap
  ledgersToInclude.forEach((l: any) => {
    let targetGroup = String(l.groupId);
    if (!groupMap[targetGroup]) {
      const gGlobal = groups.find((g: any) => String(g.id) === targetGroup);
      if (gGlobal) targetGroup = String(gGlobal.id);
      else if (Number(l.id) >= 100000) targetGroup = '50'; // Default unmapped securities to Investments
      else if (!accountId) targetGroup = 'suspense_virtual';
      else return;
    }

    const type = getGroupType(targetGroup);
    const bal = calcLedgerBal(l, type);
    const displayBalance = type === 'EXPENSE' ? Math.abs(bal) : bal;

    // Keep P&L Capital Gain ledgers and standard account ledgers visible for drilldown even if zero balance
    const isPnlOrSpecial = ['460', '465', '470', '475', '485', '490', '480', '180'].includes(String(l.id)) || Number(l.id) < 100000;
    if (Math.abs(bal) < 0.01 && !isPnlOrSpecial) return;

    if (groupMap[targetGroup]) {
      groupMap[targetGroup].ledgers.push({ ...l, balance: bal, displayBalance, groupType: type });
    }
  });

  // Build tree (parent-child hierarchy)
  const tree: any[] = []
  Object.values(groupMap).forEach((g: any) => {
    if (g.parent && groupMap[g.parent]) {
      groupMap[g.parent].children.push(g)
    } else {
      tree.push(g)
    }
  })

  // Recursively calculate group balances (bottom-up)
  const calcGroupBalance = (group: any): number => {
    let bal = group.ledgers.reduce((s: number, l: any) => s + l.balance, 0)
    group.children.forEach((child: any) => { bal += calcGroupBalance(child) })
    group.balance = bal
    return bal
  }
  tree.forEach(g => calcGroupBalance(g))

  // Assets = ASSET type only; Liabilities = everything else (LIABILITY, INCOME, EXPENSE)
  const assets      = tree.filter(g => getGroupType(g.id) === "ASSET")
  const liabilities = tree.filter(g => getGroupType(g.id) !== "ASSET")

  const totalAssets      = assets.reduce((s, g) => s + g.balance, 0)
  const totalLiabilities = liabilities.reduce((s, g) => s + g.balance, 0)

  return {
    assets,
    liabilities,
    totalAssets,
    totalLiabilities,
  }
}
