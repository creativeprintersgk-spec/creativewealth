const Database = require('better-sqlite3');
const db = new Database('C:/Users/Admin/Desktop/mprTempBackupMPrAPPv10.db', { readonly: true });
const tables = db.prepare("SELECT name FROM sqlite_master WHERE type='table'").all();
for (const t of tables) {
  try {
    const cols = db.prepare(`PRAGMA table_info("${t.name}")`).all().map(c => c.name);
    for (const c of cols) {
       const res = db.prepare(`SELECT * FROM "${t.name}" WHERE "${c}" = ? LIMIT 1`).get('440788');
       if (res) console.log(`Found in table ${t.name}, column ${c}:`, res);
    }
  } catch (e) {}
}
