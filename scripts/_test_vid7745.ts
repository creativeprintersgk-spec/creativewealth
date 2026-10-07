import fs from 'fs';
const snapshot = JSON.parse(fs.readFileSync('backups/latest_snapshot/db_snapshot.json', 'utf8'));

const vid = 7745;
const trans1 = snapshot.trans1.filter(t => t.vid === vid);
const transC1 = snapshot.transC1.filter(t => t.vid === vid);

console.log('--- trans1 (vid=7745) ---');
trans1.forEach(t => console.log(t));
console.log('--- transC1 (vid=7745) ---');
transC1.forEach(t => console.log(t));
