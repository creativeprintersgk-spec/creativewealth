import { getLedgerRunningBalance } from "./runningBalance";
import { getFYRange } from "./fyEngine";

export function getLedgerWithBalanceCore(
  ledgerId: string, 
  ledger: any, 
  allEntries: any[], 
  allVouchers: any[], 
  allLedgers: any[],
  startDate?: string, 
  endDate?: string
) {
  const range = (startDate && endDate) ? { start: startDate, end: endDate } : null;

  const ledgerEntries = allEntries.filter(e => e.ledgerId === ledgerId);
  const entriesWithDate = ledgerEntries.map(e => {
    const v = allVouchers.find(v => v.id === e.voucherId);
    return { ...e, date: v?.date || '1900-01-01', v };
  }).sort((a, b) => {
    if (a.date !== b.date) return a.date.localeCompare(b.date);
    return a.voucherId.localeCompare(b.voucherId);
  });

  const inputs = entriesWithDate.map(e => {
    const isBeforeFY = range ? e.date < range.start : false;
    const isWithinFY = range ? (e.date >= range.start && e.date <= range.end) : true;
    
    return {
      debit: e.debit,
      credit: e.credit,
      date: e.date,
      isBeforeFY,
      isWithinFY,
      voucherId: e.voucherId,
      v: e.v,
      id: e.id
    };
  }).filter(e => e.isBeforeFY || e.isWithinFY); // Drop future entries for now

  const balResult = getLedgerRunningBalance(ledger.openingType, ledger.openingBalance, inputs);

  const transactions = balResult.transactions.map((e: any) => {
    return {
      date: e.date,
      voucherId: e.voucherId,
      voucherType: e.v?.type || 'journal',
      narration: e.v?.narration || '',
      debit: e.debit,
      credit: e.credit,
      balance: e.balance,
      againstLedger: (() => {
        const voucherEntries = allEntries.filter(ve => ve.voucherId === e.voucherId);
        const oppositeEntries = voucherEntries.filter(ve => 
          e.debit > 0 ? ve.credit > 0 : ve.debit > 0
        );
        
        if (oppositeEntries.length === 1) {
          const oppositeLedger = allLedgers.find(l => l.id === oppositeEntries[0].ledgerId);
          return oppositeLedger?.name || oppositeEntries[0].ledgerId;
        } else if (oppositeEntries.length > 1) {
          return "Multiple";
        } else {
          const others = voucherEntries.filter(ve => ve.id !== e.id);
          if (others.length === 1) {
            const otherLedger = allLedgers.find(l => l.id === others[0].ledgerId);
            return otherLedger?.name || others[0].ledgerId;
          }
          return "Various";
        }
      })()
    };
  });

  return {
    transactions,
    openingBalance: balResult.openingBalance,
    closingBalance: balResult.closingBalance
  };
}
