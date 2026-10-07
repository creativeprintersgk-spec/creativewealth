import fs from 'fs';
const acmac1 = JSON.parse(fs.readFileSync('backups/latest_snapshot/acmac1.json', 'utf8'));
acmac1.forEach((a: any) => {
  const net = Math.abs((Number(a.db_bal) || 0) - (Number(a.cr_bal) || 0));
  if (Math.abs(net - 404629.31) < 10) {
    console.log('Net match in acmac1:', a);
  }
});
