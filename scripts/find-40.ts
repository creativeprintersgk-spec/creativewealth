import fs from 'fs';
import path from 'path';

const snapshotDir = path.resolve(process.cwd(), 'backups/latest_snapshot');
const sumTable = JSON.parse(fs.readFileSync(path.join(snapshotDir, 'sum_table.json'), 'utf8'));
const acmac1 = JSON.parse(fs.readFileSync(path.join(snapshotDir, 'acmac1.json'), 'utf8'));
const sam = fs.existsSync(path.join(snapshotDir, 'sam.json')) ? JSON.parse(fs.readFileSync(path.join(snapshotDir, 'sam.json'), 'utf8')) : [];

console.log('--- Checking all sumTable with pfolio_id = 40 ---');
const rows40 = sumTable.filter((s: any) => s.pfolio_id === 40);
console.log(`Found ${rows40.length} rows for portfolio 40.`);

rows40.forEach((s: any) => {
  const anm = sam.find((a: any) => a.amid === s.amid)?.anm || acmac1.find((a: any) => a.id === s.amid || a.exint1 === s.amid)?.name;
  if (s.qnt > 0 || s.amtinv > 0 || s.currv > 0) {
    console.log(`amid=${s.amid} atty=${s.atty} qnt=${s.qnt} amtinv=${s.amtinv} currv=${s.currv} name="${anm}"`);
  }
});
