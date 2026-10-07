const Database = require('better-sqlite3');
const db = new Database('scripts/_old_mprofit_clean.db');

const bs1 = db.prepare('SELECT * FROM bs1').all();
const acmac1 = db.prepare('SELECT * FROM acmac1').all();
const portfolios = db.prepare('SELECT * FROM portfolios').all();
console.log('bs1 count:', bs1.length);

// Check how many transactions exist in bs1
const sellCount = bs1.filter(t => [99, 15, 21, 26, 31].includes(t.TRTY) || t.TRTY > 50).length;
console.log('Sell transactions in bs1:', sellCount);
