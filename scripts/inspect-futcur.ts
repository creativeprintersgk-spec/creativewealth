import fs from 'fs';
import path from 'path';

const snapshotDir = path.resolve(process.cwd(), 'backups/latest_snapshot');
const bs1 = JSON.parse(fs.readFileSync(path.join(snapshotDir, 'bs1.json'), 'utf8'));
const sumTable = JSON.parse(fs.readFileSync(path.join(snapshotDir, 'sum_table.json'), 'utf8'));
const acmac1 = JSON.parse(fs.readFileSync(path.join(snapshotDir, 'acmac1.json'), 'utf8'));
const sam = fs.existsSync(path.join(snapshotDir, 'sam.json')) ? JSON.parse(fs.readFileSync(path.join(snapshotDir, 'sam.json'), 'utf8')) : [];
const assetMaster = JSON.parse(fs.readFileSync(path.join(snapshotDir, 'asset_master.json'), 'utf8'));

console.log('--- Searching for FUTCURGBPINR28MAR2023 ---');
const samHits = sam.filter((s: any) => (s.anm || '').includes('FUTCURGBPINR28MAR2023'));
console.log('sam hits:', samHits);

const amHits = assetMaster.filter((a: any) => (a.name || '').includes('FUTCURGBPINR28MAR2023'));
console.log('assetMaster hits:', amHits);

const acHits = acmac1.filter((a: any) => (a.name || '').includes('FUTCURGBPINR28MAR2023'));
console.log('acmac1 hits:', acHits);

const amid = samHits[0]?.amid || amHits[0]?.amid || acHits[0]?.id || acHits[0]?.exint1;
console.log('resolved amid:', amid);

const stHits = sumTable.filter((s: any) => Number(s.amid) === Number(amid));
console.log('sumTable hits for amid:', stHits);

const bsHits = bs1.filter((b: any) => Number(b.amid) === Number(amid));
console.log(`bs1 transactions for amid (${bsHits.length}):`, bsHits);
