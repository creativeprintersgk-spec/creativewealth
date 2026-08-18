import Database from 'better-sqlite3';
const db = new Database('mprTempBackupMPrAPPv10.db');
const rows = db.prepare(`SELECT name FROM sqlite_master WHERE type='table'`).all();
console.log('Tables in SQLite:', rows.map(r => r.name));
