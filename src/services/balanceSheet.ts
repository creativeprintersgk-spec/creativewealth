import { getStoredGroups, getStoredLedgers, getStoredEntries, getStoredVouchers, getStoredPortfolios } from "../logic";

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
    let debit = 0, credit = 0;
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
        ledgers.push(globalLedger);
      } else {
        // Create a virtual ledger for missing/null IDs to preserve double-entry balance
        ledgers.push({
          id: id,
          name: `Unassigned Ledger (${id})`,
          groupId: 'suspense_virtual',
          accountId: accountId || 31
        } as any)

      }
    });
  }

  // Ensure a Suspense group exists for orphaned ledgers
  if (!groupMap['suspense_virtual']) {
    groupMap['suspense_virtual'] = { 
      id: 'suspense_virtual', 
      name: 'Suspense / Unassigned', 
      type: 'LIABILITY', 
      balance: 0, 
      children: [], 
      ledgers: [] 
    };
  }

  // Attach acid-filtered (plus any missing) ledgers to their groups
  ledgers.forEach((l: any) => {
    let targetGroup = l.groupId;
    if (!groupMap[targetGroup]) {
      targetGroup = 'suspense_virtual'; // Never drop ledgers!
    }
    const type = getGroupType(targetGroup)
    const bal = calcLedgerBal(l, type)
    // Expenses are DR-heavy → displayBalance is a positive magnitude for clean rendering
    const displayBalance = type === 'EXPENSE' ? Math.abs(bal) : bal
    groupMap[targetGroup].ledgers.push({ ...l, balance: bal, displayBalance, groupType: type })
  })

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
