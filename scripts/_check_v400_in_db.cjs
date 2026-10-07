const Database = require("better-sqlite3");
const db = new Database("C:/Users/Admin/Desktop/mprTempBackupMPrAPPv10.db", { readonly: true });
const v400 = db.prepare("SELECT * FROM TransC1 WHERE VID=400").all();
console.log("TransC1 VID=400 in Desktop DB:", v400);
