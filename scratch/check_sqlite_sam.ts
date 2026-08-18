import Database from 'better-sqlite3';
const db = new Database('mprTempBackupMPrAPPv10.db');
const rows = db.prepare(`SELECT * FROM sam WHERE name LIKE '%L&T%'`).all();
console.log('SAM in SQLite:', rows);
const prices = db.prepare(`SELECT * FROM mprices WHERE amid IN (SELECT amid FROM sam WHERE name LIKE '%L&T%')`).all();
console.log('Prices in SQLite:', prices);
