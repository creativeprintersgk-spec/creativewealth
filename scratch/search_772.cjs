const Database = require('better-sqlite3');
const db = new Database('C:/Users/Admin/Desktop/mprTempBackupMPrAPPv10.db');
console.log(db.prepare("SELECT * FROM SAM WHERE ANM LIKE '%7.72%'").all());
console.log(db.prepare("SELECT * FROM ACMAC1 WHERE NAME LIKE '%7.72%'").all());
