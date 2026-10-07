import fs from 'fs';
import path from 'path';

const snapshotDir = path.resolve(process.cwd(), 'backups/latest_snapshot');
const transC1 = JSON.parse(fs.readFileSync(path.join(snapshotDir, 'transc1.json'), 'utf8'));
const trans1 = JSON.parse(fs.readFileSync(path.join(snapshotDir, 'trans1.json'), 'utf8'));
const acmac1 = JSON.parse(fs.readFileSync(path.join(snapshotDir, 'acmac1.json'), 'utf8'));
const accPflink = JSON.parse(fs.readFileSync(path.join(snapshotDir, 'acc_pflink.json'), 'utf8'));

const acid = '29';
const endDate = '2026-03-31';
const portfolioIds = accPflink.filter((l: any) => String(l.acid) === acid).map((l: any) => l.pfid);

// Sum total debits and credits for acid 29 up to endDate
const allEntries = [
  ...transC1.map((e: any) => ({ ...e, _src: 'c' })),
  ...trans1.map((e: any) => ({ ...e, _src: 't' }))
];

let totalDr = 0, totalCr = 0;
const ledgerTotals: Record<string, { dr: number, cr: number }> = {};

allEntries.forEach((e: any) => {
  const entryDate = e.dt;
  const isOpening = !entryDate || String(entryDate).startsWith('0001');
  if (!isOpening && entryDate > endDate) return;

  const belongs = (String(e.acid) === acid) || (e.pfid && portfolioIds.includes(e.pfid));
  if (!belongs) return;

  const dr = Number(e.dramt) || 0;
  const cr = Number(e.cramt) || 0;
  totalDr += dr;
  totalCr += cr;

  const lid = String(e.maid);
  ledgerTotals[lid] = ledgerTotals[lid] || { dr: 0, cr: 0 };
  ledgerTotals[lid].dr += dr;
  ledgerTotals[lid].cr += cr;
});

console.log(`ALL ENTRIES FOR ACID 29:`);
console.log(`Total DR: ?${totalDr.toFixed(2)}`);
console.log(`Total CR: ?${totalCr.toFixed(2)}`);
console.log(`DR - CR : ?${(totalDr - totalCr).toFixed(2)}`);

// Check vouchers that are unbalanced
const vouchers1 = JSON.parse(fs.readFileSync(path.join(snapshotDir, 'vouchers1.json'), 'utf8'));
const vouchersC1 = JSON.parse(fs.readFileSync(path.join(snapshotDir, 'vouchersc1.json'), 'utf8'));
const allVouchers = [...vouchersC1, ...vouchers1];

const vSum: Record<string, { dr: number, cr: number, date: string, narr: string }> = {};
allEntries.forEach((e: any) => {
  const entryDate = e.dt;
  const isOpening = !entryDate || String(entryDate).startsWith('0001');
  if (!isOpening && entryDate > endDate) return;
  if (String(e.acid) !== acid) return;

  const key = `${e._src}_${e.vid}`;
  vSum[key] = vSum[key] || { dr: 0, cr: 0, date: e.dt, narr: e.narr };
  vSum[key].dr += Number(e.dramt) || 0;
  vSum[key].cr += Number(e.cramt) || 0;
});

let unbalCount = 0;
let unbalDrDiff = 0;
for (const [k, v] of Object.entries(vSum)) {
  const diff = Math.abs(v.dr - v.cr);
  if (diff > 0.05) {
    unbalCount++;
    unbalDrDiff += (v.dr - v.cr);
    if (unbalCount <= 10) {
      console.log(`Unbalanced voucher ${k} (${v.date}): DR=${v.dr.toFixed(2)}, CR=${v.cr.toFixed(2)}, DIFF=${(v.dr - v.cr).toFixed(2)} [${v.narr}]`);
    }
  }
}
console.log(`Total unbalanced vouchers: ${unbalCount}, net diff: ?${unbalDrDiff.toFixed(2)}`);
