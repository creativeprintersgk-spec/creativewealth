const Database = require("better-sqlite3");
const db = new Database("scripts/_old_mprofit_clean.db", { readonly: true });

console.log("TransC1 count:", db.prepare("SELECT count(*) as c FROM TransC1").get().c);
console.log("VouchersC1 count:", db.prepare("SELECT count(*) as c FROM VouchersC1").get().c);
console.log("ACMAC1 count:", db.prepare("SELECT count(*) as c FROM ACMAC1").get().c);

// Check sample
console.log("TransC1 sample:", db.prepare("SELECT * FROM TransC1 LIMIT 3").all());
