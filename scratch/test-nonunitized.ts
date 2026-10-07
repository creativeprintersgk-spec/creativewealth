import fs from 'fs';
const acmac1 = JSON.parse(fs.readFileSync('backups/latest_snapshot/acmac1.json', 'utf8'));
const nonUnitizedGroups = [200095, 200070, 200115, 200120, 200135, 200150, 200155, 200145, 200066, 200160, 200195];
const active = acmac1.filter((a: any) => nonUnitizedGroups.includes(Number(a.parent_id)));
console.log('Total non-unitized investment ledgers in acmac1:', active.length);
active.forEach((a: any) => {
  const net = (Number(a.db_bal) || 0) - (Number(a.cr_bal) || 0);
  if (Math.abs(net) > 1) {
    console.log(`id=${a.id} acid=${a.acid} parent=${a.parent_id} net=${net} name="${a.name}"`);
  }
});
