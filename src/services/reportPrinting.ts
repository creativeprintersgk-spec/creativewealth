import { getStoredGroups, getStoredLedgers, getStoredEntries, getStoredVouchers, getStoredPortfolios } from "../logic";

export interface LedgerPrintData {
  id: string;
  name: string;
  groupName: string;
  openingBalance: number;
  transactions: {
    date: string;
    voucherType: string;
    voucherId: string;
    againstLedger: string;
    narration: string;
    debit: number;
    credit: number;
    balance: number;
  }[];
  closingBalance: number;
}

export interface VoucherPrintData {
  id: string;
  date: string;
  voucherNo: string;
  type: string;
  narration: string;
  lines: {
    ledgerId: string;
    ledgerName: string;
    debit: number;
    credit: number;
    quantity?: number;
    price?: number;
    narration?: string;
  }[];
  totalAmount: number;
}

export async function getTrialBalance(endDate: string, accountId?: string) {
  const groups = getStoredGroups(accountId);
  const ledgers = getStoredLedgers(accountId);
  const entries = getStoredEntries();
  const vouchers = getStoredVouchers();

  const getGroupType = (groupId: string): string => {
    let current: any = groups.find((g: any) => g.id === groupId);
    while (current) {
      if (current.type) return current.type;
      current = groups.find((g: any) => g.id === current.parent);
    }
    return "ASSET";
  };

  const voucherMap: Record<string, any> = {};
  vouchers.forEach((v: any) => (voucherMap[v.id] = v));

  const allPortfolios = getStoredPortfolios();
  const portfolioIds = accountId
    ? allPortfolios.filter((p: any) => p.accountId === accountId).map((p: any) => p.id)
    : null;

  // Calculate closing balance for all ledgers
  const ledgerBalances: Record<string, { debit: number; credit: number; balance: number }> = {};
  
  // Find missing ledgers for Trial Balance
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
          entryAcid === accountId || (entryPfid && portfolioIds?.includes(entryPfid));
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
    let dr = l.openingType === "DR" ? l.openingBalance || 0 : 0;
    let cr = l.openingType === "CR" ? l.openingBalance || 0 : 0;

    entries.forEach((e: any) => {
      if (String(e.ledgerId) === String(l.id)) {
        const v = voucherMap[e.voucherId];
        const entryDate = e.date || v?.date;
        const entryAcid = e.accountId || v?.accountId;
        const entryPfid = v?.portfolioId;

        const isOpeningBalance = !entryDate || entryDate === '' || entryDate === 'undefined';
        const dateOk = isOpeningBalance || entryDate <= endDate;

        if (dateOk) {
          if (accountId) {
            const belongsToAccount =
              entryAcid === accountId || (entryPfid && portfolioIds?.includes(entryPfid));
            if (!belongsToAccount) return;
          }
          dr += e.debit || 0;
          cr += e.credit || 0;
        }
      }
    });

    let bal = dr - cr; // net debit balance
    if (Math.abs(bal) < 0.005) {
      bal = 0;
    }
    if (bal >= 0) {
      ledgerBalances[l.id] = { debit: bal, credit: 0, balance: bal };
    } else {
      ledgerBalances[l.id] = { debit: 0, credit: Math.abs(bal), balance: bal };
    }
  });

  // Build recursive tree to compute group aggregates
  const groupMap: Record<string, any> = {};
  groups.forEach((g: any) => {
    groupMap[g.id] = { ...g, debit: 0, credit: 0, balance: 0, children: [], ledgers: [] };
  });

  ledgers.forEach((l: any) => {
    if (!groupMap[l.groupId]) return;
    const b = ledgerBalances[l.id] || { debit: 0, credit: 0, balance: 0 };
    groupMap[l.groupId].ledgers.push({
      id: l.id,
      name: l.name,
      debit: b.debit,
      credit: b.credit,
      balance: b.balance,
    });
  });

  const tree: any[] = [];
  Object.values(groupMap).forEach((g: any) => {
    if (g.parent && groupMap[g.parent]) {
      groupMap[g.parent].children.push(g);
    } else {
      tree.push(g);
    }
  });

  const calcGroupTotals = (group: any) => {
    let netBal = group.ledgers.reduce((s: number, l: any) => s + l.balance, 0);
    
    group.children.forEach((child: any) => {
      calcGroupTotals(child);
      netBal += child.balance;
    });

    if (Math.abs(netBal) < 0.005) {
      netBal = 0;
    }
    group.balance = netBal;
    if (netBal >= 0) {
      group.debit = netBal;
      group.credit = 0;
    } else {
      group.debit = 0;
      group.credit = Math.abs(netBal);
    }
  };

  tree.forEach((g) => calcGroupTotals(g));

  // Compute Grand Totals from ledgers directly
  let totalDebit = 0;
  let totalCredit = 0;
  Object.values(ledgerBalances).forEach((b) => {
    totalDebit += b.debit;
    totalCredit += b.credit;
  });

  return {
    tree,
    totalDebit,
    totalCredit,
  };
}

export async function getBatchLedgers(
  ledgerIds: string[],
  startDate: string,
  endDate: string,
  accountId?: string
): Promise<LedgerPrintData[]> {
  const ledgers = getStoredLedgers(accountId);
  const entries = getStoredEntries();
  const vouchers = getStoredVouchers();
  const groups = getStoredGroups();

  const voucherMap: Record<string, any> = {};
  vouchers.forEach((v: any) => (voucherMap[v.id] = v));

  const allPortfolios = getStoredPortfolios();
  const portfolioIds = accountId
    ? allPortfolios.filter((p: any) => p.accountId === accountId).map((p: any) => p.id)
    : null;

  const result: LedgerPrintData[] = [];

  const getGroupType = (groupId: string): string => {
    let current: any = groups.find((g: any) => g.id === groupId);
    while (current) {
      if (current.type) return current.type;
      current = groups.find((g: any) => g.id === current.parent);
    }
    return "ASSET";
  };

  for (const id of ledgerIds) {
    const l = ledgers.find((item) => item.id === id);
    if (!l) continue;

    const group = groups.find((g) => g.id === l.groupId);
    const groupType = getGroupType(l.groupId);

    // 1. Calculate Opening Balance (inception up to startDate - 1 day)
    let opDr = l.openingType === "DR" ? l.openingBalance || 0 : 0;
    let opCr = l.openingType === "CR" ? l.openingBalance || 0 : 0;

    entries.forEach((e: any) => {
      if (String(e.ledgerId) === String(l.id)) {
        const v = voucherMap[e.voucherId];
        const entryDate = e.date || v?.date;
        const entryAcid = e.accountId || v?.accountId;
        const entryPfid = v?.portfolioId;

        const isOpeningBalance = !entryDate || entryDate === '' || entryDate === 'undefined';
        const isBeforeStart = isOpeningBalance || entryDate < startDate;

        if (isBeforeStart) {
          if (accountId) {
            const belongsToAccount =
              entryAcid === accountId || (entryPfid && portfolioIds?.includes(entryPfid));
            if (!belongsToAccount) return;
          }
          opDr += e.debit || 0;
          opCr += e.credit || 0;
        }
      }
    });

    const rawOpBalance = opDr - opCr;
    const openingBalance = groupType === "ASSET" || groupType === "EXPENSE" ? rawOpBalance : -rawOpBalance;

    // 2. Fetch and Sort Transactions in period
    const rawTxns: any[] = [];
    entries.forEach((e: any) => {
      if (String(e.ledgerId) === String(l.id)) {
        const v = voucherMap[e.voucherId];
        const entryDate = e.date || v?.date;
        const entryAcid = e.accountId || v?.accountId;
        const entryPfid = v?.portfolioId;

        if (entryDate && entryDate >= startDate && entryDate <= endDate) {
          if (accountId) {
            const belongsToAccount =
              entryAcid === accountId || (entryPfid && portfolioIds?.includes(entryPfid));
            if (!belongsToAccount) return;
          }
          
          // Find against ledger(s)
          let against = "";
          if (v) {
            const siblings = entries.filter((line: any) => line.voucherId === v.id && line.ledgerId !== l.id);
            if (siblings.length === 1) {
              const siblingLedger = ledgers.find((item) => item.id === siblings[0].ledgerId);
              against = siblingLedger?.name || siblings[0].ledgerId;
            } else if (siblings.length > 1) {
              against = "As Per Details";
            }
          }

          rawTxns.push({
            date: entryDate,
            voucherType: v?.type || "journal",
            voucherId: e.voucherId,
            againstLedger: against || "Opening Balance",
            narration: e.narration || v?.narration || "",
            debit: e.debit || 0,
            credit: e.credit || 0,
          });
        }
      }
    });

    // Sort chronologically
    rawTxns.sort((a, b) => a.date.localeCompare(b.date));

    // 3. Compute running balance
    let currentRunning = rawOpBalance;
    const transactions = rawTxns.map((t) => {
      currentRunning += t.debit - t.credit;
      const bal = groupType === "ASSET" || groupType === "EXPENSE" ? currentRunning : -currentRunning;
      return {
        ...t,
        balance: bal,
      };
    });

    const closingBalance = groupType === "ASSET" || groupType === "EXPENSE" ? currentRunning : -currentRunning;

    result.push({
      id: l.id,
      name: l.name,
      groupName: group?.name || "Other",
      openingBalance,
      transactions,
      closingBalance,
    });
  }

  return result;
}

export async function getBatchVouchers(
  voucherTypes: string[],
  startDate: string,
  endDate: string,
  accountId?: string
): Promise<VoucherPrintData[]> {
  const vouchers = getStoredVouchers();
  const ledgers = getStoredLedgers();
  const entries = getStoredEntries();
  const allPortfolios = getStoredPortfolios();

  const portfolioIds = accountId
    ? allPortfolios.filter((p: any) => p.accountId === accountId).map((p: any) => p.id)
    : null;

  const filtered = vouchers.filter((v: any) => {
    if (v.date < startDate || v.date > endDate) return false;
    
    if (accountId) {
      const belongs = v.accountId === accountId || (v.portfolioId && portfolioIds?.includes(v.portfolioId));
      if (!belongs) return false;
    }
    
    if (voucherTypes.length > 0 && !voucherTypes.includes(v.type)) return false;
    return true;
  });

  // Sort chronologically
  filtered.sort((a: any, b: any) => a.date.localeCompare(b.date));

  return filtered.map((v: any) => {
    const voucherEntries = entries.filter((e: any) => e.voucherId === v.id);
    const lines = voucherEntries.map((e: any) => ({
      ledgerId: e.ledgerId,
      ledgerName: ledgers.find((item) => item.id === e.ledgerId)?.name || e.ledgerId,
      debit: e.debit || 0,
      credit: e.credit || 0,
      quantity: e.quantity,
      price: e.price,
      narration: e.date, // optional
    }));

    const totalAmount = lines.reduce((s: number, r: any) => s + (r.debit || 0), 0);

    return {
      id: v.id,
      date: v.date,
      voucherNo: v.voucherNo || "JV-DEFAULT",
      type: v.type,
      narration: v.narration || "",
      lines,
      totalAmount,
    };
  });
}
