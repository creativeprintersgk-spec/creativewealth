import { getStoredGroups, getStoredLedgers, getStoredEntries, getStoredVouchers, getStoredPortfolios } from "../logic";

export async function getProfitLoss(startDate: string, endDate: string, accountId?: string) {
  const groups  = getStoredGroups(accountId)
  const ledgers = getStoredLedgers(accountId)
  const entries = getStoredEntries()
  const vouchers = getStoredVouchers()

  const getGroupType = (groupId: string): string => {
    let current: any = groups.find((g: any) => g.id === groupId)
    while (current) {
      if (current.type) return current.type
      current = groups.find((g: any) => g.id === current.parent)
    }
    return "ASSET"
  }

  const voucherMap: Record<string, any> = {}
  vouchers.forEach((v: any) => voucherMap[v.id] = v)

  const allPortfolios = getStoredPortfolios();
  const portfolioIds = accountId
    ? allPortfolios.filter((p: any) => p.accountId === accountId).map((p: any) => p.id)
    : null;

  const calcLedgerBal = (ledger: any, groupType: string): number => {
    let debit = 0, credit = 0;
    entries.forEach((e: any) => {
      if (String(e.ledgerId) === String(ledger.id)) {
        const v = voucherMap[e.voucherId]
        const entryDate = e.date || v?.date
        const entryAcid = e.accountId || v?.accountId
        const entryPfid = v?.portfolioId

        if (entryDate && entryDate >= startDate && entryDate <= endDate) {
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
    // For EXPENSE, debit balance is positive
    // For INCOME, credit balance is positive
    return groupType === "EXPENSE" ? debit - credit : credit - debit;
  };

  const groupMap: Record<string, any> = {}
  groups.forEach((g: any) => {
    groupMap[g.id] = { ...g, balance: 0, children: [], ledgers: [] }
  })

  // Find missing ledgers for P&L
  const ledgerIdsInEntries = new Set<string>();
  entries.forEach((e: any) => {
    const v = voucherMap[e.voucherId];
    const entryDate = e.date || v?.date;
    const entryAcid = e.accountId || v?.accountId;
    const entryPfid = v?.portfolioId;

    if (entryDate && entryDate >= startDate && entryDate <= endDate) {
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
    const allLedgers = getStoredLedgers(); 
    missingLedgerIds.forEach(id => {
      const globalLedger = allLedgers.find((l: any) => String(l.id) === String(id));
      if (globalLedger) ledgers.push(globalLedger);
    });
  }

  ledgers.forEach((l: any) => {
    if (!groupMap[l.groupId]) return
    const type = getGroupType(l.groupId)
    if (type !== 'INCOME' && type !== 'EXPENSE') return
    const bal = calcLedgerBal(l, type)
    groupMap[l.groupId].ledgers.push({ ...l, balance: bal, displayBalance: bal, groupType: type })
  })

  const tree: any[] = []
  Object.values(groupMap).forEach((g: any) => {
    const type = getGroupType(g.id)
    if (type !== 'INCOME' && type !== 'EXPENSE') return
    
    const isParentPLElement = g.parent && groupMap[g.parent] &&
      (getGroupType(g.parent) === "INCOME" || getGroupType(g.parent) === "EXPENSE");
    
    if (isParentPLElement) {
      groupMap[g.parent].children.push(g)
    } else {
      tree.push(g)
    }
  })

  const calcGroupBalance = (group: any): number => {
    let bal = group.ledgers.reduce((s: number, l: any) => s + l.balance, 0)
    group.children.forEach((child: any) => { bal += calcGroupBalance(child) })
    group.balance = bal
    return bal
  }
  tree.forEach(g => calcGroupBalance(g))

  const incomes  = tree.filter(g => getGroupType(g.id) === "INCOME")
  const expenses = tree.filter(g => getGroupType(g.id) === "EXPENSE")

  const totalIncome  = incomes.reduce((s, g) => s + g.balance, 0)
  const totalExpense = expenses.reduce((s, g) => s + g.balance, 0)

  return {
    incomes,
    expenses,
    totalIncome,
    totalExpense,
    netProfit:    totalIncome - totalExpense
  }
}
