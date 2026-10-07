const fs = require("fs");
const tc1 = JSON.parse(fs.readFileSync("backups/latest_snapshot/transc1.json", "utf8"));
const t1 = JSON.parse(fs.readFileSync("backups/latest_snapshot/trans1.json", "utf8"));
const vc1 = JSON.parse(fs.readFileSync("backups/latest_snapshot/vouchersc1.json", "utf8"));
const v1 = JSON.parse(fs.readFileSync("backups/latest_snapshot/vouchers1.json", "utf8"));

console.log("transc1 count:", tc1.length);
console.log("trans1 count:", t1.length);
console.log("vouchersc1 count:", vc1.length);
console.log("vouchers1 count:", v1.length);

// Compare vtyps in transc1 vs trans1
const tc1_vtyps = new Set(tc1.map(r => r.vtyp));
const t1_vtyps = new Set(t1.map(r => r.vtyp));
console.log("transc1 vtyps:", [...tc1_vtyps]);
console.log("trans1 vtyps:", [...t1_vtyps]);

// Check date ranges
const tc1_dates = tc1.map(r => r.dt).filter(Boolean).sort();
const t1_dates = t1.map(r => r.dt).filter(Boolean).sort();
console.log(`transc1 dates: ${tc1_dates[0]} to ${tc1_dates[tc1_dates.length - 1]}`);
console.log(`trans1 dates: ${t1_dates[0]} to ${t1_dates[t1_dates.length - 1]}`);

// Check why transc1 has 22351 rows while Trans1 in SQLite has 19244 rows
// In SQLite, let's check BS1 count:
const Database = require("better-sqlite3");
const db = new Database("C:/Users/Admin/Desktop/mprTempBackupMPrAPPv10.db", { readonly: true });
const bs1Count = db.prepare("SELECT count(*) as c FROM BS1").get();
console.log("BS1 count in SQLite:", bs1Count.c);
