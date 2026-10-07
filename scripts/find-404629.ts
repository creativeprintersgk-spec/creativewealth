import fs from 'fs';
import path from 'path';

const snapshotDir = path.resolve(process.cwd(), 'backups/latest_snapshot');
const sumTable = JSON.parse(fs.readFileSync(path.join(snapshotDir, 'sum_table.json'), 'utf8'));
const bs1 = JSON.parse(fs.readFileSync(path.join(snapshotDir, 'bs1.json'), 'utf8'));
const portfolios = JSON.parse(fs.readFileSync(path.join(snapshotDir, 'portfolios.json'), 'utf8'));
const sam = fs.existsSync(path.join(snapshotDir, 'sam.json')) ? JSON.parse(fs.readFileSync(path.join(snapshotDir, 'sam.json'), 'utf8')) : [];

console.log('--- All sumTable entries matching 404629 ---');
sumTable.forEach((s: any) => {
  const str = JSON.stringify(s);
  if (str.includes('404629') || Math.abs(s.amtinv - 404629.31) < 1 || Math.abs(s.currv - 404629.31) < 1 || Math.abs(s.balpurc - 404629.31) < 1) {
    const pf = portfolios.find((p: any) => p.id === s.pfolio_id);
    const asset = sam.find((a: any) => a.amid === s.amid);
    console.log(`FOUND in sumTable: pf=${pf?.investor_name} (${s.pfolio_id}) amid=${s.amid} (${asset?.anm}) atty=${s.atty} qnt=${s.qnt} amtinv=${s.amtinv} currv=${s.currv}`);
    console.log(s);
  }
});

console.log('--- All bs1 entries matching 404629 ---');
bs1.forEach((b: any) => {
  const str = JSON.stringify(b);
  if (str.includes('404629') || Math.abs(b.amt - 404629.31) < 1) {
    const pf = portfolios.find((p: any) => p.id === b.pfid);
    const asset = sam.find((a: any) => a.amid === b.amid);
    console.log(`FOUND in bs1: pf=${pf?.investor_name} (${b.pfid}) amid=${b.amid} (${asset?.anm}) trty=${b.trty} qn=${b.qn} amt=${b.amt} dt=${b.dt}`);
    console.log(b);
  }
});
