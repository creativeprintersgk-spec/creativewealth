import fs from 'fs';
import path from 'path';

const snapshotDir = path.resolve(process.cwd(), 'backups/latest_snapshot');
const transC1 = JSON.parse(fs.readFileSync(path.join(snapshotDir, 'transc1.json'), 'utf8'));
const trans1 = JSON.parse(fs.readFileSync(path.join(snapshotDir, 'trans1.json'), 'utf8'));

const all = [...transC1, ...trans1].filter((r: any) => r.maid === 100001 && r.acid === 29);
all.sort((a,b) => (a.dt||'').localeCompare(b.dt||''));

console.log(`Total R K Global entries for acid 29: ${all.length}`);
console.log(`First date: ${all[0]?.dt}, Last date: ${all[all.length-1]?.dt}`);

const after2026 = all.filter(r => r.dt > '2026-03-31');
console.log(`Entries after 2026-03-31: ${after2026.length}`);
let afterDr = 0, afterCr = 0;
after2026.forEach(r => {
  afterDr += Number(r.dramt) || 0;
  afterCr += Number(r.cramt) || 0;
});
console.log(`After 2026-03-31: DR=${afterDr.toFixed(2)}, CR=${afterCr.toFixed(2)}, NET=${(afterDr-afterCr).toFixed(2)}`);

// Net up to 2026-03-31:
const upTo2026 = all.filter(r => !r.dt || r.dt <= '2026-03-31' || r.dt.startsWith('0001'));
let upDr = 0, upCr = 0;
upTo2026.forEach(r => {
  upDr += Number(r.dramt) || 0;
  upCr += Number(r.cramt) || 0;
});
console.log(`Up to 2026-03-31: DR=${upDr.toFixed(2)}, CR=${upCr.toFixed(2)}, NET=${(upDr-upCr).toFixed(2)}`);
