const Database = require("better-sqlite3");
const db = new Database("C:/Users/Admin/Desktop/mprTempBackupMPrAPPv10.db", { readonly: true });

const tables = db.prepare("SELECT name FROM sqlite_master WHERE type='table'").all();
console.log("All tables in SQLite:", tables.map(t => t.name).join(", "));

for (const t of tables) {
  const name = t.name;
  if (name.toLowerCase().includes('trans') || name.toLowerCase().includes('vouch') || name.toLowerCase().includes('acma')) {
    const count = db.prepare(`SELECT count(*) as c FROM ${name}`).get();
    console.log(`  Table ${name}: ${count.c} rows`);
  }
}
