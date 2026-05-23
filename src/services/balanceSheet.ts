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
      if (e.ledgerId === ledger.id) {
        const v = voucherMap[e.voucherId]
        const entryDate = e.date || v?.date
        const entryAcid = e.accountId || v?.accountId
        const entryPfid = v?.portfolioId

        if (entryDate && entryDate <= endDate) {
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

  // Attach acid-filtered ledgers to their groups
  ledgers.forEach((l: any) => {
    if (!groupMap[l.groupId]) return
    const type = getGroupType(l.groupId)
    const bal = calcLedgerBal(l, type)
    // Expenses are DR-heavy → displayBalance is a positive magnitude for clean rendering
    const displayBalance = type === 'EXPENSE' ? Math.abs(bal) : bal
    groupMap[l.groupId].ledgers.push({ ...l, balance: bal, displayBalance, groupType: type })
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

  function removeZero(items: any[]): any[] {
    return items.filter((item: any) => {
      if (item.children) item.children = removeZero(item.children)
      if (item.ledgers)  item.ledgers  = item.ledgers.filter((l: any) => l.balance !== 0)
      return (
        item.balance !== 0 ||
        (item.children && item.children.length > 0) ||
        (item.ledgers  && item.ledgers.length  > 0)
      )
    })
  }

  return {
    assets:      removeZero(assets),
    liabilities: removeZero(liabilities),
    totalAssets,
    totalLiabilities,
  }
}
