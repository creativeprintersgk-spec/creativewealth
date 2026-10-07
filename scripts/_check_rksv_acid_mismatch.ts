import fs from 'fs';
import path from 'path';

const snapshotDir = path.resolve(process.cwd(), 'backups/latest_snapshot');
const transC1 = JSON.parse(fs.readFileSync(path.join(snapshotDir, 'transc1.json'), 'utf8'));
const trans1 = JSON.parse(fs.readFileSync(path.join(snapshotDir, 'trans1.json'), 'utf8'));

const t1_rksv = trans1.filter((r: any) => r.maid === 100002);
const tc_rksv = transC1.filter((r: any) => r.maid === 100002);

console.log("=== TRANS1 RKSV BY ACID ===");
const t1_by_acid: Record<number, { dr: number, cr: number }> = {};
t1_rksv.forEach((r: any) => {
  t1_by_acid[r.acid] = t1_by_acid[r.acid] || { dr: 0, cr: 0 };
  t1_by_acid[r.acid].dr += Number(r.dramt) || 0;
  t1_by_acid[r.acid].cr += Number(r.cramt) || 0;
});
console.log(t1_by_acid);

console.log("=== TRANSC1 RKSV BY ACID ===");
const tc_by_acid: Record<number, { dr: number, cr: number }> = {};
tc_rksv.forEach((r: any) => {
  tc_by_acid[r.acid] = tc_by_acid[r.acid] || { dr: 0, cr: 0 };
  tc_by_acid[r.acid].dr += Number(r.dramt) || 0;
  tc_by_acid[r.acid].cr += Number(r.cramt) || 0;
});
console.log(tc_by_acid);
