const Database = require('better-sqlite3');
const db = new Database('C:/Users/Admin/Desktop/mprTempBackupMPrAPPv10.db', { readonly: true });

const tables = {
  'Portfolios': 'portfolios',
  'InvestorGroupMembers': 'investor_group_members',
  'ACC_PFLINK': 'acc_pflink',
  'ACMAC1': 'acmac1',
  'BS1': 'bs1',
  'SumTable': 'sum_table',
  'VouchersC1': 'vouchersc1',
  'Vouchers1': 'vouchers1',
  'TransC1': 'transc1',
  'Trans1': 'trans1',
  'MPrices': 'mprices'
};

for (const [sqliteTab, supabaseTab] of Object.entries(tables)) {
  try {
    const row = db.prepare(`SELECT COUNT(*) as count FROM ${sqliteTab}`).get();
    console.log(`SQLite ${sqliteTab}: ${row.count} rows`);
  } catch (e) {
    console.log(`SQLite ${sqliteTab}: error`, e.message);
  }
}
db.close();
