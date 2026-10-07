import fs from 'fs';
const acmac1 = JSON.parse(fs.readFileSync('backups/latest_snapshot/acmac1.json', 'utf8'));
const ppfLedgers = acmac1.filter((a: any) => a.parent_id === 200120 || (a.name || '').toLowerCase().includes('ppf'));
console.log('PPF ledgers in acmac1:');
ppfLedgers.forEach((a: any) => {
  const net = (Number(a.db_bal) || 0) - (Number(a.cr_bal) || 0);
  console.log(`id=${a.id} acid=${a.acid} name="${a.name}" parent=${a.parent_id} db=${a.db_bal} cr=${a.cr_bal} net=${net}`);
});
