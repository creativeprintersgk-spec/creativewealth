import fs from 'fs';
import path from 'path';

const snapshotDir = path.resolve(process.cwd(), 'backups/latest_snapshot');
const acmac1 = JSON.parse(fs.readFileSync(path.join(snapshotDir, 'acmac1.json'), 'utf8'));
const accPflink = JSON.parse(fs.readFileSync(path.join(snapshotDir, 'acc_pflink.json'), 'utf8'));

// Find links for portfolio 40
const links = accPflink.filter((l: any) => l.pfid === 40);
console.log('accPflink for pfid 40:', links);

// For each linked acid, search acmac1 for 404629 or PPF
links.forEach((l: any) => {
  const ledgers = acmac1.filter((a: any) => a.acid === l.acid);
  console.log(`Ledgers for acid ${l.acid} (${ledgers.length}):`);
  ledgers.forEach((a: any) => {
    if (a.db_bal > 0 || a.cr_bal > 0 || (a.name || '').toLowerCase().includes('ppf')) {
      console.log(`  id=${a.id} exint1=${a.exint1} name="${a.name}" db=${a.db_bal} cr=${a.cr_bal} parent=${a.parent_id}`);
    }
  });
});
