import * as db from "../db/helpers";

export async function getBalanceSheet(_startDate: string, endDate: string, accountId?: string) {

  const groups  = await db.getAll("groups")
  const ledgers = await db.getAll("ledgers")
  const entries = await db.getAll("entries")
  const vouchers = await db.getAll("vouchers")

  // Walk up parent chain to find the root type of a group
  const getGroupType = (groupId: string): string => {
    let current: any = groups.find((g: any) => g.id === groupId)
    while (current) {
      if (current.type) return current.type
      current = groups.find((g: any) => g.id === current.parent)
    }
    return "ASSET"
  }

  // Pre-group entries by voucher for performance
  const entriesByVoucher: Record<string, any[]> = {}
  entries.forEach((e: any) => {
    if (!entriesByVoucher[e.voucherId]) entriesByVoucher[e.voucherId] = []
    entriesByVoucher[e.voucherId].push(e)
  })

  // Filter portfolios if accountId is provided
  const allPortfolios = await db.getAll("portfolios");
  const portfolioIds = accountId ? allPortfolios.filter((p: any) => p.accountId === accountId).map((p: any) => p.id) : null;

  const getLedgerBalance = (ledger: any, groupType: string): number => {
    let debit = 0
    let credit = 0

    if (ledger.openingBalance) {
      if (ledger.openingType === 'DR') debit  += ledger.openingBalance
      else if (ledger.openingType === 'CR') credit += ledger.openingBalance
    }

    vouchers.forEach((v: any) => {
      if (v.date <= endDate) {
        // Account Isolation
        if (accountId) {
          const vAccount = v.accountId;
          const vPortId = v.portfolioId;
          const belongsToAccount = (vAccount === accountId) || (vPortId && portfolioIds?.includes(vPortId));
          if (!belongsToAccount) return;
        }

        ;(entriesByVoucher[v.id] || []).forEach((e: any) => {
          if (e.ledgerId === ledger.id) {
            debit  += e.debit  || 0
            credit += e.credit || 0
          }
        })
      }
    })

    if (groupType === "ASSET") return debit - credit
    return credit - debit   // LIABILITY, INCOME, EXPENSE
  }

  // Build group map — ALL groups included (P&L shows as tree in liabilities)
  const groupMap: Record<string, any> = {}
  groups.forEach((g: any) => {
    groupMap[g.id] = { ...g, balance: 0, children: [], ledgers: [] }
  })

  // Attach ledgers to their groups
  ledgers.forEach((l: any) => {
    if (!groupMap[l.groupId]) return
    const type = getGroupType(l.groupId)
    const bal = getLedgerBalance(l, type)
    // Expenses are DR-heavy → balance is negative under CR−DR convention.
    // displayBalance is always a positive magnitude for clean rendering.
    const displayBalance = type === 'EXPENSE' ? Math.abs(bal) : bal
    groupMap[l.groupId].ledgers.push({ ...l, balance: bal, displayBalance, groupType: type })
  })

  // Build tree
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
