import { readFileSync } from 'fs';
import path from 'path';

const snapshotDir = path.resolve('c:/Users/Admin/Desktop/wealthcore-clean/backups/latest_snapshot');
function loadJson(name: string) {
  return JSON.parse(readFileSync(path.join(snapshotDir, `${name}.json`), 'utf-8'));
}

const vouchersc1 = loadJson('vouchersc1');
const vouchers1 = loadJson('vouchers1');
const transc1 = loadJson('transc1');
const trans1 = loadJson('trans1');
const acmac1 = loadJson('acmac1');

const allTrans = [...transc1.map((t: any) => ({ ...t, _src: 'c' })), ...trans1.map((t: any) => ({ ...t, _src: 't' }))];
const allVouchers = [...vouchersc1.map((v: any) => ({ ...v, _src: 'c' })), ...vouchers1.map((v: any) => ({ ...v, _src: 't' }))];

// Group transactions by vid and src
const transByVoucher: Record<string, any[]> = {};
allTrans.forEach(t => {
  const key = `${t._src}_${t.vid}`;
  if (!transByVoucher[key]) transByVoucher[key] = [];
  transByVoucher[key].push(t);
});

console.log('--- Checking for Unbalanced Vouchers ---');
let foundUnbalanced = 0;
Object.entries(transByVoucher).forEach(([key, lines]) => {
  let dr = 0, cr = 0;
  lines.forEach(l => {
    dr += Number(l.dramt) || 0;
    cr += Number(l.cramt) || 0;
  });
  const diff = Math.abs(dr - cr);
  if (diff > 0.001) {
    foundUnbalanced++;
    const [src, vidStr] = key.split('_');
    const vid = Number(vidStr);
    const v = allVouchers.find(v => v.vid === vid && v._src === src);
    console.log(`\nUnbalanced Voucher ${key} (vid=${vid}):`);
    console.log(`  Date: ${v?.dt}, Type: ${v?.vtyp}, Acid: ${v?.acid}, Narr: "${v?.narr}"`);
    console.log(`  Dr: ${dr.toFixed(2)}, Cr: ${cr.toFixed(2)}, Diff: ${(dr - cr).toFixed(2)}`);
    console.log('  Lines:');
    lines.forEach(l => {
      const ledger = acmac1.find((a: any) => a.id === l.maid && a.acid === l.acid);
      console.log(`    maid=${l.maid} ("${ledger?.name || 'Asset/Ledger'}"), dr=${l.dramt}, cr=${l.cramt}, narr="${l.narr || ''}"`);
    });
  }
});
console.log(`Total unbalanced vouchers found: ${foundUnbalanced}`);

// Check Unassigned Broker vouchers
console.log('\n--- Unassigned Broker (maid=215 or name="Unassigned Broker") ---');
const unassignedLines = allTrans.filter(t => {
  const ledger = acmac1.find((a: any) => a.id === t.maid && a.acid === t.acid);
  return t.maid === 215 || (ledger && ledger.name.toLowerCase().includes('unassigned'));
});
console.log(`Total entries with Unassigned Broker: ${unassignedLines.length}`);
unassignedLines.forEach(l => {
  const v = allVouchers.find(v => v.vid === l.vid && v._src === l._src);
  console.log(`Entry: acid=${l.acid}, vid=${l.vid}, dt=${l.dt}, dr=${l.dramt}, cr=${l.cramt}, narr="${l.narr}" | Voucher narr="${v?.narr}", vtyp=${v?.vtyp}`);
  const siblingLines = allTrans.filter(x => x.vid === l.vid && x._src === l._src);
  console.log('  Sibling lines:');
  siblingLines.forEach(s => {
    const ledger = acmac1.find((a: any) => a.id === s.maid && a.acid === s.acid);
    console.log(`    maid=${s.maid} ("${ledger?.name || 'Asset/Ledger'}"), dr=${s.dramt}, cr=${s.cramt}`);
  });
});
