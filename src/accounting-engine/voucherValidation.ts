export type VoucherType = "payment" | "receipt" | "journal" | "contra";

export interface VoucherLineInput {
  ledgerId: string;
  debit: number;
  credit: number;
}

export function validateDebitCredit(lines: VoucherLineInput[]): { isBalanced: boolean; difference: number; totalDebit: number; totalCredit: number } {
  const totalDebit = lines.reduce((sum, r) => sum + (r.debit || 0), 0);
  const totalCredit = lines.reduce((sum, r) => sum + (r.credit || 0), 0);
  const difference = Math.abs(totalDebit - totalCredit);
  const isBalanced = difference < 0.01 && totalDebit > 0;
  
  return { isBalanced, difference, totalDebit, totalCredit };
}

export function validateEmptyRows(lines: VoucherLineInput[]): VoucherLineInput[] {
  return lines.filter(r => r.ledgerId && (r.debit > 0 || r.credit > 0));
}

export function validateVoucherType(type: VoucherType, lines: VoucherLineInput[], mappedLedgers: {id: string, type: string}[]): { isValid: boolean; error?: string } {
  const validLines = validateEmptyRows(lines);
  if (validLines.length < 2) {
    return { isValid: false, error: "Voucher must have at least two entries" };
  }

  // Type specific rules
  if (type === 'contra') {
    const isContraValid = validateContra(validLines, mappedLedgers);
    if (!isContraValid) {
      return { isValid: false, error: "Contra vouchers can only involve Cash and Bank accounts" };
    }
  }

  if (type === 'payment') {
    // Payment: Credit must be Cash/Bank
    const creditLines = validLines.filter(l => l.credit > 0);
    const hasCashBankCredit = creditLines.some(cl => {
      const ledger = mappedLedgers.find(m => m.id === cl.ledgerId);
      return ledger && (ledger.type === 'bank' || ledger.type === 'cash');
    });
    if (!hasCashBankCredit) {
      return { isValid: false, error: "Payment voucher must credit a Cash or Bank account" };
    }
  }

  if (type === 'receipt') {
    // Receipt: Debit must be Cash/Bank
    const debitLines = validLines.filter(l => l.debit > 0);
    const hasCashBankDebit = debitLines.some(dl => {
      const ledger = mappedLedgers.find(m => m.id === dl.ledgerId);
      return ledger && (ledger.type === 'bank' || ledger.type === 'cash');
    });
    if (!hasCashBankDebit) {
      return { isValid: false, error: "Receipt voucher must debit a Cash or Bank account" };
    }
  }

  return { isValid: true };
}

export function validateContra(lines: VoucherLineInput[], mappedLedgers: {id: string, type: string}[]): boolean {
  return lines.every(line => {
    const ledger = mappedLedgers.find(m => m.id === line.ledgerId);
    return ledger && (ledger.type === 'bank' || ledger.type === 'cash');
  });
}

export function validateVoucher(
  type: VoucherType, 
  lines: VoucherLineInput[], 
  mappedLedgers: {id: string, type: string}[]
): { isValid: boolean; error?: string; finalLines: VoucherLineInput[] } {
  
  const finalLines = validateEmptyRows(lines);
  
  const balanceCheck = validateDebitCredit(finalLines);
  if (!balanceCheck.isBalanced) {
    return { isValid: false, error: "Voucher is not balanced", finalLines };
  }

  const typeCheck = validateVoucherType(type, finalLines, mappedLedgers);
  if (!typeCheck.isValid) {
    return { isValid: false, error: typeCheck.error, finalLines };
  }

  return { isValid: true, finalLines };
}
