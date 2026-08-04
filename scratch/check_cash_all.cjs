const db = require('better-sqlite3')('C:/Users/Admin/Desktop/mprTempBackupMPrAPPv10.db');
console.log(db.prepare("SELECT ID, ACID, DB_BAL, CR_BAL FROM ACMAC1 WHERE NAME='Cash on Hand' AND IS_GROUP=0").all());
