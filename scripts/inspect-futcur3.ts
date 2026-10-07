import fs from 'fs';
import path from 'path';

const snapshotDir = path.resolve(process.cwd(), 'backups/latest_snapshot');
const portfolios = JSON.parse(fs.readFileSync(path.join(snapshotDir, 'portfolios.json'), 'utf8'));
const acmac1 = JSON.parse(fs.readFileSync(path.join(snapshotDir, 'acmac1.json'), 'utf8'));
const bs1 = JSON.parse(fs.readFileSync(path.join(snapshotDir, 'bs1.json'), 'utf8'));
const sumTable = JSON.parse(fs.readFileSync(path.join(snapshotDir, 'sum_table.json'), 'utf8'));

console.log('Portfolio 11:', portfolios.find((p: any) => p.id === 11));
console.log('Portfolio 42:', portfolios.find((p: any) => p.id === 42));
console.log('All portfolios with Krisha:');
portfolios.filter((p: any) => (p.name || p.investor_name || '').toLowerCase().includes('krisha')).forEach((p: any) => console.log(p));

// Let's search all sumTable entries for pfolio_id 42 or 11
console.log('sumTable for 42:');
sumTable.filter((s: any) => s.pfolio_id === 42 && s.qnt > 0).forEach((s: any) => console.log(s));

// What about PMSWorkspace holdings logic? Let's check PMSWorkspace.tsx!
