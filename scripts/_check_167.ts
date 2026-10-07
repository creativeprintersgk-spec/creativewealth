import fs from 'fs';
import path from 'path';

const snapshotDir = path.resolve(process.cwd(), 'backups/latest_snapshot');
const acmac1 = JSON.parse(fs.readFileSync(path.join(snapshotDir, 'acmac1.json'), 'utf8'));

const l167 = acmac1.filter((a: any) => a.id === 167 || a.name?.includes('IDFC FD'));
console.log(l167);
