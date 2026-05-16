// ============================================================
// WealthCore — logic_defaults.ts
// Updated with full MProfit-compatible chart of accounts
// Based on MProfit ACMA database analysis
// ============================================================

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
  amid?: number // Link to Asset Master
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

// ─── Transaction Types (from MProfit) ────────────────────────────────────────
// Used for PMS transaction classification
export type TransactionType =
  | 'buy'           // Regular purchase
  | 'sell'          // Regular sale
  | 'buy_offmarket' // Off-market / opening balance purchase
  | 'sell_offmarket'// Off-market sale
  | 'switch_in'     // MF switch in
  | 'switch_out'    // MF switch out
  | 'bonus'         // Bonus shares
  | 'split'         // Stock split
  | 'merger'        // Merger
  | 'demerger'      // Demerger
  | 'rights'        // Rights issue / IPO
  | 'dividend_reinvest' // Dividend reinvestment
  | 'dividend_payout'   // Dividend paid out
  | 'interest_payout'   // Interest paid out
  | 'interest_cumulative' // Cumulative interest
  | 'other_income'  // Other income
  | 'transferred_in'  // Transferred in from another account
  | 'transferred_out' // Transferred out
  | 'buyback'       // Share buyback
  | 'tds'           // TDS deducted
  | 'write_off'     // Write off

// ─── Capital Gains Indexation (CII) ──────────────────────────────────────────
// Source: MProfit CapGainIndexation.csv
// New series (2001 onwards) — used for current LTCG calculations
export const CII_NEW: Record<number, number> = {
  2001: 100, 2002: 105, 2003: 109, 2004: 113, 2005: 117,
  2006: 122, 2007: 129, 2008: 137, 2009: 148, 2010: 167,
  2011: 184, 2012: 200, 2013: 220, 2014: 240, 2015: 254,
  2016: 264, 2017: 272, 2018: 280, 2019: 289, 2020: 301,
  2021: 317, 2022: 331, 2023: 348, 2024: 363,
}

// Old series (1981 onwards) — for grandfathered assets
export const CII_OLD: Record<number, number> = {
  1981: 100, 1982: 109, 1983: 116, 1984: 125, 1985: 133,
  1986: 140, 1987: 150, 1988: 161, 1989: 172, 1990: 182,
  1991: 199, 1992: 223, 1993: 244, 1994: 259, 1995: 281,
  1996: 305, 1997: 331, 1998: 351, 1999: 389, 2000: 406,
  2001: 426, 2002: 447, 2003: 463, 2004: 480, 2005: 497,
  2006: 519, 2007: 551, 2008: 582, 2009: 632, 2010: 711,
  2011: 785, 2012: 852, 2013: 939, 2014: 1024, 2015: 1081,
  2016: 1125, 2017: 1150,
}

// ─── MProfit Asset Type Codes ─────────────────────────────────────────────────
export const MPROFIT_ASSET_TYPES: Record<number, string> = {
  30: 'Stock F&O',
  40: 'Traded Bonds',
  50: 'Stocks',
  58: 'Special Inv. Funds',
  60: 'Mutual Funds',
  66: 'Private Equity',
  70: 'NCD/Debentures',
  75: 'Gold',
  77: 'Silver',
  81: 'Other F&O',
  95: 'FDs',
  115: 'Deposits/Loans',
  120: 'PPF/EPF',
  135: 'Post Office',
  140: 'Insurance',
  141: 'NPS/ULIP',
  145: 'Art',
  150: 'Properties',
  155: 'Jewellery',
  160: 'AIF',
}

// ─── Default Groups (Chart of Accounts) ──────────────────────────────────────
// Full MProfit-compatible chart of accounts
export const defaultGroups: Group[] = [

  // ── Liabilities ─────────────────────────────────────────
  { id: 'capital_account',    name: 'Capital Account',              type: 'LIABILITY' },
  { id: 'loans_liability',    name: 'Loans (Liability)',            type: 'LIABILITY' },
  { id: 'current_liabilities',name: 'Current Liabilities',         type: 'LIABILITY' },
  { id: 'sundry_creditors',   name: 'Sundry Creditors',            type: 'LIABILITY', parent: 'current_liabilities' },
  { id: 'provisions',         name: 'Provisions',                  type: 'LIABILITY' },
  { id: 'duties_taxes',       name: 'Duties & Taxes',              type: 'LIABILITY' },

  // ── Assets ──────────────────────────────────────────────
  { id: 'fixed_assets',       name: 'Fixed Asset',                 type: 'ASSET' },
  { id: 'gold',               name: 'Gold',                        type: 'ASSET',    parent: 'fixed_assets' },
  { id: 'silver',             name: 'Silver',                      type: 'ASSET',    parent: 'fixed_assets' },
  { id: 'art',                name: 'Art',                         type: 'ASSET',    parent: 'fixed_assets' },
  { id: 'property',           name: 'Properties',                  type: 'ASSET',    parent: 'fixed_assets' },
  { id: 'jewellery',          name: 'Jewellery',                   type: 'ASSET',    parent: 'fixed_assets' },

  { id: 'investments',        name: 'Investments',                 type: 'ASSET' },
  { id: 'mf_equity',          name: 'Mutual Funds (Equity)',       type: 'ASSET',    parent: 'investments' },
  { id: 'mf_debt',            name: 'Mutual Funds (Debt)',         type: 'ASSET',    parent: 'investments' },
  { id: 'stocks',             name: 'Stocks',                      type: 'ASSET',    parent: 'investments' },
  { id: 'traded_bonds',       name: 'Traded Bonds',                type: 'ASSET',    parent: 'investments' },
  { id: 'ncd_debentures',     name: 'NCD/Debentures',              type: 'ASSET',    parent: 'investments' },
  { id: 'fds',                name: 'FDs',                         type: 'ASSET',    parent: 'investments' },
  { id: 'aif',                name: 'AIF',                         type: 'ASSET',    parent: 'investments' },
  { id: 'pms_aif',            name: 'PMS / AIF',                   type: 'ASSET',    parent: 'investments' },
  { id: 'private_equity',     name: 'Private Equity',              type: 'ASSET',    parent: 'investments' },
  { id: 'special_inv_funds',  name: 'Special Inv. Funds',          type: 'ASSET',    parent: 'investments' },
  { id: 'stock_in_trade',     name: 'Stock-in-Trade',              type: 'ASSET',    parent: 'investments' },
  { id: 'ppf_epf',            name: 'PPF/EPF',                     type: 'ASSET',    parent: 'investments' },
  { id: 'nps_ulip',           name: 'NPS/ULIP',                    type: 'ASSET',    parent: 'investments' },
  { id: 'post_office',        name: 'Post Office',                 type: 'ASSET',    parent: 'investments' },
  { id: 'insurance_asset',    name: 'Insurance',                   type: 'ASSET',    parent: 'investments' },
  { id: 'invit_reit',         name: 'InvIT / REIT',                type: 'ASSET',    parent: 'investments' },
  { id: 'sgb',                name: 'Sovereign Gold Bonds',        type: 'ASSET',    parent: 'investments' },

  { id: 'current_assets',     name: 'Current Assets',              type: 'ASSET' },
  { id: 'cash',               name: 'Cash-in-Hand',                type: 'ASSET',    parent: 'current_assets' },
  { id: 'bank',               name: 'Banks',                       type: 'ASSET',    parent: 'current_assets' },
  { id: 'debtors',            name: 'Sundry Debtors',              type: 'ASSET',    parent: 'current_assets' },
  { id: 'loans_asset',        name: 'Loans and Advances (Asset)',  type: 'ASSET',    parent: 'current_assets' },
  { id: 'deposits_loans',     name: 'Deposits / Loans',            type: 'ASSET',    parent: 'current_assets' },
  { id: 'tds_receivable',     name: 'TDS Receivable',              type: 'ASSET',    parent: 'current_assets' },
  { id: 'interest_receivable',name: 'Interest Receivable',         type: 'ASSET',    parent: 'current_assets' },
  { id: 'dividend_receivable',name: 'Dividend Receivable',         type: 'ASSET',    parent: 'current_assets' },
  { id: 'asset_switch',       name: 'Asset Switch / Renewal',      type: 'ASSET',    parent: 'current_assets' },
  { id: 'suspense',           name: 'Suspense Account',            type: 'ASSET',    parent: 'current_assets' },

  { id: 'misc_assets',        name: 'Misc Assets',                 type: 'ASSET' },

  // ── Income ───────────────────────────────────────────────
  { id: 'profit_loss',        name: 'Profit & Loss',               type: 'INCOME' },
  { id: 'income',             name: 'Income',                      type: 'INCOME',   parent: 'profit_loss' },

  // Capital Gains
  { id: 'capital_gains',      name: 'Capital Gains',               type: 'INCOME',   parent: 'income' },
  { id: 'intraday_gain',      name: 'Intraday / Trading Gain',     type: 'INCOME',   parent: 'capital_gains' },
  { id: 'stcg_equity',        name: 'STCG Listed Equity (20%)',    type: 'INCOME',   parent: 'capital_gains' },
  { id: 'ltcg_equity',        name: 'LTCG Listed Equity (12.5%)', type: 'INCOME',   parent: 'capital_gains' },
  { id: 'stcg_debt',          name: 'STCG Debt / Other',           type: 'INCOME',   parent: 'capital_gains' },
  { id: 'ltcg_debt',          name: 'LTCG Debt / Other',           type: 'INCOME',   parent: 'capital_gains' },
  { id: 'stcg_bonds',         name: 'STCG Bonds',                  type: 'INCOME',   parent: 'capital_gains' },
  { id: 'ltcg_bonds',         name: 'LTCG Bonds',                  type: 'INCOME',   parent: 'capital_gains' },
  { id: 'stcg_invit_reit',    name: 'STCG InvIT / REIT',           type: 'INCOME',   parent: 'capital_gains' },
  { id: 'ltcg_invit_reit',    name: 'LTCG InvIT / REIT',           type: 'INCOME',   parent: 'capital_gains' },
  { id: 'fao_gain',           name: 'F&O Trading Gain / Loss',     type: 'INCOME',   parent: 'capital_gains' },

  // Other Income
  { id: 'interest_investment', name: 'Interest on Investment',     type: 'INCOME',   parent: 'income' },
  { id: 'interest_saving',    name: 'Interest on Saving Account',  type: 'INCOME',   parent: 'income' },
  { id: 'interest_taxfree',   name: 'Interest Tax Free',           type: 'INCOME',   parent: 'income' },
  { id: 'dividend',           name: 'Dividend',                    type: 'INCOME',   parent: 'income' },
  { id: 'rent_income',        name: 'Rent Income',                 type: 'INCOME',   parent: 'income' },
  { id: 'salary',             name: 'Salary',                      type: 'INCOME',   parent: 'income' },
  { id: 'other_income',       name: 'Other Income',                type: 'INCOME',   parent: 'income' },
  { id: 'misc_gain_loss',     name: 'Misc. Gain / Loss',           type: 'INCOME',   parent: 'income' },

  // ── Expenses ─────────────────────────────────────────────
  { id: 'expenses',           name: 'Expenses',                    type: 'EXPENSE',  parent: 'profit_loss' },

  // STT sub-group
  { id: 'stt',                name: 'STT',                         type: 'EXPENSE',  parent: 'expenses' },
  { id: 'stt_equity',         name: 'STT - Equity',                type: 'EXPENSE',  parent: 'stt' },
  { id: 'stt_mf',             name: 'STT - MFs',                   type: 'EXPENSE',  parent: 'stt' },
  { id: 'stt_fao',            name: 'STT - F&O',                   type: 'EXPENSE',  parent: 'stt' },

  // Transaction charges sub-group
  { id: 'share_txn_charges',  name: 'Share Transaction Charges',   type: 'EXPENSE',  parent: 'expenses' },
  { id: 'txn_charges_equity', name: 'Transaction Charges - Equity',type: 'EXPENSE',  parent: 'share_txn_charges' },
  { id: 'txn_charges_fao',    name: 'Transaction Charges - F&O',   type: 'EXPENSE',  parent: 'share_txn_charges' },

  // Tax & charges
  { id: 'tax_charges_stocks', name: 'Tax & Charges - Stocks',      type: 'EXPENSE',  parent: 'expenses' },
  { id: 'gst_equity',         name: 'GST - Equity',                type: 'EXPENSE',  parent: 'tax_charges_stocks' },
  { id: 'stamp_charges',      name: 'Stamp Charges - Equity',      type: 'EXPENSE',  parent: 'tax_charges_stocks' },
  { id: 'other_charges',      name: 'Other Charges - Equity',      type: 'EXPENSE',  parent: 'tax_charges_stocks' },

  // General expenses
  { id: 'household_expense',  name: 'Household Expense',           type: 'EXPENSE',  parent: 'expenses' },
  { id: 'income_tax',         name: 'Income Tax',                  type: 'EXPENSE',  parent: 'expenses' },
  { id: 'insurance_premium',  name: 'Insurance Premium',           type: 'EXPENSE',  parent: 'expenses' },
  { id: 'bank_charges',       name: 'Bank Charges',                type: 'EXPENSE',  parent: 'expenses' },
  { id: 'interest_on_loan',   name: 'Interest on Loan',            type: 'EXPENSE',  parent: 'expenses' },
  { id: 'credit_card_exp',    name: 'Credit Card Expense',         type: 'EXPENSE',  parent: 'expenses' },
  { id: 'rent_expense',       name: 'Rent Expense',                type: 'EXPENSE',  parent: 'expenses' },
  { id: 'admin_charges',      name: 'Admin & Other Charges',       type: 'EXPENSE',  parent: 'expenses' },
  { id: 'legal_fees',         name: 'Legal & Professional Fees',   type: 'EXPENSE',  parent: 'expenses' },
  { id: 'donation',           name: 'Donation and Charity',        type: 'EXPENSE',  parent: 'expenses' },
  { id: 'children_education', name: 'Children Education Expense',  type: 'EXPENSE',  parent: 'expenses' },
  { id: 'society_maintenance',name: 'Society Maintenance Charges', type: 'EXPENSE',  parent: 'expenses' },
  { id: 'loan_charges',       name: 'Loan Charges',                type: 'EXPENSE',  parent: 'expenses' },
  { id: 'telephone_expense',  name: 'Telephone Expense',           type: 'EXPENSE',  parent: 'expenses' },
  { id: 'electricity_expense',name: 'Electricity Expense',         type: 'EXPENSE',  parent: 'expenses' },
  { id: 'courier_postage',    name: 'Courier & Postage',           type: 'EXPENSE',  parent: 'expenses' },
]
