import fs from 'fs';
import path from 'path';

const snapshotDir = path.resolve(process.cwd(), 'backups/latest_snapshot');
const transC1 = JSON.parse(fs.readFileSync(path.join(snapshotDir, 'transc1.json'), 'utf8'));
const trans1 = JSON.parse(fs.readFileSync(path.join(snapshotDir, 'trans1.json'), 'utf8'));
const acmac1 = JSON.parse(fs.readFileSync(path.join(snapshotDir, 'acmac1.json'), 'utf8'));

const allTrans = [...transC1, ...trans1];

const ids = [164, 167, 168, 169, 500307, 503141, 503175, 503184];

for (const id of ids) {
  const acma = acmac1.find((a: any) => a.id === id && a.acid === 29);
  console.log(`\n=== LEDGER ${id}: ${acma?.name} (db_bal=${acma?.db_bal}, cr_bal=${acma?.cr_bal}) ===`);
  const rows = allTrans.filter((t: any) => t.maid === id && t.acid === 29);
  console.log(`Transactions count: ${rows.length}`);
  rows.forEach((r: any) => {
    console.log(`  DT=${r.dt}, VID=${r.vid}, DR=${r.dramt}, CR=${r.cramt}, NARR=${r.narr}`);
  });
}
