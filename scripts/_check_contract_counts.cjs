const Database = require("better-sqlite3");
const db = new Database("C:/Users/Admin/Desktop/contract notes/mprTempBackupMPrAPPv10.db", { readonly: true });
console.log("Trans1 count:", db.prepare("SELECT count(*) as c FROM Trans1").get().c);
console.log("TransC1 count:", db.prepare("SELECT count(*) as c FROM TransC1").get().c);
console.log("Vouchers1 count:", db.prepare("SELECT count(*) as c FROM Vouchers1").get().c);
console.log("VouchersC1 count:", db.prepare("SELECT count(*) as c FROM VouchersC1").get().c);
console.log("ACMAC1 count:", db.prepare("SELECT count(*) as c FROM ACMAC1").get().c);
