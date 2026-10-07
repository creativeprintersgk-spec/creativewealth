import fs from 'fs';
import Database from 'better-sqlite3';

const dbs = [
  'C:\\ProgramData\\MProfit\\MPrPricesDb.db',
  'C:\\ProgramData\\MProfit\\MPrStocksDb.db',
  'C:\\ProgramData\\MProfit\\MPrOthInvDb.db',
  'C:\\ProgramData\\MProfit\\MPrMfsDb.db',
  'C:\\ProgramData\\MProfit\\MPrCommonDb.db',
  'C:\\ProgramData\\MProfit\\MPrPortfolioDb.db'
];

for (const p of dbs) {
  if (fs.existsSync(p)) {
    try {
      const db = new Database(p, { readonly: true });
      const tables = db.prepare("SELECT name FROM sqlite_master WHERE type='table'").all();
      for (const t of tables) {
        try {
          const cols = db.prepare(`PRAGMA table_info("${t.name}")`).all().map(c => c.name);
          const hasIsin = cols.includes('isin') || cols.includes('isincode');
          const hasName = cols.includes('name') || cols.includes('anm');
          let query = '';
          if (hasIsin) {
            query = `SELECT * FROM "${t.name}" WHERE isin LIKE '%INE549K%' OR isin LIKE '%549K%'`;
          }
          if (query) {
            const rows = db.prepare(query).all();
            if (rows.length > 0) {
              console.log(`FOUND in ${p} -> ${t.name}:`, JSON.stringify(rows.slice(0, 5), null, 2));
            }
          }
        } catch(e) {}
      }
      db.close();
    } catch(e) {
      console.log('Error opening', p, e.message);
    }
  }
}
