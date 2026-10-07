const Database = require("better-sqlite3");
const db = new Database("C:/Users/Admin/Desktop/mprTempBackupMPrAPPv10.db", { readonly: true });
const allTables = db.prepare("SELECT name FROM sqlite_master WHERE type='table'").all().map(r => r.name);
console.log("allTables in SQLite:", allTables);

const TABLE_CONFIGS = [
  { key: 'portfolios', filePattern: /^(?:portfolios?|portfolio|pfolio)\.csv$/i },
  { key: 'investor_group_members', filePattern: /^(?:investor_?group_?members?|investorgroupmembers)\.csv$/i },
  { key: 'acc_pflink', filePattern: /^(?:acc_?pfln?k|acc_pflink)\.csv$/i },
  { key: 'acmac1', filePattern: /^(?:acmac1|acma1|acma)\.csv$/i },
  { key: 'sam', filePattern: /^sam\.csv$/i },
  { key: 'bs1', filePattern: /^bs1\.csv$/i },
  { key: 'sum_table', filePattern: /^sum_?table\.csv$/i },
  { key: 'vouchersc1', filePattern: /^(?:vouchers?_?c[0-9]*|vouchers?c)\.csv$/i },
  { key: 'vouchers1', filePattern: /^(?:vouchers?1|vouchers?_?1)\.csv$/i },
  { key: 'transc1', filePattern: /^(?:trans?a?c?_?c[0-9]*|trans?c)\.csv$/i },
  { key: 'trans1', filePattern: /^(?:trans?1|trans?a?c?_?1)\.csv$/i },
  { key: 'mprices', filePattern: /^m_?prices?\.csv$/i },
  { key: 'scnote1', filePattern: /^sc_?notes?1?\.csv$/i },
];

for (const config of TABLE_CONFIGS) {
  const match = allTables.find(t => config.filePattern.test(t + '.csv'));
  const rowCount = match ? db.prepare(`SELECT count(*) as c FROM "${match}"`).get().c : 0;
  console.log(`Config ${config.key.padEnd(22)} matched SQLite table "${match}" (${rowCount} rows)`);
}
