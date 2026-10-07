const Database = require("better-sqlite3");
const db = new Database("C:/Users/Admin/Desktop/mprTempBackupMPrAPPv10.db", { readonly: true });

console.log("=== VOUCHER 400 IN SQLITE ===");
const v400 = db.prepare("SELECT * FROM Vouchers1 WHERE VID=400").all();
console.log("Vouchers1 VID=400:", v400);

const t400 = db.prepare("SELECT * FROM Trans1 WHERE VID=400").all();
console.log("Trans1 VID=400:", t400);

// Check VouchersC1 or TransC1 if any
try {
  const vc400 = db.prepare("SELECT * FROM VouchersC2 WHERE VID=400").all();
  console.log("VouchersC2 VID=400:", vc400);
} catch(e) {}

// Check SCNOTE1 with CNID=400 or SCNOTE=400
const sc400 = db.prepare("SELECT * FROM SCNOTE1 WHERE CNID=400 OR SCNUMBER LIKE '%400%'").all();
console.log("SCNOTE1:", sc400);
