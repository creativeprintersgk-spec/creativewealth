const Database = require("better-sqlite3");
const db = new Database("C:/Users/Admin/Desktop/mprTempBackupMPrAPPv10.db", { readonly: true });

const acmaRows = db.prepare("SELECT ID, ACID, Name, ParentID, DbBal, CrBal FROM ACMA1 WHERE Name LIKE '%HDFC Bank%'").all();
console.log("HDFC Bank rows in SQLite ACMA1:", acmaRows);

const portfolios = db.prepare("SELECT ID, InvestorName, PFolioType FROM Portfolios").all();
console.log("Portfolios:", portfolios.filter(p => [29, 30, 31, 32, 36, 61, 62].includes(p.ID)));

const rksvRows = db.prepare("SELECT ID, ACID, Name, ParentID FROM ACMA1 WHERE Name LIKE '%RKSV%' OR Name LIKE '%Zerodha%' OR Name LIKE '%Direct%'").all();
console.log("Brokers in ACMA1:", rksvRows);
