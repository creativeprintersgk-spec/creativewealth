import fs from 'fs';
const acmac1 = JSON.parse(fs.readFileSync('backups/latest_snapshot/acmac1.json', 'utf8'));
const krishaLedgers = acmac1.filter((a: any) => a.acid === 36 && a.parent_id >= 200000);
console.log('Krisha (acid 36) investment ledgers:');
krishaLedgers.forEach((a: any) => {
  const net = (Number(a.db_bal) || 0) - (Number(a.cr_bal) || 0);
  console.log(`id=${a.id} name="${a.name}" parent=${a.parent_id} net=${net}`);
});
