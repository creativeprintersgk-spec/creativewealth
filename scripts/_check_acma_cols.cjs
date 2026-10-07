const Database = require("better-sqlite3");
const db = new Database("C:/Users/Admin/Desktop/mprTempBackupMPrAPPv10.db", { readonly: true });
const cols = db.prepare("PRAGMA table_info(ACMA1)").all();
console.log("ACMA1 columns:", cols.map(c => c.name));

const hdfc = db.prepare("SELECT * FROM ACMA1 WHERE Name LIKE '%HDFC Bank%'").all();
console.log("HDFC Bank:", hdfc);
