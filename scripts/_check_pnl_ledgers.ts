import fs from 'fs';
import path from 'path';

const snapshotDir = path.resolve(process.cwd(), 'backups/latest_snapshot');
const transC1 = JSON.parse(fs.readFileSync(path.join(snapshotDir, 'transc1.json'), 'utf8'));
const trans1 = JSON.parse(fs.readFileSync(path.join(snapshotDir, 'trans1.json'), 'utf8'));
const acmac1 = JSON.parse(fs.readFileSync(path.join(snapshotDir, 'acmac1.json'), 'utf8'));

// Check acid for ledgers 401, 405, 407, 415, 480
console.log("=== CHECKING ACMA1 for 401, 405, 415 ===");
const pnlAcmac = acmac1.filter((a: any) => [401, 405, 407, 415, 460, 465, 470, 480].includes(a.id));
pnlAcmac.forEach((a: any) => console.log(`  ID=${a.id}, NAME="${a.name}", ACID=${a.acid}, PARENT=${a.parent_id}`));

console.log("\n=== CHECKING TRANSACTIONS for 401, 405, 415 by ACID ===");
const allTrans = [...transC1, ...trans1].filter((t: any) => [401, 405, 415].includes(t.maid));
const transAcidCounts: Record<string, number> = {};
allTrans.forEach((t: any) => {
  const k = `MAID ${t.maid} - ACID ${t.acid}`;
  transAcidCounts[k] = (transAcidCounts[k] || 0) + 1;
});
console.log(transAcidCounts);
