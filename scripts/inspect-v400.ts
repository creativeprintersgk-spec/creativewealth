import { readFileSync } from 'fs';
import path from 'path';

const snapshotDir = path.resolve('c:/Users/Admin/Desktop/wealthcore-clean/backups/latest_snapshot');
function loadJson(name: string) {
  return JSON.parse(readFileSync(path.join(snapshotDir, `${name}.json`), 'utf-8'));
}

const vouchersc1 = loadJson('vouchersc1');
const transc1 = loadJson('transc1');
const bs1 = loadJson('bs1');
const portfolios = loadJson('portfolios');
const accPflink = loadJson('acc_pflink');

// Let's inspect Voucher 400 and its transactions in transc1 and bs1
const v400 = vouchersc1.find((v: any) => v.vid === 400);
console.log('Voucher 400:', v400);

const trans400 = transc1.filter((t: any) => t.vid === 400);
console.log('Trans for vid 400:', trans400);

const bs400 = bs1.filter((b: any) => b.acvch === 400 || b.trid === 400);
console.log('bs1 for 400:', bs400);

// Let's check which account owns pfid of this trade
if (bs400.length > 0) {
  const pfid = bs400[0].pfid;
  const link = accPflink.find((l: any) => l.pfid === pfid);
  console.log(`bs1 pfid = ${pfid}, linked acid = ${link?.acid}`);
}
