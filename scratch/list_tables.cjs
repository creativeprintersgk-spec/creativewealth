const Database = require('better-sqlite3');
const db = new Database('C:/Users/Admin/Desktop/mprTempBackupMPrAPPv10.db', { readonly: true });
const tables = db.prepare("SELECT name FROM sqlite_master WHERE type='table'").all();
console.log(tables.map(t => t.name).join('\n'));
