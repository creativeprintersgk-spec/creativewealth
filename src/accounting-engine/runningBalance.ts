export function getLedgerRunningBalance(
  openingType: 'DR' | 'CR',
  openingBalance: number,
  entries: { debit: number; credit: number; date: string; isBeforeFY: boolean }[]
) {
  let runningBalance = openingType === 'DR' ? openingBalance : -openingBalance;
  let fyOpeningBalance = runningBalance;
  
  const calculatedEntries = entries.map(e => {
    if (e.isBeforeFY) {
      runningBalance += e.debit;
      runningBalance -= e.credit;
      fyOpeningBalance = runningBalance;
      return null;
    } else {
      runningBalance += e.debit;
      runningBalance -= e.credit;
      return { ...e, balance: runningBalance };
    }
  }).filter(e => e !== null);

  return { transactions: calculatedEntries, openingBalance: fyOpeningBalance, closingBalance: runningBalance };
}
