import fs from 'fs';
import path from 'path';

const snapshotDir = path.resolve(process.cwd(), 'backups/latest_snapshot');
const acmac1 = JSON.parse(fs.readFileSync(path.join(snapshotDir, 'acmac1.json'), 'utf8'));

const match = acmac1.filter((a: any) => a.id === 671 || a.id === 500671 || a.exint1 === 671 || a.amid === 671);
console.log('Matches in acmac1 for 671:', match);

const matchName = acmac1.filter((a: any) => (a.name || '').includes('GBP') || (a.name || '').includes('FUTCUR'));
console.log('Matches in acmac1 for GBP / FUTCUR:', matchName);
