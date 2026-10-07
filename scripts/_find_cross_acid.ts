import fs from 'fs';
import path from 'path';

const snapshotDir = path.resolve(process.cwd(), 'backups/latest_snapshot');
const portfolios = JSON.parse(fs.readFileSync(path.join(snapshotDir, 'portfolios.json'), 'utf8'));
const accPflink = JSON.parse(fs.readFileSync(path.join(snapshotDir, 'acc_pflink.json'), 'utf8'));
const vouchers1 = JSON.parse(fs.readFileSync(path.join(snapshotDir, 'vouchers1.json'), 'utf8'));
const trans1 = JSON.parse(fs.readFileSync(path.join(snapshotDir, 'trans1.json'), 'utf8'));

const vMap: Record<number, any> = {};
vouchers1.forEach((v: any) => vMap[v.vid] = v);

const portfolioIds = accPflink.filter((l: any) => l.acid === 29).map((l: any) => l.pfid);
console.log("Portfolios for acid 29:", portfolioIds);

// Find trans1 entries for 100002 where acid != 29 but pfid in portfolioIds
trans1.filter((t: any) => t.maid === 100002).forEach((t: any) => {
  const v = vMap[t.vid];
  const vPfid = v?.pfid;
  if (t.acid !== 29 && portfolioIds.includes(vPfid)) {
    console.log(`Cross-acid entry: transid=${t.transid}, vid=${t.vid}, acid=${t.acid}, vPfid=${vPfid}, dr=${t.dramt}, cr=${t.cramt}`);
  }
});
