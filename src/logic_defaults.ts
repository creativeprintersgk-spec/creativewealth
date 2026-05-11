export type Group = {
  id: string
  name: string
  parent?: string
  type: 'ASSET' | 'LIABILITY' | 'INCOME' | 'EXPENSE'
  affectsGrossProfit?: boolean
}

export type Ledger = {
  id: string
  name: string
  groupId: string
  openingBalance: number
  openingType: 'DR' | 'CR'
  currentBalance: number
  currentType: 'DR' | 'CR'
}

export type Voucher = {
  id: string;
  date: string;
  type: 'payment' | 'receipt' | 'journal' | 'contra';
  narration?: string;
  voucherNo?: string;
  fy?: string;
  portfolioId?: string;
  accountId?: string;
}


export type Entry = {
  id: string;
  voucherId: string;
  ledgerId: string;
  debit: number;
  credit: number;
  quantity?: number;
  price?: number;
}

export type VoucherLine = {
  id: string;
  ledgerId: string | null;
  ledgerName: string;
  debit: number;
  credit: number;
  quantity?: number;
  price?: number;
  narration?: string;
}


export const defaultGroups: Group[] = [
  { id: 'capital_account', name: 'Capital Account', type: 'LIABILITY' },
  { id: 'profit_loss', name: 'Profit & Loss', type: 'LIABILITY' },
  { id: 'income', name: 'Income', parent: 'profit_loss', type: 'INCOME' },
  { id: 'capital_gains', name: 'Capital Gains', parent: 'income', type: 'INCOME' },
  { id: 'interest_saving', name: 'Interest on Saving Account', parent: 'income', type: 'INCOME' },
  { id: 'expenses', name: 'Expenses', parent: 'profit_loss', type: 'EXPENSE' },
  { id: 'stt', name: 'STT', parent: 'expenses', type: 'EXPENSE' },
  { id: 'share_txn_charges', name: 'Share Transaction Charges', parent: 'expenses', type: 'EXPENSE' },
  { id: 'tax_charges_stocks', name: 'Tax & Charges - Stocks', parent: 'expenses', type: 'EXPENSE' },
  { id: 'household_expense', name: 'Household Expense', parent: 'expenses', type: 'EXPENSE' },
  { id: 'income_tax', name: 'Income Tax', parent: 'expenses', type: 'EXPENSE' },
  { id: 'insurance_premium', name: 'Insurance Premium', parent: 'expenses', type: 'EXPENSE' },
  { id: 'loans_liability', name: 'Loans (Liability)', type: 'LIABILITY' },
  { id: 'current_liabilities', name: 'Current Liabilities', type: 'LIABILITY' },
  { id: 'sundry_creditors', name: 'Sundry Creditors', type: 'LIABILITY' },
  { id: 'provisions', name: 'Provisions', type: 'LIABILITY' },
  { id: 'duties_taxes', name: 'Duties & Taxes', type: 'LIABILITY' },
  { id: 'fixed_assets', name: 'Fixed Asset', type: 'ASSET' },
  { id: 'gold', name: 'Gold', parent: 'fixed_assets', type: 'ASSET' },
  { id: 'silver', name: 'Silver', parent: 'fixed_assets', type: 'ASSET' },
  { id: 'art', name: 'Art', parent: 'fixed_assets', type: 'ASSET' },
  { id: 'property', name: 'Properties', parent: 'fixed_assets', type: 'ASSET' },
  { id: 'jewellery', name: 'Jewellery', parent: 'fixed_assets', type: 'ASSET' },
  { id: 'investments', name: 'Investments', type: 'ASSET' },
  { id: 'mf_equity', name: 'Mutual Funds(Equity)', parent: 'investments', type: 'ASSET' },
  { id: 'mf_debt', name: 'Mutual Funds(Debt)', parent: 'investments', type: 'ASSET' },
  { id: 'stocks', name: 'Stocks', parent: 'investments', type: 'ASSET' },
  { id: 'traded_bonds', name: 'Traded Bonds', parent: 'investments', type: 'ASSET' },
  { id: 'ncd_debentures', name: 'NCD/Debentures', parent: 'investments', type: 'ASSET' },
  { id: 'fds', name: 'FDs', parent: 'investments', type: 'ASSET' },
  { id: 'aif', name: 'AIF', parent: 'investments', type: 'ASSET' },
  { id: 'pms_aif', name: 'PMS / AIF', parent: 'investments', type: 'ASSET' },
  { id: 'private_equity', name: 'Private Equity', parent: 'investments', type: 'ASSET' },
  { id: 'special_inv_funds', name: 'Special Inv. Funds', parent: 'investments', type: 'ASSET' },
  { id: 'stock_in_trade', name: 'Stock-in-Trade', parent: 'investments', type: 'ASSET' },
  { id: 'ppf_epf', name: 'PPF/EPF', parent: 'investments', type: 'ASSET' },
  { id: 'nps_uup', name: 'NPS/UUP', parent: 'investments', type: 'ASSET' },
  { id: 'post_office', name: 'Post Office', parent: 'investments', type: 'ASSET' },
  { id: 'insurance_asset', name: 'Insurance', parent: 'investments', type: 'ASSET' },
  { id: 'current_assets', name: 'Current Assets', type: 'ASSET' },
  { id: 'cash', name: 'Cash-in-Hand', parent: 'current_assets', type: 'ASSET' },
  { id: 'bank', name: 'Banks', parent: 'current_assets', type: 'ASSET' },
  { id: 'debtors', name: 'Sundry Debtors', parent: 'current_assets', type: 'ASSET' },
  { id: 'loans_asset', name: 'Loans and Advances (Asset)', parent: 'current_assets', type: 'ASSET' },
  { id: 'deposits_loans', name: 'Deposits / Loans', parent: 'current_assets', type: 'ASSET' },
  { id: 'misc_assets', name: 'Misc Assets', type: 'ASSET' },
];
