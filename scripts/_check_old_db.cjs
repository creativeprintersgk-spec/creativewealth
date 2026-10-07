const Database = require("better-sqlite3");
try {
  const db = new Database("scripts/_old_mprofit.db", { readonly: true });
  const tables = db.prepare("SELECT name FROM sqlite_master WHERE type='table'").all();
  console.log("Tables in old db:", tables.map(t => t.name));
} catch(e) {
  console.log("Could not open old db:", e.message);
}
