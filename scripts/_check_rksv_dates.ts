import fs from 'fs';
import path from 'path';

const snapshotDir = path.resolve(process.cwd(), 'backups/latest_snapshot');
const transC1 = JSON.parse(fs.readFileSync(path.join(snapshotDir, 'transc1.json'), 'utf8'));
const trans1 = JSON.parse(fs.readFileSync(path.join(snapshotDir, 'trans1.json'), 'utf8'));

const t1 = trans1.filter((r: any) => r.maid === 100002 && r.acid === 29);
const tc = transC1.filter((r: any) => r.maid === 100002 && r.acid === 29);

console.log("RKSV trans1 dates for acid 29:");
const t1_dates = t1.map((r: any) => r.dt).sort();
console.log("  Min:", t1_dates[0], "Max:", t1_dates[t1_dates.length - 1], "Count:", t1.length);

console.log("RKSV transc1 dates for acid 29:");
const tc_dates = tc.map((r: any) => r.dt).sort();
console.log("  Min:", tc_dates[0], "Max:", tc_dates[tc_dates.length - 1], "Count:", tc.length);

// Let's see running balance of RKSV over time
const all = [
  ...t1.map((r: any) => ({ ...r, _src: 't1' })),
  ...tc.map((r: any) => ({ ...r, _src: 'tc' }))
].sort((a: any, b: any) => (a.dt || '').localeCompare(b.dt || ''));

let running = 0;
for (const r of all) {
  running += (Number(r.dramt) || 0) - (Number(r.cramt) || 0);
}
console.log("Final net across ALL time:", running.toFixed(2));

// By FY / year end:
const cutoffs = ['2019-03-31', '2020-03-31', '2021-03-31', '2022-03-31', '2023-03-31', '2024-03-31', '2025-03-31', '2026-03-31', '2026-08-31'];
for (const dt of cutoffs) {
  let bal = 0;
  for (const r of all) {
    if (!r.dt || r.dt <= dt || r.dt.startsWith('0001')) {
      bal += (Number(r.dramt) || 0) - (Number(r.cramt) || 0);
    }
  }
  console.log(`Balance at ${dt}: ${bal.toFixed(2)}`);
}
