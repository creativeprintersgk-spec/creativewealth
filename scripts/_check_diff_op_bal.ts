import fs from 'fs';
import path from 'path';

const snapshotDir = path.resolve(process.cwd(), 'backups/latest_snapshot');
const acmac1 = JSON.parse(fs.readFileSync(path.join(snapshotDir, 'acmac1.json'), 'utf8'));

const diffs = acmac1.filter((a: any) => a.name && a.name.toLowerCase().includes('opening'));
console.log("Difference in Opening Balances rows:");
diffs.forEach((a: any) => {
  console.log(`  ID=${a.id}, NAME="${a.name}", ACID=${a.acid}, DB=${a.db_bal}, CR=${a.cr_bal}, PARENT=${a.parent_id}`);
});
