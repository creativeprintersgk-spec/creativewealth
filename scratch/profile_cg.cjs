const Database = require('better-sqlite3');
const db = new Database('scripts/_old_mprofit_clean.db');
const tables = db.prepare("SELECT name FROM sqlite_master WHERE type='table'").all().map(t => t.name);
console.log('Tables:', tables);
