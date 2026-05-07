import type { Ledger, Voucher, Group, Entry } from "../../logic";

export function getLedgerBalance(ledger: Ledger, vouchers: Voucher[], allEntries: Entry[]) {
  let balance = ledger.openingType === 'DR' ? ledger.openingBalance : -ledger.openingBalance;

  const entries = allEntries.filter(e => e.ledgerId === ledger.id || e.ledgerId === ledger.name);
  entries.forEach(e => {
    balance += e.debit || 0;
    balance -= e.credit || 0;
  });

  return balance;
}

/**
 * Recursive group total calculation
 */
export function getGroupTotal(groupId: string, groups: Group[], ledgers: Ledger[], vouchers: Voucher[], allEntries: Entry[]): number {
  let total = 0;

  // 1. Add direct ledger balances
  ledgers.forEach(l => {
    if (l.groupId === groupId) {
      total += getLedgerBalance(l, vouchers, allEntries);
    }
  });

  // 2. Add child groups (Recursion)
  groups
    .filter(g => g.parent === groupId)
    .forEach(child => {
      total += getGroupTotal(child.id, groups, ledgers, vouchers, allEntries);
    });

  return total;
}

/**
 * Profit & Loss Calculation
 * Income is normally CR (-) in our signed logic.
 */
export function getProfit(groups: Group[], ledgers: Ledger[], vouchers: Voucher[], allEntries: Entry[]) {
  const income = getGroupTotal('income', groups, ledgers, vouchers, allEntries);
  const expenses = getGroupTotal('expenses', groups, ledgers, vouchers, allEntries);

  // Profit = (-Income) - (Expense)
  return (-income) - (expenses);
}

/**
 * Final Balance Sheet Engine
 */
export function generateBS(groups: Group[], ledgers: Ledger[], vouchers: Voucher[], allEntries: Entry[]) {
  const assets =
    getGroupTotal('fixed_assets', groups, ledgers, vouchers, allEntries) +
    getGroupTotal('investments', groups, ledgers, vouchers, allEntries) +
    getGroupTotal('current_assets', groups, ledgers, vouchers, allEntries) +
    getGroupTotal('misc_assets', groups, ledgers, vouchers, allEntries);

  const liabilities =
    getGroupTotal('capital_account', groups, ledgers, vouchers, allEntries) +
    getGroupTotal('loans_liability', groups, ledgers, vouchers, allEntries) +
    getGroupTotal('sundry_creditors', groups, ledgers, vouchers, allEntries) +
    getGroupTotal('duties_taxes', groups, ledgers, vouchers, allEntries) +
    getGroupTotal('provisions', groups, ledgers, vouchers, allEntries);

  const profit = getProfit(groups, ledgers, vouchers, allEntries);

  return {
    assets,
    liabilities: (-liabilities) + profit, // Standard BS presentation (negate liabilities because they are normally CR)
    profit
  };
}
