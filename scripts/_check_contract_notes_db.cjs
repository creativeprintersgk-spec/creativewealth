const Database = require("better-sqlite3");
const db = new Database("C:/Users/Admin/Desktop/contract notes/mprTempBackupMPrAPPv10.db", { readonly: true });
const tables = db.prepare("SELECT name FROM sqlite_master WHERE type='table'").all();
console.log("Tables in contract notes db:", tables.map(t => t.name).filter(n => n.includes("Trans") || n.includes("Vouch") || n.includes("ACMA")));
